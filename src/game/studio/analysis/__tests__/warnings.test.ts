import type { Trace } from '@/game/engine/trace';
import { WARNING_THRESHOLDS, deriveWarnings, type WarningContext } from '../warnings';
import type { FirstMoveAnalysis, SeqConComparison, SolveSummary } from '../types';

const summary = (o: Partial<SolveSummary> = {}): SolveSummary => ({
  mode: 'metrics', solved: true, complete: true, nodeCapHit: false, length: 6,
  minWinningPeak: 1, maxHolding: 1, viableFirstMoves: 3, totalFirstMoves: 3,
  maxActive: 2, nodes: 500, avgBranching: 2.5, lossProbability: 0.1, heldLaunches: 1,
  failPathLength: 5, ...o,
});

const comparison = (o: Partial<SeqConComparison> = {}): SeqConComparison => ({
  sequentialSolvable: true, concurrentSolvable: true, solvabilityChanged: false,
  winLengthDelta: 0, peakHoldingDelta: 0, viableFirstMoveDelta: 0, maxActiveDelta: 0,
  nodeDelta: 0, lossDelta: 0, verdict: 'equivalent', ...o,
});

const firstMove = (o: Partial<FirstMoveAnalysis> = {}): FirstMoveAnalysis => ({
  action: { kind: 'tunnel', id: 'tunnel-0' }, label: 'Tunnel A', source: 'tunnel', tunnelIndex: 0,
  color: 'white', startingCapacity: 4, solvableAfter: true, remainingWinLength: 5,
  // Not "calm": loss above the trivial threshold, so the default context is healthy.
  peakHolding: 1, minPeakHolding: 1, heldRelaunches: 1, maxActive: 2, lossAfter: 0.2,
  classification: 'VIABLE', reasons: [], ...o,
});

const fakeTrace = (unusedCapacity: number, unusedChargeIds: string[] = []): Trace =>
  ({ unusedCapacity, unusedChargeIds } as unknown as Trace);

const ctx = (o: Partial<WarningContext> = {}): WarningContext => ({
  authoredDifficulty: 'medium', suggestedDifficulty: 'medium', mismatchTiers: 0,
  solvable: true, complete: true,
  firstMoveAnalysis: [firstMove(), firstMove(), firstMove()],
  viableFirstMoves: 3,
  seq: summary({ mode: 'sequential-compat' }), con: summary(),
  comparison: comparison(),
  holdingPressure: {
    timeline: [1, 1], holdingCapacity: 3, maxHolding: 1, stepsAtOrAbove2: 0,
    fractionAtOrAbove2: 0, manualRelaunches: 1, chargesEnteringHolding: 1, longestHeldDurationSteps: 1,
  },
  winTrace: fakeTrace(0),
  failWitnessLength: 5,
  avgBranching: 2.5, nodes: 500, totalAuthoredCapacity: 20, ...o,
});

const codes = (c: WarningContext) => deriveWarnings(c).map((w) => w.code);

test('a healthy medium level produces no warnings', () => {
  expect(deriveWarnings(ctx())).toEqual([]);
});

test('TRIVIAL_FIRST_MOVES: ≥90% calm viable first moves (≥2 moves)', () => {
  const calm = firstMove({ classification: 'VIABLE', peakHolding: 0, lossAfter: 0 });
  expect(codes(ctx({ firstMoveAnalysis: [calm, calm, calm] }))).toContain('TRIVIAL_FIRST_MOVES');
  // a single forced first move is NOT "trivial"
  expect(codes(ctx({ firstMoveAnalysis: [calm] }))).not.toContain('TRIVIAL_FIRST_MOVES');
});

test('NO_HOLDING_PRESSURE: authored medium+, best line never uses Holding', () => {
  expect(codes(ctx({ con: summary({ minWinningPeak: 0, heldLaunches: 0 }) }))).toContain('NO_HOLDING_PRESSURE');
  expect(codes(ctx({ authoredDifficulty: 'easy', con: summary({ minWinningPeak: 0, heldLaunches: 0 }) })))
    .not.toContain('NO_HOLDING_PRESSURE');
});

test('NARROW_EASY_LEVEL: easy level, ≤1 viable first move', () => {
  expect(codes(ctx({ authoredDifficulty: 'easy', viableFirstMoves: 1, firstMoveAnalysis: [firstMove()] })))
    .toContain('NARROW_EASY_LEVEL');
});

