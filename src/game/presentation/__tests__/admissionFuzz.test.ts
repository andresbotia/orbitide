import { act, createElement, useEffect, type ReactElement } from 'react';
import { AppState } from 'react-native';

import { actionRejection, type GameAction } from '@/game/engine/actions';
import { DEFAULT_ACTIVE_CAPACITY } from '@/game/engine/concurrency';
import { activeSlotCount } from '@/game/engine/epoch';
import { isProductiveAction } from '@/game/engine/winState';
import { expectedTunnelCount } from '@/game/engine/ruleset';
import type { GameRuleset, GameState, LevelDefinition, OrbColor } from '@/game/engine/types';
import { legalActions } from '@/game/engine/actions';
import { useGameSession, type GameSession } from '@/hooks/useGameSession';
import { eventCountAt } from '../motion';

/**
 * FORENSIC: randomized admission search.
 *
 * Drives the REAL session with a controlled clock, presenting every live flight
 * exactly as the UI-thread clock would, and taps randomly. After each tap it
 * asserts the two properties the device bug violates:
 *
 *   1. NO SILENT TAP — an attempt either launches or raises a typed refusal.
 *   2. CAPACITY HONESTY — when the displayed ACTIVE count is below capacity and
 *      the engine itself would accept the very same action, the session must
 *      not refuse it.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as { create: (element: ReactElement) => { unmount: () => void } };
jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) } }));
jest.mock('@/game/feedback', () => ({ feedback: { emit: jest.fn(), cancelPending: jest.fn() } }));
jest.mock('@/game/hapticArbiter', () => ({ registerHit: jest.fn(), cancelHits: jest.fn() }));

let session: GameSession;
function Probe({ level }: { level: LevelDefinition }) {
  const current = useGameSession(level.id, { level, completedTutorials: [] });
  useEffect(() => { session = current; });
  return null;
}

beforeEach(() => {
  jest.useFakeTimers({ now: 0 });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (AppState.addEventListener as jest.Mock).mockImplementation(() => ({ remove: jest.fn() }));
});
afterEach(() => { jest.useRealTimers(); });

const COLORS: OrbColor[] = ['red', 'blue', 'green', 'yellow', 'white'];
const LETTER: Record<string, string> = { red: 'R', blue: 'B', green: 'G', yellow: 'Y', white: 'W' };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A random level for either ruleset. Half the seeds bury one colour inside a
 * shell of another, which is what fills Holding with Pals that have nothing to
 * hit — the shape of the device bug.
 */
function makeLevel(seed: number, ruleset: GameRuleset): LevelDefinition {
  const next = rng(seed);
  const size = 5 + Math.floor(next() * 5);
  const palette = COLORS.slice(0, 2 + Math.floor(next() * 3));
  const buried = seed % 2 === 0;
  const art = buried
    ? Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, x) =>
        (x === Math.floor(size / 2) && y === Math.floor(size / 2) ? LETTER.red! : LETTER.blue!)).join(''))
    : Array.from({ length: size }, () =>
      Array.from({ length: size }, () => LETTER[palette[Math.floor(next() * palette.length)]!]!).join(''));
  const colours: OrbColor[] = buried ? ['red', 'red', 'blue'] : palette;
  const tunnelCount = expectedTunnelCount(ruleset);
  const tunnels = Array.from({ length: tunnelCount }, () =>
    Array.from({ length: 3 + Math.floor(next() * 3) }, () => ({
      color: colours[Math.floor(next() * colours.length)]!,
      capacity: 1 + Math.floor(next() * 6),
    })));
  return {
    id: 9700 + (seed % 90), title: `fuzz-${seed}`, themeId: 'fixture', difficulty: 'easy',
    ruleset, holdingCapacity: 3, activeCapacity: DEFAULT_ACTIVE_CAPACITY,
    pixelArt: art, tunnels,
  };
}

interface Trace {
  step: number;
  atMs: number;
  action: GameAction;
  displayedActive: number;
  capacity: number;
  flights: number;
  landingFlights: number;
  epochLaunches: number;
  activeCharges: number;
  holding: string[];
  viewStatus: GameState['status'];
  engineStatus: GameState['status'];
  accepted: boolean;
  refusal: string | null;
  engineWouldAccept: boolean;
  engineRejection: string | null;
}

