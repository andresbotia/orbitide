/**
 * Level 7 "BLUE-2 disappears" — presentation regression at the video cadence.
 *
 * Launches at the video's times (1.0 / 2.0 / 2.8 / 4.0 / 7.4s): blue26, cyan18,
 * cyan13, blue10 ("BLUE-2"), green14. Every launch after the first joins the
 * open epoch.
 *
 * The original bug: a join re-resolved the earlier charges, BLUE-2 lost the
 * presented slot it had reserved, took an off-screen fallback and vanished;
 * `settleAll` then snapped the tray back to truth. This file keeps that cadence
 * and guards the presentation contract under joins: every Pal reaches exactly
 * one explicit terminal that matches engine truth, presented Holding never
 * contradicts truth, no presented event is ever rewritten, and the view
 * converges BEFORE `settleAll` — so `settleAll` is never what makes it correct.
 *
 * Nothing overflows at this cadence. It used to — the tray filled and green14
 * was rejected — but that outcome was produced by a Core V2 engine bug (a
 * joining Pal lost every attack line an earlier Pal had already used; see
 * `join-settle-equivalence.test.ts`). The overflow → reject-at-GateTerminal
 * regression now lives on a synthetic fixture in
 * `session.concurrent-stress.test.ts`, independent of campaign content.
 *
 * CONTENT-COUPLED: this drives real Level 7 content. Terminals, Holding and
 * convergence are derived from engine truth; "no Pal rejects" and "status
 * playing" are facts of the current authoring. If a re-author changes them,
 * re-derive or retire this file — never bend the engine to keep it green.
 */
import { createGame } from '@/game/engine/createGame';
import { epochHasCapacity } from '@/game/engine/epoch';
import { resolveAction } from '@/game/engine/resolveLaunch';
import { requireLevel } from '@/game/levels/levels';
import type { GameState } from '@/game/engine/types';
import { drive, expectConverged, mountSession, SLOT_POINTS, type DriveLog, type TerminalView } from './sessionDriver';

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

/** The one terminal truth implies for a charge — the same rule `terminalFor` uses. */
function expectedTerminal(truth: GameState, chargeId: string): TerminalView {
  const slot = truth.holding.findIndex((c) => c.id === chargeId);
  if (slot >= 0) return { kind: 'toHolding', slot, target: SLOT_POINTS[slot] };
  const charge = truth.activeCharges.find((c) => c.id === chargeId);
  return charge && charge.remainingCapacity > 0 ? { kind: 'reject' } : { kind: 'consumed' };
}

beforeEach(() => {
  jest.useFakeTimers({ now: 0 });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => { jest.useRealTimers(); });

test('engine truth at the video cadence: every later launch joins, and every Pal that needs a slot gets one', () => {
  let truth = createGame(requireLevel(7));
  for (const [n, id] of ['tunnel-0', 'tunnel-1', 'tunnel-1', 'tunnel-0', 'tunnel-2'].entries()) {
    const out = resolveAction(truth, { kind: 'tunnel', id, join: n > 0 && epochHasCapacity(truth) });
    expect(out.accepted).toBe(true);
    expect(out.joinedEpoch).toBe(n > 0);
    truth = out.state;
  }
  expect(truth.status).toBe('playing');
  for (const c of truth.activeCharges.filter((a) => a.landed === 'holding')) {
    expect({ id: c.id, kept: truth.holding.some((h) => h.id === c.id) }).toEqual({ id: c.id, kept: true });
  }
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
  });

  test('1. all five Pals launch at the video cadence, into one epoch', () => {
    expect(log.launched).toEqual([BLUE26, CYAN18, CYAN13, BLUE10, GREEN14]);
    expect(finalTruth.epoch?.launches.map((l) => l.chargeId)).toEqual(log.launched);
  });

  test('2. every launched Pal reaches exactly one terminal, and it is the one engine truth implies', () => {
    for (const id of log.launched) {
      expect({ id, n: log.terminals.get(id)?.length ?? 0 }).toEqual({ id, n: 1 });
      expect({ id, terminal: log.terminals.get(id)![0] })
        .toEqual({ id, terminal: expectedTerminal(finalTruth, id) });
    }
  });

  test('3. no Pal rejects at this cadence, and the final status is playing', () => {
    const rejects = [...log.terminals].filter(([, ts]) => ts.some((t) => t.kind === 'reject')).map(([id]) => id);
    expect(rejects).toEqual([]);
    expect(finalTruth.status).toBe('playing');
    expect(finalView.status).toBe('playing');
    expect(log.statusAtMs).toBeUndefined();
  });

  test('4. Holding matches truth: no slotless / shared-slot / fallback flight, nothing shown that truth does not keep', () => {
    // The driver flags slotless, shared-slot and off-slot-point flights and any
    // presented Holding that is not a prefix of truth, while flights are live.
    expect(log.violations).toEqual([]);
    const kept = new Set(finalTruth.holding.map((c) => c.id));
    for (const snap of log.holdingTimeline) {
      for (const shown of snap.view) {
        expect({ shown, kept: kept.has(shown.split(':')[0]!) }).toEqual({ shown, kept: true });
      }
    }
    expect(finalView.holding.map((c) => [c.id, c.capacity])).toEqual(finalTruth.holding.map((c) => [c.id, c.capacity]));
  });

  test('5. no already-presented event changes at the video cadence', () => {
    expect(log.divergences).toEqual([]);
  });

  test('6. DEV lifecycle asserts stay silent (no slotless, vanished, deferred or untruthful landings)', () => {
    expect(log.devMessages).toEqual([]);
  });

  test('7. converged BEFORE settleAll, and settleAll changes nothing observable', () => {
    expect(log.preSettle).toBeDefined();
    expectConverged(log.preSettle!.view, log.preSettle!.truth);
    expectConverged(finalView, finalTruth);
    // `settleAll` ran after the last flight completed; if it had to fix
    // anything, the view it left would differ from the pre-settle view.
    expectConverged(log.preSettle!.view, finalView);
  });
});
