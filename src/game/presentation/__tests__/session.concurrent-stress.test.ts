/**
 * Concurrent stress (Test C, permanent): random 5-Pal cadences on real
 * campaign levels. Whenever no join contradicted presented history, the
 * session must converge to truth before settleAll, every Pal must terminate
 * exactly once, and no DEV lifecycle assert may fire.
 *
 * Plus the overflow → reject-at-GateTerminal regression under a join, on a
 * synthetic fixture (bottom of file).
 */
import type { GameState, LevelDefinition } from '@/game/engine/types';
import { requireLevel } from '@/game/levels/levels';
import { progressAt } from '../motion';
import {
  drive, expectConverged, mountSession, SLOT_POINTS, terminalOf, type DriveLaunch, type DriveLog,
} from './sessionDriver';

jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) } }));
jest.mock('@/game/feedback', () => ({ feedback: { emit: jest.fn(), cancelPending: jest.fn() } }));
jest.mock('@/game/hapticArbiter', () => ({ registerHit: jest.fn(), cancelHits: jest.fn() }));

beforeEach(() => {
  jest.useFakeTimers({ now: 0 });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => { jest.useRealTimers(); });

function schedule(seed: number, tunnels: number): DriveLaunch[] {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  let at = 0;
  return Array.from({ length: 5 }, () => {
    at += 150 + Math.floor(rnd() * 1800);
    return { at, tunnel: `tunnel-${Math.floor(rnd() * tunnels)}` };
  });
}

const CASES: [number, number][] = [];
for (const level of [3, 5, 7, 9, 12]) for (const seed of [1, 2, 3, 4]) CASES.push([level, seed]);

test.each(CASES)('level %i, seed %i', (levelId, seed) => {
  const level = requireLevel(levelId);
  const s = mountSession(level);
  const plan = schedule(seed * 7919 + levelId, level.tunnels.length).filter((l) => {
    const t = level.tunnels[Number(l.tunnel!.split('-')[1])];
    return t && t.length > 0;
  });
  const log = drive(s.get, plan);
  s.unmount();
  const lifecycle = log.devMessages.filter((m) => m.startsWith('[PA_LIFECYCLE]'));
  expect(lifecycle).toEqual([]);
  for (const id of log.launched) expect({ id, n: log.terminals.get(id)?.length ?? 0 }).toEqual({ id, n: 1 });
  if (log.divergences.length === 0) {
    expect(log.violations.filter((v) => !v.includes('rejected'))).toEqual([]);
    expectConverged(log.preSettle!.view, log.preSettle!.truth);
  }
});

/**
 * Overflow reject while another Pal is on the rail — synthetic, independent of
 * campaign content.
 *
 *   B B G     Three yellow1 Pals (no yellow on the board) fire nothing and park,
 *   W W G     filling Holding 3/3. Later white2 launches and clears both whites
 *             (consumed). While it is still on the rail blue5 JOINS, clears the
 *             two blues and still holds 3: it needs a slot, Holding is full, so
 *             it is the overflow Pal. The greens keep the level from being won.
 *
 * The overflow Pal must fly its full lap, burst at GateTerminal with Holding
 * untouched, never land, and carry the loss beat — which is the only thing that
 * may present the loss.
 */
const OVERFLOW_LEVEL: LevelDefinition = {
  id: 9840, title: 'fixture-overflow-reject-under-join', themeId: 'test', difficulty: 'easy',
  holdingCapacity: 3, ruleset: 'coreV2',
  pixelArt: ['BBG', 'WWG'],
  tunnels: [
    [{ color: 'yellow', capacity: 1 }, { color: 'yellow', capacity: 1 }, { color: 'yellow', capacity: 1 }],
    [{ color: 'white', capacity: 2 }],
    [{ color: 'blue', capacity: 5 }],
  ],
};
const PARKERS = ['L9840-t0-c0', 'L9840-t0-c1', 'L9840-t0-c2'];
const CONSUMER = 'L9840-t1-c0';
const OVERFLOW = 'L9840-t2-c0';
const OVERFLOW_AT = 9300;
const OVERFLOW_CADENCE: DriveLaunch[] = [
  { at: 500, tunnel: 'tunnel-0' },
  { at: 700, tunnel: 'tunnel-0' },
  { at: 900, tunnel: 'tunnel-0' },
  // The parkers have landed by now; white2 opens a fresh epoch…
  { at: 9000, tunnel: 'tunnel-1' },
  // …and blue5 joins it while white2 is still visibly on the rail.
  { at: OVERFLOW_AT, tunnel: 'tunnel-2' },
];

describe('overflow reject under a join (synthetic)', () => {
  let log: DriveLog;
  let finalView: GameState;
  let finalTruth: GameState;
  const parked = PARKERS.map((id) => `${id}:1`);

  beforeAll(() => {
    jest.useFakeTimers({ now: 0 });
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const s = mountSession(OVERFLOW_LEVEL);
    log = drive(s.get, OVERFLOW_CADENCE);
    finalView = s.get().state;
    finalTruth = s.get().engineState;
    s.unmount();
  });

  test('1+2. Holding is already full when the overflow Pal is legally launched, joining a Pal on the rail', () => {
    const atLaunch = log.holdingTimeline.filter((h) => h.atMs < OVERFLOW_AT).at(-1)!;
    expect(atLaunch.view).toEqual(parked);
    expect(atLaunch.truth).toEqual(parked);
    expect(log.launched).toEqual([...PARKERS, CONSUMER, OVERFLOW]);
    expect(log.violations).toEqual([]); // includes "launch … rejected"
    // One epoch holds white2 and blue5: the overflow launch was a join.
    expect(finalTruth.activeCharges.map((c) => c.id)).toEqual([CONSUMER, OVERFLOW]);
  });

  test('3. the overflow Pal cannot fully consume, and truth does not keep it', () => {
    const res = finalTruth.activeCharges.find((c) => c.id === OVERFLOW)!;
    expect(res.encounters.length).toBeGreaterThan(0);
    expect(res.remainingCapacity).toBeGreaterThan(0);
    expect(res.landed).toBe('holding');
    expect(finalTruth.holding.map((c) => c.id)).toEqual(PARKERS);
    expect(finalTruth.status).toBe('lost');
  });

  test('4+5+6. it completes the full visual lap, reaches GateTerminal and bursts there', () => {
    const pass = log.lastPass.get(OVERFLOW)!;
    expect(terminalOf(pass)).toEqual({ kind: 'reject' });
    expect(pass.endProgress).toBe(1);
    // Rail position when it leaves the orbit is lap-progress 1: the bottom-centre
    // insertion point, i.e. GateTerminal.
    expect(progressAt(pass, pass.orbitEndAt)).toBe(1);
    const burst = pass.events.find((e) => e.kind === 'chargeConsumed')!;
    expect(burst.at).toBe(pass.orbitEndAt);
    expect(pass.landingAt).toBeGreaterThan(pass.orbitEndAt);
    expect(log.terminals.get(OVERFLOW)).toEqual([{ kind: 'reject' }]);
  });

  test('7+8. Holding occupants are unchanged across the burst, and it never lands', () => {
    const burst = log.rejectHolding.get(OVERFLOW)!;
    expect(burst.before).toEqual(parked);
    expect(burst.after).toEqual(parked);
    // Presented Holding never changes after the overflow launch.
    expect(log.holdingTimeline.filter((h) => h.atMs >= OVERFLOW_AT)).toEqual([]);
    expect(finalView.holding.map((c) => c.id)).toEqual(PARKERS);
    expect(log.lastPass.get(OVERFLOW)!.events.some((e) => e.kind === 'holdingLanded')).toBe(false);
  });

  test('9+10. presented status stays playing through the reject beat; the loss is presented only after it', () => {
    const pass = log.lastPass.get(OVERFLOW)!;
    const fail = pass.events.find((e) => e.kind === 'fail')!;
    expect(fail).toBeDefined();
    expect(fail.at).toBeGreaterThanOrEqual(pass.landingAt); // after the burst completes
    expect(log.statusAtMs).toBeGreaterThanOrEqual(OVERFLOW_AT + fail.at);
    // The consumed Pal finishes first and does not carry the loss.
    expect(log.lastPass.get(CONSUMER)!.events.some((e) => e.kind === 'fail')).toBe(false);
    expect(finalView.status).toBe('lost');
  });

  test('every Pal terminates exactly once with the terminal truth implies', () => {
    expect(Object.fromEntries(log.terminals)).toEqual({
      [PARKERS[0]!]: [{ kind: 'toHolding', slot: 0, target: SLOT_POINTS[0] }],
      [PARKERS[1]!]: [{ kind: 'toHolding', slot: 1, target: SLOT_POINTS[1] }],
      [PARKERS[2]!]: [{ kind: 'toHolding', slot: 2, target: SLOT_POINTS[2] }],
      [CONSUMER]: [{ kind: 'consumed' }],
      [OVERFLOW]: [{ kind: 'reject' }],
    });
  });

  test('no presented-history divergence, no DEV lifecycle assert, converged before settleAll', () => {
    expect(log.divergences).toEqual([]);
    expect(log.devMessages).toEqual([]);
    expect(log.preSettle).toBeDefined();
    expectConverged(log.preSettle!.view, log.preSettle!.truth);
    expectConverged(finalView, finalTruth);
  });
});
