import { act, createElement, useEffect, type ReactElement } from 'react';
import { AppState } from 'react-native';

import { actionRejection } from '@/game/engine/actions';
import { isPixelReachable, renderExteriorMask } from '@/game/engine/pixels';
import type { GameRuleset, LevelDefinition, OrbColor } from '@/game/engine/types';
import { useGameSession, type GameSession } from '@/hooks/useGameSession';
import { eventCountAt } from '../motion';

/**
 * HOLDING ESCAPE.
 *
 * Relaunching a held Pal is how the player escapes a full tray, so admission
 * for it has to be exactly the engine's answer — never a presentation guess,
 * never capacity when a slot is free, and never "the tray is full".
 *
 * Note which layer owns what: the ONLY rule that refuses a legal-looking held
 * Pal is the engine's Legacy V1 `noTargets` rule (`actionRejection`). The
 * session adds `inFlight`, `activeFull`, `tutorial` and `gameOver` and
 * otherwise relays the engine verbatim.
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
function mount(level: LevelDefinition) {
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(createElement(Probe, { level })); });
  return root;
}
beforeEach(() => {
  jest.useFakeTimers({ now: 0 });
  jest.clearAllMocks();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (AppState.addEventListener as jest.Mock).mockImplementation(() => ({ remove: jest.fn() }));
});
afterEach(() => { jest.useRealTimers(); });

const cursors = new Map<number, number>();
beforeEach(() => cursors.clear());
function presentTo(now: number) {
  jest.setSystemTime(now);
  for (const pass of [...session.flights, ...session.landingFlights]) {
    const t = now - pass.launchedAtMs;
    const count = t >= pass.totalMs ? Number.MAX_SAFE_INTEGER : eventCountAt(pass, t);
    if (count > 0 && cursors.get(pass.passId) !== count) {
      cursors.set(pass.passId, count);
      act(() => { session.presentThrough(pass.passId, count); });
    }
  }
}
function tapHeld(id: string) {
  const before = session.lastDenial?.seq ?? 0;
  let accepted = false;
  act(() => { accepted = session.launchHeld(id); });
  const refused = (session.lastDenial?.seq ?? 0) > before ? session.lastDenial!.reason : null;
  return { accepted, refused };
}
function tapTunnel(id: string) {
  const before = session.lastDenial?.seq ?? 0;
  let accepted = false;
  act(() => { accepted = session.launch(id); });
  const refused = (session.lastDenial?.seq ?? 0) > before ? session.lastDenial!.reason : null;
  return { accepted, refused };
}

const level = (ruleset: GameRuleset, extra: Partial<LevelDefinition> & Pick<LevelDefinition, 'id' | 'pixelArt' | 'tunnels'>): LevelDefinition => {
  const tunnels = [...extra.tunnels];
  while (tunnels.length < (ruleset === 'coreV2' ? 4 : 3)) tunnels.push([]);
  return {
    title: `holding-${extra.id}`, themeId: 'fixture', difficulty: 'easy', holdingCapacity: 3,
    ...extra, tunnels, ruleset,
  };
};

/** A buried red core: red Pals fly, miss, and park. Fills Holding on demand. */
const buried = (ruleset: GameRuleset, id: number) => level(ruleset, {
  id,
  pixelArt: ['BBBBB', 'BBBBB', 'BBRBB', 'BBBBB', 'BBBBB'],
  tunnels: [
    Array.from({ length: 4 }, () => ({ color: 'red' as OrbColor, capacity: 1 })),
    Array.from({ length: 4 }, () => ({ color: 'blue' as OrbColor, capacity: 1 })),
    Array.from({ length: 4 }, () => ({ color: 'blue' as OrbColor, capacity: 1 })),
  ],
});

/** Every Pal can always hit something, so relaunch is always engine-legal. */
const open = (ruleset: GameRuleset, id: number) => level(ruleset, {
  id,
  pixelArt: ['BBBB', 'BBBB', 'BBBB', 'BBBB'],
  tunnels: Array.from({ length: ruleset === 'coreV2' ? 4 : 3 }, () =>
    Array.from({ length: 4 }, () => ({ color: 'blue' as OrbColor, capacity: 1 }))),
});

