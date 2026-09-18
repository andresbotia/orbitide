/**
 * Synthetic retroactive join: a LATER join must not touch an EARLIER in-flight
 * Pal. Board (coreV2):
 *
 *   B W Y      Pal A = blue4 (tunnel-0), Pal B = yellow2 (tunnel-1).
 *   Y B B      A hits p0-2, p0-0, p2-1 and parks with 1: blue p1-1 is hidden
 *   B Y Y      behind yellow p1-2, and A never reaches it.
 *
 * Under the OLD 0.18 launch spacing the laps interleaved, so B's clear of p1-2
 * exposed p1-1 to A *retroactively* — the engine inserted a blue hit at logical
 * progress 0.25 and flipped A from parks-with-1 to consumed. When the player
 * joined late, A was already visibly past 0.25 (at 0.398, having shown p0-0
 * with 2 left), so that hit could never be presented honestly.
 *
 * Under FIRST LAUNCHED, FIRST SERVED (`LAUNCH_SPACING` = one lap) A's lap is
 * fully resolved before B's begins, so A is identical no matter when B joins.
 * The two cadences below therefore assert the SAME outcome — that equality is
 * the point: the result cannot depend on how fast the player taps.
 */
import { createGame } from '@/game/engine/createGame';
import { resolveAction } from '@/game/engine/resolveLaunch';
import type { LevelDefinition } from '@/game/engine/types';
import { drive, expectConverged, mountSession, type DriveLog } from './sessionDriver';

jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) } }));
jest.mock('@/game/feedback', () => ({ feedback: { emit: jest.fn(), cancelPending: jest.fn() } }));
jest.mock('@/game/hapticArbiter', () => ({ registerHit: jest.fn(), cancelHits: jest.fn() }));

const LEVEL: LevelDefinition = {
  id: 9720, title: 'Retroactive join', themeId: 'test', difficulty: 'easy', holdingCapacity: 3, ruleset: 'coreV2',
  pixelArt: ['BWY', 'YBB', 'BYY'],
  tunnels: [
    [{ color: 'blue', capacity: 4 }],
    [{ color: 'yellow', capacity: 2 }],
    [{ color: 'white', capacity: 1 }],
    [{ color: 'yellow', capacity: 2 }],
  ],
};
const A = 'L9720-t0-c0';
const B = 'L9720-t1-c0';
const px = (x: number, y: number) => `L9720-p${x}-${y}`;

/** A's lap, resolved the moment it launches. Nothing may change this later. */
const A_HISTORY = [px(0, 2), px(0, 0), px(2, 1)];