function describeTrace(t: Trace): string {
  return [
    `step=${t.step} at=${t.atMs}ms ${t.action.kind}:${t.action.id}`,
    `displayedACTIVE=${t.displayedActive}/${t.capacity}`,
    `flights=${t.flights} landing=${t.landingFlights}`,
    `epoch.launches=${t.epochLaunches} activeCharges=${t.activeCharges}`,
    `holding=[${t.holding.join(',')}]`,
    `view=${t.viewStatus} engine=${t.engineStatus}`,
    `accepted=${t.accepted} refusal=${t.refusal ?? 'NONE'}`,
    `engineWouldAccept=${t.engineWouldAccept} engineRejection=${t.engineRejection ?? 'none'}`,
  ].join(' | ');
}

/** Present every live flight up to `now`, exactly as the UI clock does. */
function presentAll(cursors: Map<number, number>, now: number) {
  for (const pass of [...session.flights, ...session.landingFlights]) {
    const t = now - pass.launchedAtMs;
    const count = t >= pass.totalMs ? Number.MAX_SAFE_INTEGER : eventCountAt(pass, t);
    if (count > 0 && cursors.get(pass.passId) !== count) {
      cursors.set(pass.passId, count);
      act(() => { session.presentThrough(pass.passId, count); });
    }
  }
}

interface Finding {
  kind: 'silent' | 'capacity' | 'buriedHeld' | 'endlessLoop' | 'pending';
  trace: Trace; history: GameAction[]; note?: string;
}

/**
 * Everything that must be true of a provisional Holding arrival, at every
 * single step, in both rulesets:
 *
 *   1. NOT YET FINAL — while anything is pending, the level is still playing;
 *      an overflow may never end the level before the Gate decides it.
 *   2. NOT IN TWO PLACES — a pending Pal is not in the tray, and the tray is
 *      never over capacity.
 *   3. STILL ACTIVE — a pending Pal is still an Active Pal: it is carried by a
 *      live flight and keeps consuming its slot until its lifecycle ends.
 *   4. FIFO — pendings queue in LAUNCH order (a relaunched Pal queues by the
 *      launch it is flying, not by the charge's first ever flight), and the
 *      head is always the next to be decided.
 *   5. NEVER STRANDED — every pending carries a live countdown, so it is always
 *      on its way to a decision rather than parked forever.
 */
function pendingProblem(truth: GameState): string | null {
  const pending = truth.pendingHolding;
  if (pending.length === 0) return null;
  if (truth.status !== 'playing') return `status '${truth.status}' with ${pending.length} pending`;
  const live = [...session.flights, ...session.landingFlights];
  const order: number[] = [];
  const graces: number[] = [];
  for (const { charge, grace } of pending) {
    if (truth.holding.some((c) => c.id === charge.id)) return `${charge.id} is pending AND in the tray`;
    // A relaunched Pal can appear twice — the finished landing it came from and
    // the lap it is flying now. The pending belongs to the lap it is flying.
    const mine = live.filter((f) => f.charge.id === charge.id);
    const flight = mine.reduce<typeof mine[number] | undefined>(
      (best, f) => (best === undefined || f.passId > best.passId ? f : best), undefined);
    if (!flight) return `${charge.id} is pending but no longer an Active flight`;
    if (grace < 0 || grace > 1) return `${charge.id} has an out-of-range grace ${grace}`;
    order.push(flight.passId);
    graces.push(grace);
  }
  if (truth.holding.length > truth.holdingCapacity) return `tray ${truth.holding.length}/${truth.holdingCapacity}`;
  for (let i = 1; i < order.length; i++) {
    // Queued in launch order...
    if (order[i]! <= order[i - 1]!) return `pending queue is out of launch order (passes ${order.join(',')})`;
    // ...and therefore counting down in that same order: the head is always
    // the one closest to its decision, so nothing overtakes it.
    if (graces[i]! < graces[i - 1]!) return `pending grace overtakes the head (${graces.join(',')})`;
  }
  return null;
}

const steps = { n: 0 };

