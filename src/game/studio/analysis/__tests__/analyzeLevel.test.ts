import { SolverCancelled } from '@/game/engine/solver';
import { LEVEL_DEFINITIONS } from '../../../levels/levelDefinitions';
import { analyzeLevel, type AnalysisPhase } from '../analyzeLevel';
import {
  BRANCHING_EASY, HOLDING_MEDIUM, NARROW_HARD, OBVIOUS_EASY, SOLVER_HEAVY, UNSOLVABLE,
} from '../__fixtures__/levels';

const stable = (a: Awaited<ReturnType<typeof analyzeLevel>>) => {
  const { solveDurationMs, ...rest } = a;
  return rest;
};

test('analysis is deterministic (deep-equal, timing excluded)', async () => {
  const a = await analyzeLevel(OBVIOUS_EASY, { now: () => 0 });
  const b = await analyzeLevel(OBVIOUS_EASY, { now: () => 0 });
  expect(stable(a)).toEqual(stable(b));
  expect(a.solveDurationMs).toBe(0); // injected clock
}, 60_000);

describe('fixture difficulty tiers + warnings are stable', () => {
  test('OBVIOUS_EASY → easy, trivial + unused-queue warnings', async () => {
    const a = await analyzeLevel(OBVIOUS_EASY, { now: () => 0 });
    expect(a.suggestedDifficulty).toBe('easy');
    expect(a.difficultyScore).toBeLessThanOrEqual(6);
    expect(a.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(['TRIVIAL_FIRST_MOVES', 'UNUSED_QUEUE_ENTRIES']),
    );
  }, 60_000);

  test('BRANCHING_EASY → easy, three viable first moves', async () => {
    const a = await analyzeLevel(BRANCHING_EASY, { now: () => 0 });
    expect(a.suggestedDifficulty).toBe('easy');
    expect(a.firstMoveAnalysis).toHaveLength(3);
    expect(a.firstMoveAnalysis.every((m) => m.classification === 'VIABLE')).toBe(true);
    expect(a.viableFirstMoves).toBe(3);
  }, 60_000);

  test('HOLDING_MEDIUM → medium, real Holding pressure, no mismatch', async () => {
    const a = await analyzeLevel(HOLDING_MEDIUM, { now: () => 0 });
    expect(a.suggestedDifficulty).toBe('medium');
    expect(a.concurrentResult.minWinningPeak).toBeGreaterThanOrEqual(1);
    expect(a.difficulty.mismatch).toBe(false);
  }, 60_000);

  test('NARROW_HARD → suggested easy, low-branching + mismatch warnings', async () => {
    const a = await analyzeLevel(NARROW_HARD, { now: () => 0 });
    expect(a.authoredDifficulty).toBe('hard');
    expect(a.suggestedDifficulty).toBe('easy');
    const codes = a.warnings.map((w) => w.code);
    expect(codes).toContain('LOW_BRANCHING_HARD_LEVEL');
    expect(codes).toContain('DIFFICULTY_MISMATCH');
    expect(a.warnings.find((w) => w.code === 'DIFFICULTY_MISMATCH')?.severity).toBe('warn');
    expect(a.firstMoveAnalysis).toHaveLength(1);
  }, 60_000);

  test('UNSOLVABLE → solvable false, no crash, dead-end first moves', async () => {
    const a = await analyzeLevel(UNSOLVABLE, { now: () => 0 });
    expect(a.solvable).toBe(false);
    expect(a.winningWitness).toBeNull();
    expect(a.firstMoveAnalysis.every((m) => m.classification === 'DEAD-END')).toBe(true);
    expect(a.warnings.map((w) => w.code)).toContain('EARLY_DEADLOCK');
  }, 60_000);

  test('SOLVER_HEAVY explores materially more states than an easy fixture', async () => {
    const heavy = await analyzeLevel(SOLVER_HEAVY, { now: () => 0 });
    const easy = await analyzeLevel(OBVIOUS_EASY, { now: () => 0 });
    expect(heavy.exploredNodes).toBeGreaterThan(easy.exploredNodes * 20);
    expect(heavy.solvable).toBe(true);
  }, 120_000);
});

test('phase callback fires once per phase, in order', async () => {
  const phases: AnalysisPhase[] = [];
  await analyzeLevel(OBVIOUS_EASY, { now: () => 0, onPhase: (p) => phases.push(p) });
  expect(phases).toEqual([
    'sequential-solve', 'concurrent-solve', 'winning-trace', 'failing-trace', 'first-moves', 'scoring',
  ]);
}, 60_000);

test('a pre-cancelled signal rejects with SolverCancelled', async () => {
  await expect(analyzeLevel(OBVIOUS_EASY, { signal: { cancelled: true } })).rejects.toBeInstanceOf(SolverCancelled);
});

test('a tiny node cap yields an incomplete analysis — solvable "unknown", not "no"', async () => {
  const a = await analyzeLevel(LEVEL_DEFINITIONS[8]!, { nodeCap: 3, now: () => 0 });
  expect(a.complete).toBe(false);
  expect(a.solvable).toBe('unknown');
  expect(a.limitations.length).toBeGreaterThan(0);
  expect(a.limitations.some((l) => /unknown/i.test(l))).toBe(true);
});

test('sequential vs concurrent comparison is populated for the campaign', async () => {
  const a = await analyzeLevel(LEVEL_DEFINITIONS[18]!, { now: () => 0 }); // L19 Red Fox — concurrency shortens the line
  expect(a.comparison.sequentialSolvable).toBe(true);
  expect(a.comparison.concurrentSolvable).toBe(true);
  expect(a.comparison.winLengthDelta).toBeGreaterThanOrEqual(1);
  expect(a.comparison.verdict).not.toBe('equivalent');
}, 120_000);

test('Levels 1–10 all analyse as solvable (solver still valid)', async () => {
  for (const def of LEVEL_DEFINITIONS) {
    const a = await analyzeLevel(def, { now: () => 0 });
    expect(a.solvable).toBe(true);
    expect(a.winningWitness).not.toBeNull();
    expect(a.shortestWinningLength).toBeGreaterThan(0);
  }
}, 300_000);
