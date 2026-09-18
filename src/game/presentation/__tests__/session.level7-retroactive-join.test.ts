/**
 * Level 7 "BLUE-2 disappears" — exact regression.
 *
 * Launches at the video's times (1.0 / 2.0 / 2.8 / 4.0 / 7.4s): blue26, cyan18,
 * cyan13, blue10 ("BLUE-2"), green14. Every launch after the first joins the
 * open epoch, and each join re-resolves the earlier charges. Engine truth:
 * blue26 consumed, Holding [cyan18:2, cyan13:8, blue10:2], green14 overflows.
 */
import { createGame } from '@/game/engine/createGame';
import { epochHasCapacity } from '@/game/engine/epoch';
import { resolveAction } from '@/game/engine/resolveLaunch';
import { requireLevel } from '@/game/levels/levels';
import { drive, expectConverged, mountSession, SLOT_POINTS, terminalOf, type DriveLog } from './sessionDriver';

jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) } }));
jest.mock('@/game/feedback', () => ({ feedback: { emit: jest.fn(), cancelPending: jest.fn() } }));
jest.mock('@/game/hapticArbiter', () => ({ registerHit: jest.fn(), cancelHits: jest.fn() }));

const BLUE26 = 'L7-t0-c0';
const CYAN18 = 'L7-t1-c0';
const CYAN13 = 'L7-t1-c1';
const BLUE10 = 'L7-t0-c1';
const GREEN14 = 'L7-t2-c0';

const VIDEO = [
  { at: 1000, tunnel: 'tunnel-0' },
  { at: 2000, tunnel: 'tunnel-1' },
  { at: 2800, tunnel: 'tunnel-1' },
  { at: 4000, tunnel: 'tunnel-0' },
  { at: 7400, tunnel: 'tunnel-2' },
];

beforeEach(() => {
  jest.useFakeTimers({ now: 0 });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => { jest.useRealTimers(); });

test('engine truth after launch 5: green is the overflow Pal, BLUE-2 is a legitimate occupant', () => {
  let truth = createGame(requireLevel(7));
  for (const [n, id] of ['tunnel-0', 'tunnel-1', 'tunnel-1', 'tunnel-0', 'tunnel-2'].entries()) {
    const out = resolveAction(truth, { kind: 'tunnel', id, join: n > 0 && epochHasCapacity(truth) });
    expect(out.accepted).toBe(true);
    truth = out.state;
  }
  expect(truth.holding.map((c) => [c.id, c.capacity])).toEqual([[CYAN18, 2], [CYAN13, 8], [BLUE10, 2]]);
  expect(truth.status).toBe('lost');
  const charges = new Map(truth.activeCharges.map((c) => [c.id, c]));
  expect(charges.get(BLUE26)!.landed).toBe('consumed');
  expect(charges.get(GREEN14)!.landed).toBe('holding');
  expect(truth.holding.some((c) => c.id === GREEN14)).toBe(false);
});

describe('Level 7 video cadence through the real session', () => {
  let log: DriveLog;
  let finalView: ReturnType<ReturnType<typeof mountSession>['get']>['state'];
  let finalTruth: typeof finalView;

  beforeAll(() => {
    jest.useFakeTimers({ now: 0 });
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const s = mountSession(requireLevel(7));
    log = drive(s.get, VIDEO);
    finalView = s.get().state;
    finalTruth = s.get().engineState;
    s.unmount();
    // §5 evidence: the pure observable-history comparison at each join.
    console.log(`[L7 observable-history audit] ${log.divergences.length === 0 ? 'no presented event changed'
      : log.divergences.map((d) => `${d.chargeId}@${d.atMs}ms(t=${d.presentedMs}): ${d.detail}`).join('\n')}`);
  });

  test('1. truth after launch 5', () => {
    expect(log.launched).toEqual([BLUE26, CYAN18, CYAN13, BLUE10, GREEN14]);
    expect(finalTruth.holding.map((c) => [c.id, c.capacity])).toEqual([[CYAN18, 2], [CYAN13, 8], [BLUE10, 2]]);
    expect(finalTruth.status).toBe('lost');
  });

  test('2. only GREEN rejects; BLUE-2 is toHolding with a valid slot', () => {
    const rejects = [...log.terminals].filter(([, ts]) => ts.some((t) => t.kind === 'reject')).map(([id]) => id);
    expect(rejects).toEqual([GREEN14]);
    const blue2 = log.terminals.get(BLUE10)!;
    expect(blue2).toEqual([{ kind: 'toHolding', slot: 2, target: SLOT_POINTS[2] }]);
  });

  test('3. every launched Pal terminates exactly once as consumed / toHolding / reject', () => {
    for (const id of log.launched) {
      expect({ id, n: log.terminals.get(id)?.length ?? 0 }).toEqual({ id, n: 1 });
    }
    expect(log.terminals.get(BLUE26)).toEqual([{ kind: 'consumed' }]);
    expect(log.terminals.get(CYAN18)).toEqual([{ kind: 'toHolding', slot: 0, target: SLOT_POINTS[0] }]);
    expect(log.terminals.get(CYAN13)).toEqual([{ kind: 'toHolding', slot: 1, target: SLOT_POINTS[1] }]);
  });

  test('4+5. no slotless / shared-slot / fallback flights; presented Holding never contradicts truth', () => {
    expect(log.violations).toEqual([]);
    // blue26 must never be shown landing (with 3 or anything else).
    for (const snap of log.holdingTimeline) expect(snap.view.some((l) => l.startsWith(BLUE26))).toBe(false);
  });

  test('6. the reject completes a full lap, bursts at GateTerminal, Holding unchanged across the burst', () => {
    const green = log.lastPass.get(GREEN14)!;
    expect(terminalOf(green).kind).toBe('reject');
    expect(green.endProgress).toBe(1);
    const burst = log.rejectHolding.get(GREEN14)!;
    expect(burst.after).toEqual(burst.before);
  });

  test('7. presented status stays playing until the reject fail event', () => {
    const green = log.lastPass.get(GREEN14)!;
    const fail = green.events.find((e) => e.kind === 'fail')!;
    expect(fail).toBeDefined();
    expect(fail.at).toBeGreaterThanOrEqual(green.orbitEndAt);
    expect(log.statusAtMs).toBeGreaterThanOrEqual(7400 + fail.at);
  });

  test('8. converged at quiescence BEFORE settleAll — no tray flip, no pixel jump at the modal', () => {
    expect(log.preSettle).toBeDefined();
    expectConverged(log.preSettle!.view, log.preSettle!.truth);
    expectConverged(finalView, finalTruth);
  });

  test('9. observable-history audit (evidence): no already-presented event changes at the video cadence', () => {
    expect(log.divergences).toEqual([]);
  });

  test('DEV lifecycle asserts stay silent (no slotless, vanished, deferred or untruthful landings)', () => {
    expect(log.devMessages).toEqual([]);
  });
});