function runSession(seed: number, stepCount: number, ruleset: GameRuleset = 'coreV2'): Finding[] {
  const level = makeLevel(seed, ruleset);
  const next = rng(seed * 7919 + 13);
  const findings: Finding[] = [];
  const cursors = new Map<number, number>();
  const history: GameAction[] = [];
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(createElement(Probe, { level })); });

  let now = 0;
  for (let step = 0; step < stepCount; step++) {
    // Advance the clock and present, sometimes in small slices (fast taps),
    // sometimes long enough for Pals to complete and free their slots.
    const dt = next() < 0.5 ? 16 + Math.floor(next() * 120) : 300 + Math.floor(next() * 2500);
    now += dt;
    jest.setSystemTime(now);
    presentAll(cursors, now);

    // Stop only when the PLAYER can see the level is over. While the board
    // still looks playable, every tap must still answer — including the window
    // where engine truth has already decided but presentation has not shown it.
    if (session.state.status !== 'playing') break;

    // Pick a tap the UI would actually offer: a tunnel with a front Pal, or a
    // held Pal.
    const options: GameAction[] = [
      ...session.state.tunnels.filter((t) => t.queue.length > 0).map((t) => ({ kind: 'tunnel' as const, id: t.id })),
      ...session.state.holding.map((c) => ({ kind: 'holding' as const, id: c.id })),
    ];
    if (options.length === 0) continue;
    const action = options[Math.floor(next() * options.length)]!;

    const beforeSeq = session.lastDenial?.seq ?? 0;
    const truth = session.engineState;
    const inAir = action.kind === 'holding' && (
      session.flights.some((f) => f.charge.id === action.id)
      || session.landingFlights.some((f) => f.charge.id === action.id));
    const displayedActive = session.activeCount;
    const capacity = session.activeCapacity;
    // What the ENGINE alone says about this exact action, settle-first (the
    // session never requests a join it knows the epoch cannot take).
    const engineRejection = actionRejection(truth, action);

    let accepted = false;
    act(() => {
      accepted = action.kind === 'tunnel' ? session.launch(action.id) : session.launchHeld(action.id);
    });
    history.push(action);

    const refusal = (session.lastDenial?.seq ?? 0) > beforeSeq ? session.lastDenial!.reason : null;
    // The number the player reads IS the number admission counts.
    if (session.activeCount !== session.flights.length) {
      throw new Error(`displayedActive ${session.activeCount} != authoritative ${session.flights.length}`);
    }
    steps.n++;
    const trace: Trace = {
      step, atMs: now, action, displayedActive, capacity,
      flights: session.flights.length, landingFlights: session.landingFlights.length,
      epochLaunches: activeSlotCount(truth), activeCharges: truth.activeCharges.length,
      holding: truth.holding.map((c) => c.id), viewStatus: session.state.status, engineStatus: truth.status,
      accepted, refusal, engineWouldAccept: engineRejection === null, engineRejection,
    };

    if (!accepted && refusal === null) findings.push({ kind: 'silent', trace, history: [...history] });
    // While the engine itself is still playing and would admit this exact
    // action, the session must admit it too: capacity (or anything else in the
    // presentation layer) may never be the thing that blocks a legal launch.
    // While the board still has a free Active slot and the engine itself would
    // admit this exact action, the session must admit it too.
    else if (!accepted && truth.status === 'playing' && engineRejection === null && displayedActive < capacity) {
      findings.push({ kind: 'capacity', trace, history: [...history] });
    }
    // A held Pal is never refused just because its colour is buried right now.
    else if (!accepted && action.kind === 'holding' && truth.status === 'playing'
      && displayedActive < capacity && !inAir) {
      findings.push({ kind: 'buriedHeld', trace, history: [...history] });
    }
    // A state whose every admitted action is a no-op loop must be lost, not
    // endlessly playable — unless a Pal is inbound to an undecided Holding
    // admission, whose arrival is itself the pending change.
    if (truth.status === 'playing' && truth.pendingHolding.length === 0) {
      const admitted = legalActions(truth);
      if (admitted.length > 0 && !admitted.some((a) => isProductiveAction(truth, a))) {
        findings.push({ kind: 'endlessLoop', trace, history: [...history] });
      }
    }
    const pendingIssue = pendingProblem(session.engineState);
    if (pendingIssue) findings.push({ kind: 'pending', trace, history: [...history], note: pendingIssue });
    if (findings.length) break;
  }
  act(() => root.unmount());
  return findings;
}

test('randomized play never produces a silent tap, a false capacity refusal or a broken pending arrival', () => {
  const found: Finding[] = [];
  for (const ruleset of ['coreV2', 'legacyV1'] as const) {
    for (let seed = 1; seed <= 150 && found.length === 0; seed++) {
      found.push(...runSession(seed, 40, ruleset));
    }
  }
  console.log(`[ADMISSION STRESS] ${steps.n} taps across 300 randomized sessions`);
  if (found.length) {
    const f = found[0]!;
    console.log(`\n[ADMISSION ${f.kind.toUpperCase()}]${f.note ? ` ${f.note}` : ''}\n${describeTrace(f.trace)}\nsequence: `
      + f.history.map((a) => `${a.kind}:${a.id}`).join(' -> '));
  }
  expect(found.map((f) => `${f.kind}${f.note ? ` (${f.note})` : ''}: ${describeTrace(f.trace)}`)).toEqual([]);
});