test('LOW_BRANCHING_HARD_LEVEL: hard+ level with near-linear graph', () => {
  expect(codes(ctx({ authoredDifficulty: 'hard', avgBranching: 1.2 }))).toContain('LOW_BRANCHING_HARD_LEVEL');
  expect(codes(ctx({ authoredDifficulty: 'medium', avgBranching: 1.2 }))).not.toContain('LOW_BRANCHING_HARD_LEVEL');
});

test('CONCURRENCY_TRIVIALIZES_LEVEL: concurrency shortens by ≥2, or is required', () => {
  expect(codes(ctx({ comparison: comparison({ winLengthDelta: WARNING_THRESHOLDS.concurrencyTrivializeLen }) })))
    .toContain('CONCURRENCY_TRIVIALIZES_LEVEL');
  expect(codes(ctx({
    comparison: comparison({ verdict: 'concurrency-required', sequentialSolvable: false }),
  }))).toContain('CONCURRENCY_TRIVIALIZES_LEVEL');
});

test('CONCURRENCY_INCREASES_RISK: concurrency raises loss / Holding', () => {
  expect(codes(ctx({ comparison: comparison({ lossDelta: -WARNING_THRESHOLDS.concurrencyRiskLoss }) })))
    .toContain('CONCURRENCY_INCREASES_RISK');
  expect(codes(ctx({ con: summary({ maxHolding: 3 }), seq: summary({ mode: 'sequential-compat', maxHolding: 2 }) })))
    .toContain('CONCURRENCY_INCREASES_RISK');
});

test('EXCESSIVE_UNUSED_CAPACITY + UNUSED_QUEUE_ENTRIES', () => {
  const c = codes(ctx({ winTrace: fakeTrace(10, ['L1-t2-c0']), totalAuthoredCapacity: 20 }));
  expect(c).toContain('EXCESSIVE_UNUSED_CAPACITY'); // 10/20 = 0.5 ≥ 0.4
  expect(c).toContain('UNUSED_QUEUE_ENTRIES');
});

test('SOLVER_NODE_EXPLOSION at the node threshold', () => {
  expect(codes(ctx({ nodes: WARNING_THRESHOLDS.nodeExplosion }))).toContain('SOLVER_NODE_EXPLOSION');
  expect(codes(ctx({ nodes: WARNING_THRESHOLDS.nodeExplosion - 1 }))).not.toContain('SOLVER_NODE_EXPLOSION');
});

test('DIFFICULTY_MISMATCH: warn at ≥2 tiers, info at exactly 1', () => {
  const two = deriveWarnings(ctx({ mismatchTiers: 2, suggestedDifficulty: 'extreme', authoredDifficulty: 'hard' }))
    .find((w) => w.code === 'DIFFICULTY_MISMATCH');
  expect(two?.severity).toBe('warn');
  const one = deriveWarnings(ctx({ mismatchTiers: 1, suggestedDifficulty: 'hard' }))
    .find((w) => w.code === 'DIFFICULTY_MISMATCH');
  expect(one?.severity).toBe('info');
  expect(deriveWarnings(ctx({ mismatchTiers: 0 })).some((w) => w.code === 'DIFFICULTY_MISMATCH')).toBe(false);
});

test('NO_FAIL_PATH: authored medium+, complete, no failing line', () => {
  expect(codes(ctx({ failWitnessLength: null }))).toContain('NO_FAIL_PATH');
  expect(codes(ctx({ authoredDifficulty: 'easy', failWitnessLength: null }))).not.toContain('NO_FAIL_PATH');
  expect(codes(ctx({ failWitnessLength: null, complete: false }))).not.toContain('NO_FAIL_PATH');
});

test('EARLY_DEADLOCK: shortest fail line ≤ 2 moves', () => {
  expect(codes(ctx({ failWitnessLength: WARNING_THRESHOLDS.earlyDeadlockLen }))).toContain('EARLY_DEADLOCK');
  expect(codes(ctx({ failWitnessLength: WARNING_THRESHOLDS.earlyDeadlockLen + 1 }))).not.toContain('EARLY_DEADLOCK');
});

test('every warning is advisory (info | warn) and deterministic', () => {
  const c = ctx({ authoredDifficulty: 'hard', avgBranching: 1.0, mismatchTiers: -2, suggestedDifficulty: 'easy', failWitnessLength: 1, nodes: 99999 });
  const a = deriveWarnings(c);
  const b = deriveWarnings(c);
  expect(a).toEqual(b);
  for (const w of a) expect(['info', 'warn']).toContain(w.severity);
});
