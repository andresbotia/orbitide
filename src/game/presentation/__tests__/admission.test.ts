import { act, createElement, useEffect, type ReactElement } from 'react';
import { AppState } from 'react-native';

import { DEFAULT_ACTIVE_CAPACITY } from '@/game/engine/concurrency';
import type { LevelDefinition } from '@/game/engine/types';
import { useGameSession, type GameSession } from '@/hooks/useGameSession';
import { eventCountAt } from '../motion';

/**
 * Launch admission: a tap always answers.
 *
 * Every attempted tunnel/Holding action must end in either an accepted launch
 * or ONE typed refusal — never in nothing. The device bug this pins: once
 * engine truth had already decided the level (a Holding overflow decides the
 * loss at launch time, ~7s before the rejecting Pal reaches the GateTerminal
 * and the loss is presented), the board still looked playable — free ACTIVE
 * slots, Pals in the tunnels — and every tap in that window was swallowed.
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
/** Present every live flight up to `now`, exactly as the UI clock does. */
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
beforeEach(() => cursors.clear());

/** One attempted tap: did it launch, and which typed refusal did it raise? */
function tap(action: { kind: 'tunnel' | 'holding'; id: string }) {
  const before = session.lastDenial?.seq ?? 0;
  let accepted = false;
  act(() => {
    accepted = action.kind === 'tunnel' ? session.launch(action.id) : session.launchHeld(action.id);
  });
  const denial = session.lastDenial;
  const refused = (denial?.seq ?? 0) > before ? denial!.reason : null;
  return { accepted, refused, answered: accepted || refused !== null };
}

const v2 = (extra: Partial<LevelDefinition> & Pick<LevelDefinition, 'id' | 'title' | 'pixelArt' | 'tunnels'>): LevelDefinition => {
  const tunnels = [...extra.tunnels];
  while (tunnels.length < 4) tunnels.push([]);
  return {
    themeId: 'fixture', difficulty: 'easy', holdingCapacity: 3,
    activeCapacity: DEFAULT_ACTIVE_CAPACITY, ...extra, tunnels, ruleset: 'coreV2',
  };
};

/**
 * A level that DECIDES ITSELF while a Pal is still on screen.
 *
 * A Holding overflow no longer does that — it stays provisional until the Gate
 * (see `pendingOverflow.test.ts`). What still decides early is a no-op
 * deadlock: once the queues are drained and every held Pal is a lap that can
 * meet nothing, truth is lost on that commit while the flight plays on.
 */
const OVERFLOW = v2({
  id: 9721, title: 'deadlock while flying', holdingCapacity: 3,
  pixelArt: ['BB', 'BB'],
  tunnels: [
    [{ color: 'red', capacity: 1 }],
    [{ color: 'red', capacity: 1 }],
    [],
    [],
  ],
});

describe('the decided-but-unpresented window', () => {
  test('a tap is still answered while the loss is on its way to the GateTerminal', () => {
    const root = mount(OVERFLOW);
    // Park the first miss in Holding.
    expect(tap({ kind: 'tunnel', id: 'tunnel-0' }).accepted).toBe(true);
    const first = session.flights[0]!;
    presentTo(first.totalMs + 10);
    expect(session.state.holding).toHaveLength(1);

    // The last tunnel Pal goes out. Once it too can only miss, nothing left can
    // change the board, so truth is lost on that commit while the Pal flies on.
    expect(tap({ kind: 'tunnel', id: 'tunnel-1' }).accepted).toBe(true);
    const doomed = session.flights[session.flights.length - 1]!;
    expect(session.engineState.status).toBe('lost');
    // ...but the player still sees a playable board with free Active slots.
    expect(session.state.status).toBe('playing');
    expect(session.activeCount).toBeLessThan(session.activeCapacity);
    expect(session.state.holding.length).toBeGreaterThan(0);

    // Every tap across that whole window must answer.
    const windowMs = doomed.launchedAtMs + doomed.totalMs - Date.now();
    expect(windowMs).toBeGreaterThan(1000); // it is seconds, not a frame
    let taps = 0;
    for (let t = Date.now() + 200; t < doomed.launchedAtMs + doomed.totalMs; t += 400) {
      presentTo(t);
      if (session.state.status !== 'playing') break;
      const result = tap({ kind: 'holding', id: session.state.holding[0]!.id });
      taps++;
      expect(result.answered).toBe(true);
      expect(result.accepted).toBe(false);
      expect(result.refused).toBe('gameOver');
    }
    expect(taps).toBeGreaterThan(3);
    act(() => root.unmount());
  });

  test('a held Pal is answered in the same window, and is never accepted', () => {
    const root = mount(OVERFLOW);
    tap({ kind: 'tunnel', id: 'tunnel-0' });
    presentTo(session.flights[0]!.totalMs + 10);
    const held = session.state.holding[0]!;
    tap({ kind: 'tunnel', id: 'tunnel-1' });
    expect(session.engineState.status).toBe('lost');

    presentTo(Date.now() + 500);
    const result = tap({ kind: 'holding', id: held.id });
    expect(result.accepted).toBe(false);
    expect(result.refused).toBe('gameOver');
    act(() => root.unmount());
  });
});