/** Park `n` Pals into Holding by launching single-capacity Pals that miss. */
function fillHolding(n: number, tunnelId = 'tunnel-0') {
  for (let i = 0; i < n; i++) {
    act(() => { session.launch(tunnelId); });
    const f = session.flights[session.flights.length - 1]!;
    presentTo(f.launchedAtMs + f.totalMs + 30);
  }
}

describe('a full tray never blocks its own escape', () => {
  test.each(['coreV2', 'legacyV1'] as const)(
    '%s: Holding full is never itself the refusal reason', (ruleset) => {
      const root = mount(buried(ruleset, ruleset === 'coreV2' ? 9741 : 9742));
      fillHolding(3);
      expect(session.state.holding).toHaveLength(3);
      expect(session.state.holding.length).toBe(session.state.holdingCapacity);
      expect(session.activeCount).toBeLessThan(session.activeCapacity);

      for (const held of session.state.holding) {
        const engineSays = actionRejection(session.engineState, { kind: 'holding', id: held.id });
        const { accepted, refused } = tapHeld(held.id);
        // Whatever happens, it is never "the tray is full" and never capacity.
        expect(refused).not.toBe('activeFull');
        // The session's answer is exactly the engine's answer.
        if (engineSays === null) expect(accepted).toBe(true);
        else expect(accepted).toBe(false);
      }
      act(() => root.unmount());
    });

  test.each([1, 3, 4])(
    'Core V2: ACTIVE %i/5 with HOLDING 3/3 relaunches a held Pal', (activeCount) => {
      const root = mount(buried('coreV2', 9743));
      fillHolding(3);
      expect(session.state.holding).toHaveLength(3);
      // Put `activeCount` Pals on the rail without letting them finish.
      for (let i = 0; i < activeCount; i++) {
        act(() => { session.launch(`tunnel-${1 + (i % 2)}`); });
      }
      presentTo(Date.now() + 120);
      expect(session.activeCount).toBe(activeCount);
      expect(session.activeCount).toBeLessThan(session.activeCapacity);

      const held = session.state.holding[0]!;
      const before = session.activeCount;
      const beforeHolding = session.state.holding.length;
      const { accepted } = tapHeld(held.id);
      expect(accepted).toBe(true);
      // The slot is spent and the tray frees the well immediately. (A Pal that
      // misses again re-parks in truth at once — that is the engine's own
      // lifecycle, not a failure to escape.)
      expect(session.activeCount).toBe(before + 1);
      expect(session.state.holding.length).toBe(beforeHolding - 1);
      expect(session.state.holding.some((c) => c.id === held.id)).toBe(false);
      act(() => root.unmount());
    });

  test('Core V2: a held Pal at ACTIVE 5/5 is refused as activeFull, not silently', () => {
    const root = mount(buried('coreV2', 9744));
    fillHolding(3);
    expect(session.state.holding.length).toBeGreaterThan(0);
    for (let i = 0; i < 5; i++) act(() => { session.launch(`tunnel-${1 + (i % 2)}`); });
    presentTo(Date.now() + 80);
    expect(session.activeCount).toBe(5);
    if (session.state.holding.length > 0) {
      const { accepted, refused } = tapHeld(session.state.holding[0]!.id);
      expect(accepted).toBe(false);
      expect(refused).toBe('activeFull');
    }
    act(() => root.unmount());
  });

  test('a Pal still in the air is refused as inFlight, and relaunches once landed', () => {
    const root = mount(buried('coreV2', 9745));
    act(() => { session.launch('tunnel-0'); });
    const flight = session.flights[0]!;
    presentTo(flight.launchedAtMs + 150);
    const mid = tapHeld(flight.charge.id);
    expect(mid.accepted).toBe(false);

    presentTo(flight.launchedAtMs + flight.totalMs + 30);
    expect(session.state.holding.some((c) => c.id === flight.charge.id)).toBe(true);
    // No stale presentation lock: not in flights, not in landing, relaunchable.
    expect(session.flights.some((f) => f.charge.id === flight.charge.id)).toBe(false);
    expect(session.landingFlights.some((f) => f.charge.id === flight.charge.id)).toBe(false);
    expect(tapHeld(flight.charge.id).accepted).toBe(true);
    act(() => root.unmount());
  });

  test('repeated land -> relaunch cycles never strand a held Pal', () => {
    const root = mount(buried('coreV2', 9746));
    // One Pal, cycled: park -> relaunch -> miss -> park again. The tray must
    // never hold on to it, and no cycle may leave a stale lock behind.
    act(() => { session.launch('tunnel-0'); });
    const first = session.flights[0]!;
    presentTo(first.launchedAtMs + first.totalMs + 30);
    const id = first.charge.id;

    for (let cycle = 0; cycle < 6; cycle++) {
      expect(session.state.holding.some((c) => c.id === id)).toBe(true);
      expect(session.flights.some((f) => f.charge.id === id)).toBe(false);
      expect(session.landingFlights.some((f) => f.charge.id === id)).toBe(false);

      const { accepted, refused } = tapHeld(id);
      expect({ cycle, accepted, refused }).toEqual({ cycle, accepted: true, refused: null });

      const flight = session.flights[session.flights.length - 1]!;
      presentTo(flight.launchedAtMs + flight.totalMs + 30);
      expect(session.state.status).toBe('playing');
    }
    act(() => root.unmount());
  });
});