beforeEach(() => {
  jest.useFakeTimers({ now: 0 });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => { jest.useRealTimers(); });

test('engine: a later join leaves A exactly as it launched', () => {
  const s0 = createGame(LEVEL);
  const k = resolveAction(s0, { kind: 'tunnel', id: 'tunnel-0' });
  const a1 = k.epochCharges!.find((c) => c.id === A)!;
  expect(a1.landed).toBe('holding');
  expect(a1.remainingCapacity).toBe(1);
  expect(a1.encounters.map((e) => e.pixelId)).toEqual(A_HISTORY);

  const k1 = resolveAction(k.state, { kind: 'tunnel', id: 'tunnel-1', join: true });
  expect(k1.joinedEpoch).toBe(true);

  const a2 = k1.epochCharges!.find((c) => c.id === A)!;
  expect(a2.encounters.map((e) => e.pixelId)).toEqual(A_HISTORY);
  expect(a2.landed).toBe('holding');
  expect(a2.remainingCapacity).toBe(1);
  // The specific rewrite the old engine performed: a hit on p1-1 at progress
  // 0.25, inserted behind A's second shot. It must never reappear.
  expect(a2.encounters.map((e) => e.pixelId)).not.toContain(px(1, 1));
  expect(k1.state.holding.map((c) => c.id)).toEqual([A]);
  expect(k1.state.status).toBe('playing');
});

function run(joinAt: number): { log: DriveLog; view: ReturnType<ReturnType<typeof mountSession>['get']>['state']; truth: ReturnType<ReturnType<typeof mountSession>['get']>['state'] } {
  const s = mountSession(LEVEL);
  const log = drive(s.get, [{ at: 0, tunnel: 'tunnel-0' }, { at: joinAt, tunnel: 'tunnel-1' }]);
  const out = { log, view: s.get().state, truth: s.get().engineState };
  s.unmount();
  return out;
}

// `1000` joins while A is short of the old 0.25 boundary; `3000` joins once A
// has visibly passed it (rail at 0.398). Both must behave identically.
describe.each([['early join (1000ms)', 1000], ['late join (3000ms)', 3000]])('%s', (_label, joinAt) => {
  test('no presented history is contradicted, and view converges before settle', () => {
    const { log, view, truth } = run(joinAt as number);

    expect(log.divergences).toEqual([]);
    expect(log.violations).toEqual([]);
    expect(log.devMessages).toEqual([]);

    // A parks with its leftover capacity; B is spent.
    expect(log.terminals.get(A)).toEqual([{ kind: 'toHolding', slot: 0, target: { x: 101, y: 901 } }]);
    expect(log.terminals.get(B)).toEqual([{ kind: 'consumed' }]);

    expect(log.preSettle).toBeDefined();
    expectConverged(log.preSettle!.view, log.preSettle!.truth);
    expectConverged(view, truth);
  });
});

test('cadence independence: joining early and joining late give the same result', () => {
  const early = run(1000);
  const late = run(3000);

  expect(late.truth.holding).toEqual(early.truth.holding);
  expect(late.truth.status).toEqual(early.truth.status);
  expect(late.truth.pixels.map((p) => p.cleared)).toEqual(early.truth.pixels.map((p) => p.cleared));
  for (const id of [A, B]) {
    expect(late.log.terminals.get(id)).toEqual(early.log.terminals.get(id));
  }
});

describe('Holding relaunch while another Pal is flying toward Holding', () => {
  // Every blue/red launch misses (no matching pixels), so each one parks.
  const RELAUNCH: LevelDefinition = {
    id: 9721, title: 'Relaunch slots', themeId: 'test', difficulty: 'easy', holdingCapacity: 3, ruleset: 'coreV2',
    pixelArt: ['WWW', 'WWW', 'WWW'],
    tunnels: [
      [{ color: 'blue', capacity: 1 }],
      [{ color: 'red', capacity: 1 }],
      [{ color: 'white', capacity: 1 }],
      [{ color: 'white', capacity: 9 }],
    ],
  };
  const BLUE = 'L9721-t0-c0';
  const RED = 'L9721-t1-c0';

  test('the relaunched Pal vacates its slot; the in-flight Pal takes the truth slot; converged before settle', () => {
    const s = mountSession(RELAUNCH);
    // Blue parks (slot 0, landed by ~7s). Red launches at 8s; blue is
    // relaunched at 9s while red is still on the rail.
    const log = drive(s.get, [
      { at: 0, tunnel: 'tunnel-0' },
      { at: 8000, tunnel: 'tunnel-1' },
      { at: 9000, held: BLUE },
    ]);
    const truth = s.get().engineState;
    s.unmount();
    expect(truth.holding.map((c) => c.id)).toEqual([RED, BLUE]);
    expect(log.terminals.get(RED)).toEqual([{ kind: 'toHolding', slot: 0, target: { x: 101, y: 901 } }]);
    // Blue: parked once from the tunnel, then again after its relaunch.
    expect(log.terminals.get(BLUE)).toEqual([
      { kind: 'toHolding', slot: 0, target: { x: 101, y: 901 } },
      { kind: 'toHolding', slot: 1, target: { x: 165, y: 901 } },
    ]);
    expect(log.violations).toEqual([]);
    expect(log.devMessages).toEqual([]);
    expectConverged(log.preSettle!.view, log.preSettle!.truth);
  });
});