describe('acceptance', () => {
  /** Plain board: every tunnel Pal can always hit something. */
  const PLAIN = v2({
    id: 9722, title: 'plain', pixelArt: ['BBBB', 'BBBB', 'BBBB', 'BBBB'],
    tunnels: Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => ({ color: 'blue' as const, capacity: 2 }))),
  });

  test('A. a 6th launch at 5/5 is refused as activeFull', () => {
    const root = mount(PLAIN);
    for (let i = 0; i < 4; i++) tap({ kind: 'tunnel', id: `tunnel-${i}` });
    tap({ kind: 'tunnel', id: 'tunnel-0' });
    expect(session.activeCount).toBe(5);
    const sixth = tap({ kind: 'tunnel', id: 'tunnel-1' });
    expect(sixth.accepted).toBe(false);
    expect(sixth.refused).toBe('activeFull');
    act(() => root.unmount());
  });

  test.each([3, 4])('B/C. a legal tunnel Pal launches at %i active', (n) => {
    const root = mount(PLAIN);
    for (let i = 0; i < n; i++) tap({ kind: 'tunnel', id: `tunnel-${i % 4}` });
    expect(session.activeCount).toBe(n);
    expect(session.activeCount).toBeLessThan(session.activeCapacity);
    expect(tap({ kind: 'tunnel', id: 'tunnel-3' }).accepted).toBe(true);
    act(() => root.unmount());
  });

  test('E/G. a completed Pal frees its slot, and the freed slot is reusable', () => {
    const root = mount(PLAIN);
    for (let i = 0; i < 5; i++) tap({ kind: 'tunnel', id: `tunnel-${i % 4}` });
    expect(session.activeCount).toBe(5);
    expect(tap({ kind: 'tunnel', id: 'tunnel-0' }).refused).toBe('activeFull');

    // Let the earliest Pal finish.
    const first = session.flights[0]!;
    presentTo(first.launchedAtMs + first.totalMs + 20);
    expect(session.activeCount).toBeLessThan(5);
    const after = tap({ kind: 'tunnel', id: 'tunnel-1' });
    expect(after.accepted).toBe(true);
    expect(session.activeCount).toBeLessThanOrEqual(session.activeCapacity);
    act(() => root.unmount());
  });

  test('D/F/H. a Pal that parks in Holding relaunches once its landing is presented', () => {
    /** A red Pal on a blue board always misses and parks. */
    const PARK = v2({
      id: 9723, title: 'park', pixelArt: ['BB', 'BB'],
      tunnels: [[{ color: 'red', capacity: 2 }], [{ color: 'blue', capacity: 1 }], [], []],
    });
    const root = mount(PARK);
    tap({ kind: 'tunnel', id: 'tunnel-0' });
    const flight = session.flights[0]!;

    // Mid-flight the Pal is still in the air: a typed refusal, never silence.
    presentTo(flight.launchedAtMs + 200);
    const early = tap({ kind: 'holding', id: flight.charge.id });
    expect(early.accepted).toBe(false);
    expect(early.answered).toBe(true);

    presentTo(flight.launchedAtMs + flight.totalMs + 20);
    expect(session.state.holding.map((c) => c.id)).toContain(flight.charge.id);
    expect(session.activeCount).toBe(0);

    // No stale in-flight lock: it relaunches immediately.
    const relaunch = tap({ kind: 'holding', id: flight.charge.id });
    expect(relaunch.accepted).toBe(true);
    act(() => root.unmount());
  });

  test('J/K. restart clears admission state after a decided level', () => {
    const root = mount(OVERFLOW);
    tap({ kind: 'tunnel', id: 'tunnel-0' });
    presentTo(session.flights[0]!.totalMs + 10);
    tap({ kind: 'tunnel', id: 'tunnel-1' });
    expect(session.engineState.status).toBe('lost');
    expect(tap({ kind: 'holding', id: session.state.holding[0]!.id }).refused).toBe('gameOver');

    act(() => { session.restart(); });
    expect(session.engineState.status).toBe('playing');
    expect(session.state.status).toBe('playing');
    expect(session.activeCount).toBe(0);
    expect(tap({ kind: 'tunnel', id: 'tunnel-0' }).accepted).toBe(true);
    act(() => root.unmount());
  });

  test('I. returning from the background leaves no stale reservation', () => {
    const root = mount(PLAIN);
    for (let i = 0; i < 3; i++) tap({ kind: 'tunnel', id: `tunnel-${i}` });
    expect(session.activeCount).toBe(3);
    // The session settles every flight when backgrounded.
    const calls = (AppState.addEventListener as jest.Mock).mock.calls;
    const settle = calls[calls.length - 1]?.[1] as ((s: string) => void) | undefined;
    expect(settle).toBeDefined();
    act(() => settle!('background'));
    expect(session.activeCount).toBe(0);
    if (session.state.status === 'playing') {
      expect(tap({ kind: 'tunnel', id: 'tunnel-0' }).accepted).toBe(true);
    }
    act(() => root.unmount());
  });
});