/**
 * PROPERTY: the engine is the only authority. Over randomized play biased
 * toward a full tray, whenever the engine would admit a held relaunch and a
 * slot is free, the session must admit it too.
 */
describe('property: engine admits => session admits', () => {
  function rng(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  test.each(['coreV2', 'legacyV1'] as const)('%s', (ruleset) => {
    const counters = { taps: 0, held: 0, divergent: [] as string[], trayMismatch: 0 };
    for (let seed = 1; seed <= 40; seed++) {
      const next = rng(seed * 104729 + 7);
      const root = mount(seed % 2 === 0 ? buried(ruleset, 9750 + seed) : open(ruleset, 9750 + seed));
      let now = 0;
      for (let step = 0; step < 30; step++) {
        now += next() < 0.5 ? 40 + Math.floor(next() * 200) : 400 + Math.floor(next() * 2600);
        presentTo(now);
        if (session.state.status !== 'playing') break;

        // Prefer held Pals so the search spends its time on the tray.
        const held = session.state.holding;
        const useHeld = held.length > 0 && next() < 0.7;
        if (useHeld) {
          const pal = held[Math.floor(next() * held.length)]!;
          const truth = session.engineState;
          const engineSays = actionRejection(truth, { kind: 'holding', id: pal.id });
          const free = session.activeCount < session.activeCapacity;
          const inAir = session.flights.some((f) => f.charge.id === pal.id)
            || session.landingFlights.some((f) => f.charge.id === pal.id);
          // What the tray shows the player. GameScreen derives this from engine
          // TRUTH (not the presented board) precisely so that a Pal shown as
          // useful is a Pal the engine will actually admit.
          const mask = renderExteriorMask(truth);
          const trayUseful = truth.pixels.some(
            (p) => !p.cleared && p.color === pal.color && isPixelReachable(mask, p));

          const { accepted, refused } = tapHeld(pal.id);
          counters.taps++; counters.held++;
          if (engineSays === null && free && !inAir && truth.status === 'playing' && !accepted) {
            counters.divergent.push(`seed ${seed} step ${step}: engine admits ${pal.id} `
              + `(ACTIVE ${session.activeCount}/${session.activeCapacity}, HOLDING ${held.length}) `
              + `but session refused ${refused}`);
          }
          // Usefulness is now only a HINT: it must never decide legality.
          // Count the Pals the tray shows as "no exposed match" that the engine
          // admits anyway — under the old rule every one of these was a trap.
          if (!inAir && truth.status === 'playing' && !trayUseful && engineSays === null) {
            counters.trayMismatch++;
          }
        } else {
          const open = session.state.tunnels.filter((t) => t.queue.length > 0);
          if (!open.length) continue;
          tapTunnel(open[Math.floor(next() * open.length)]!.id);
          counters.taps++;
        }
      }
      act(() => root.unmount());
    }
    console.log(`[HOLDING PROPERTY ${ruleset}] taps=${counters.taps} heldTaps=${counters.held} `
      + `divergences=${counters.divergent.length} buriedButAdmitted=${counters.trayMismatch}`);
    expect(counters.divergent).toEqual([]);
    // Those Pals must exist in this search (otherwise the fixtures stopped
    // covering the bug) and none of them may be refused — which the
    // `divergences` check above already proves.
    expect(counters.trayMismatch).toBeGreaterThan(0);
  });
});
