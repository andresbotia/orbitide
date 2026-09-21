import { createGame } from '../../engine/createGame';
import { applyActionWithArrivals } from '../../engine/holdingArrival';
import { solve } from '../../engine/solver';
import type { GameAction } from '../../engine/actions';
import type { LevelDefinition } from '../../engine/types';
import { analyzeLevel } from '../../studio/analysis/analyzeLevel';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';

const WORLD_1 = LEVEL_DEFINITIONS.filter((level) => level.id >= 1 && level.id <= 10);

function replay(level: LevelDefinition, moves: GameAction[]) {
  let state = createGame(level);
  for (const action of moves) {
    const outcome = applyActionWithArrivals(state, action);
    expect(outcome.accepted).toBe(true);
    expect(outcome.state.holding.length).toBeLessThanOrEqual(level.holdingCapacity);
    state = outcome.state;
  }
  return state;
}

test('First Light contains only the authored Easy to Medium to Hard onboarding curve', () => {
  expect(WORLD_1).toHaveLength(10);
  expect(WORLD_1.map((level) => level.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(WORLD_1.every((level) => level.themeId === 'first-light')).toBe(true);
  expect(WORLD_1.map((level) => level.difficulty)).toEqual([
    'easy', 'easy', 'easy', 'easy', 'easy', 'easy', 'easy', 'easy', 'medium', 'hard',
  ]);
  expect(WORLD_1.every((level) => level.holdingCapacity === 3)).toBe(true);
  expect(WORLD_1.every((level) => level.modifiers === undefined)).toBe(true);
});

test.each(WORLD_1)('First Light level $id has an exact per-color charge budget', (level) => {
  const state = createGame(level);
  const pixelsByColor = new Map<string, number>();
  const capacityByColor = new Map<string, number>();

  for (const pixel of state.pixels) {
    pixelsByColor.set(pixel.color, (pixelsByColor.get(pixel.color) ?? 0) + 1);
  }
  for (const charge of level.tunnels.flat()) {
    capacityByColor.set(charge.color, (capacityByColor.get(charge.color) ?? 0) + charge.capacity);
  }

  expect(capacityByColor).toEqual(pixelsByColor);
});

test.each(WORLD_1)(
  'First Light level $id solves and its witness replays through runtime',
  (level) => {
    const result = solve(level);
    expect(result.solved).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.viableFirstMoves).toBeGreaterThanOrEqual(1);
    expect(replay(level, result.moves).status).toBe('won');
  },
  120_000,
);

test('First Light analyzer report stays scoped to Levels 1-10', async () => {
  const rows = [];
  for (const level of WORLD_1) {
    const analysis = await analyzeLevel(level, { nodeCap: 250_000, now: () => 0 });
    expect(analysis.complete).toBe(true);
    expect(analysis.solvable).toBe(true);
    rows.push({
      id: level.id,
      authored: analysis.authoredDifficulty,
      suggested: analysis.suggestedDifficulty,
      score: analysis.difficultyScore,
      solve: analysis.solveResult,
      warnings: analysis.warnings.map((warning) => `${warning.severity}:${warning.code}`),
    });
  }

  const concurrent = rows.map((row) => row.solve);

  // L1-L3 are deliberately forgiving: every opening works and the calm line
  // neither uses Holding nor has a fail path.
  for (const row of rows.slice(0, 3)) {
    expect(row.solve.viableFirstMoves).toBe(row.solve.totalFirstMoves);
    expect(row.solve.minWinningPeak).toBe(0);
    expect(row.solve.failPathLength).toBeNull();
  }

  // L4-L8 expose Holding through imperfect lines without requiring it on the
  // best line. L5 is the first level with a real fail path — but a recoverable
  // Holding overflow made the advisory score fall back in line with its
  // authored Easy, which is where an onboarding level should sit.
  for (const result of concurrent.slice(3, 8)) expect(result.minWinningPeak).toBe(0);
  expect(concurrent.slice(3, 8).every((result) => result.maxHolding >= 1)).toBe(true);
  expect(rows[4]).toMatchObject({ authored: 'easy', suggested: 'easy' });
  expect(rows[4]!.solve.lossProbability).toBeLessThan(0.1);
  expect(rows[4]!.solve.failPathLength).toBeGreaterThan(2);

  // L9 is the first required-Holding Medium step. L10 then makes a substantial,
  // deterministic Hard jump while retaining three viable openings.
  expect(rows[8]).toMatchObject({ authored: 'medium', suggested: 'medium' });
  expect(rows[8]!.solve.minWinningPeak).toBe(1);
  expect(rows[8]!.score).toBeGreaterThan(rows[7]!.score);
  expect(rows[9]).toMatchObject({ authored: 'hard', suggested: 'hard' });
  expect(rows[9]!.solve.minWinningPeak).toBeGreaterThanOrEqual(2);
  expect(rows[9]!.solve.heldLaunches).toBeGreaterThanOrEqual(2);
  expect(rows[9]!.solve.lossProbability).toBeGreaterThan(0.5);
  expect(rows[9]!.solve.viableFirstMoves).toBe(rows[9]!.solve.totalFirstMoves);
  expect(rows[9]!.solve.failPathLength).toBeGreaterThan(2);

  if (process.env.REPORT_WORLD_1) console.log(JSON.stringify(rows, null, 2));
}, 180_000);
