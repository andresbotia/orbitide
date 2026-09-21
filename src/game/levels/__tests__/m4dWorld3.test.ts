import type { GameAction } from '../../engine/actions';
import { createGame } from '../../engine/createGame';
import { iceLayers } from '../../engine/frozen';
import { applyActionWithArrivals } from '../../engine/holdingArrival';
import { solve } from '../../engine/solver';
import type { LevelDefinition } from '../../engine/types';
import { analyzeLevel } from '../../studio/analysis/analyzeLevel';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';

const WORLD_3 = LEVEL_DEFINITIONS.filter((level) => level.id >= 21 && level.id <= 30);

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

test('Deep Frost contains only the authored Frozen Easy to Medium to Hard curve', () => {
  expect(WORLD_3.map((level) => level.id)).toEqual([21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
  expect(WORLD_3.every((level) => level.themeId === 'deep-frost')).toBe(true);
  expect(WORLD_3.map((level) => level.difficulty)).toEqual([
    'easy', 'easy', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'hard', 'hard',
  ]);
  expect(WORLD_3.every((level) => level.holdingCapacity === 3)).toBe(true);
  expect(WORLD_3.filter((level) => level.tutorial).map((level) => level.id)).toEqual([21]);
  expect(WORLD_3[0]!.tutorial).toBe('Frozen pixels take an extra hit — crack the ice, then clear.');
  for (const level of WORLD_3) {
    expect(level.modifiers).toBeDefined();
    expect(Object.values(level.modifiers!).every((modifier) => modifier.kind === 'frozen')).toBe(true);
    expect(createGame(level).pixels.some((pixel) => iceLayers(pixel) === 1)).toBe(true);
  }

  // L28's crystal now carries readable ice at both cyan tips and through the
  // white core, so Frozen affects both colour phases instead of one extra-hit block.
  const crystal = createGame(WORLD_3[7]!);
  expect(new Set(crystal.pixels.filter((pixel) => iceLayers(pixel) === 1).map((pixel) => pixel.color)))
    .toEqual(new Set(['cyan', 'white']));
});

test.each(WORLD_3)('Deep Frost level $id has an exact Frozen-aware per-color budget', (level) => {
  const state = createGame(level);
  const need = new Map<string, number>();
  const have = new Map<string, number>();

  for (const pixel of state.pixels) {
    need.set(pixel.color, (need.get(pixel.color) ?? 0) + 1 + iceLayers(pixel));
  }
  for (const charge of level.tunnels.flat()) {
    have.set(charge.color, (have.get(charge.color) ?? 0) + charge.capacity);
  }

  expect(have).toEqual(need);
});

test.each(WORLD_3)(
  'Deep Frost level $id solves and its witness replays through runtime',
  (level) => {
    const result = solve(level);
    expect(result.solved).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.viableFirstMoves).toBeGreaterThanOrEqual(1);
    expect(replay(level, result.moves).status).toBe('won');
  },
  120_000,
);

test('Deep Frost analyzer report stays scoped to Levels 21-30', async () => {
  const rows = [];
  for (const level of WORLD_3) {
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

  // L21-L22 teach the crack/relaunch loop with one required Holding slot while
  // keeping every opening viable and consequence-free.
  for (const row of rows.slice(0, 2)) {
    expect(row).toMatchObject({ authored: 'easy', suggested: 'easy' });
    expect(row.solve).toMatchObject({
      length: 4, minWinningPeak: 1, heldLaunches: 1, failPathLength: null,
    });
    expect(row.solve.viableFirstMoves).toBe(row.solve.totalFirstMoves);
  }

  // L23-L25 make the Easy-to-Medium handoff without a sudden first-move trap.
  for (const row of rows.slice(2, 5)) {
    expect(row).toMatchObject({ authored: 'medium', suggested: 'medium' });
    expect(row.solve.minWinningPeak).toBeGreaterThanOrEqual(1);
    expect(row.solve.heldLaunches).toBeGreaterThanOrEqual(1);
    expect(row.solve.viableFirstMoves).toBe(row.solve.totalFirstMoves);
  }

  // L26-L28 vary Medium pressure deliberately: L26 has the longest line, L27
  // fills Holding on risky lines, and the two-colour Frozen plan makes L28 a
  // stronger step than L27 without manufacturing a fail path.
  expect(rows[5]).toMatchObject({ authored: 'medium', suggested: 'medium' });
  expect(rows[5]!.solve.length).toBeGreaterThanOrEqual(8);
  expect(rows[5]!.solve.heldLaunches).toBeGreaterThanOrEqual(2);
  expect(rows[6]).toMatchObject({ authored: 'medium', suggested: 'medium' });
  expect(rows[6]!.solve.maxHolding).toBe(3);
  expect(rows[6]!.solve.heldLaunches).toBeGreaterThanOrEqual(3);
  expect(rows[7]).toMatchObject({ authored: 'medium', suggested: 'medium' });
  expect(rows[7]!.score).toBeGreaterThan(rows[6]!.score);
  expect(rows[7]!.solve.maxHolding).toBeGreaterThanOrEqual(2);

  // L29-L30 are genuine Hard steps through unavoidable two-slot Holding and
  // sustained manual relaunch planning. Their exact budgets intentionally keep
  // all three openings viable; no fail path is manufactured just for a warning.
  for (const row of rows.slice(8)) {
    expect(row).toMatchObject({ authored: 'hard', suggested: 'hard' });
    expect(row.score).toBeGreaterThan(Math.max(...rows.slice(0, 8).map((candidate) => candidate.score)));
    expect(row.solve.minWinningPeak).toBeGreaterThanOrEqual(2);
    expect(row.solve.heldLaunches).toBeGreaterThanOrEqual(3);
    expect(row.solve.viableFirstMoves).toBe(row.solve.totalFirstMoves);
    expect(row.warnings).toContain('warn:NO_FAIL_PATH');
  }
  expect(rows[9]!.score).toBeGreaterThan(rows[8]!.score);
  expect(rows[9]!.solve.length).toBeGreaterThan(rows[8]!.solve.length);
  expect(rows[9]!.solve.heldLaunches).toBeGreaterThan(rows[8]!.solve.heldLaunches);

  if (process.env.REPORT_WORLD_3) console.log(JSON.stringify(rows, null, 2));
}, 180_000);
