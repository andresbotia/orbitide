import type { GameAction } from '../../engine/actions';
import { createGame } from '../../engine/createGame';
import { iceLayers, shieldLayers } from '../../engine/frozen';
import { resolveAction } from '../../engine/resolveLaunch';
import { solve } from '../../engine/solver';
import { traceActions } from '../../engine/trace';
import type { LevelDefinition } from '../../engine/types';
import { analyzeLevel } from '../../studio/analysis/analyzeLevel';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';

const WORLD_6 = LEVEL_DEFINITIONS.filter((level) => level.id >= 51 && level.id <= 60);

function replay(level: LevelDefinition, moves: GameAction[]) {
  let state = createGame(level);
  for (const action of moves) {
    const outcome = resolveAction(state, action);
    expect(outcome.accepted).toBe(true);
    expect(outcome.state.holding.length).toBeLessThanOrEqual(level.holdingCapacity);
    state = outcome.state;
  }
  return state;
}

test('Frostglass Forge contains only the authored mixed-modifier Medium to Hard curve', () => {
  expect(WORLD_6.map((level) => level.id)).toEqual([51, 52, 53, 54, 55, 56, 57, 58, 59, 60]);
  expect(WORLD_6.every((level) => level.themeId === 'frostglass-forge')).toBe(true);
  expect(WORLD_6.map((level) => level.difficulty)).toEqual([
    'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'hard', 'hard',
  ]);
  expect(WORLD_6.every((level) => level.holdingCapacity === 3)).toBe(true);
  for (const level of WORLD_6) {
    const state = createGame(level);
    expect(state.pixels.some((pixel) => iceLayers(pixel) === 1)).toBe(true);
    expect(state.pixels.some((pixel) => shieldLayers(pixel) === 1)).toBe(true);
    expect(Object.values(level.modifiers ?? {}).every(
      (modifier) => modifier.kind === 'frozen' || modifier.kind === 'shielded',
    )).toBe(true);
  }
});

test.each(WORLD_6)('Frostglass Forge level $id has an exact modifier-aware per-color budget', (level) => {
  const state = createGame(level);
  const need = new Map<string, number>();
  const have = new Map<string, number>();

  for (const pixel of state.pixels) {
    need.set(pixel.color, (need.get(pixel.color) ?? 0) + 1 + iceLayers(pixel) + shieldLayers(pixel));
  }
  for (const charge of level.tunnels.flat()) {
    have.set(charge.color, (have.get(charge.color) ?? 0) + charge.capacity);
  }

  expect(have).toEqual(need);
});

test.each(WORLD_6)(
  'Frostglass Forge level $id solves and its witness replays through runtime',
  (level) => {
    const result = solve(level);
    expect(result.solved).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.viableFirstMoves).toBeGreaterThanOrEqual(1);
    expect(replay(level, result.moves).status).toBe('won');
    const trace = traceActions(level, result.moves);
    expect(trace.steps.some((step) => step.frozenBreakPixelIds.length > 0)).toBe(true);
    expect(trace.steps.some((step) => step.shieldBreakPixelIds.length > 0)).toBe(true);
    // One launch per step (the canonical settle-first line), so no step breaks both.
    expect(trace.steps.every(
      (step) => step.frozenBreakPixelIds.length === 0 || step.shieldBreakPixelIds.length === 0,
    )).toBe(true);
  },
  120_000,
);

test('Frostglass Forge analyzer report stays scoped to Levels 51-60', async () => {
  const rows = [];
  for (const level of WORLD_6) {
    const analysis = await analyzeLevel(level, { nodeCap: 250_000, now: () => 0 });
    expect(analysis.complete).toBe(true);
    expect(analysis.solvable).toBe(true);
    rows.push({
      id: level.id,
      authored: analysis.authoredDifficulty,
      suggested: analysis.suggestedDifficulty,
      score: analysis.difficultyScore,
      solve: analysis.solveResult,
      exposure: analysis.difficulty.factors.exposureDepth,
      warnings: analysis.warnings.map((warning) => `${warning.severity}:${warning.code}`),
    });
  }

  // L51-L53 combine the two familiar materials without stacking their play
  // events. All three stay at one-slot pressure and concurrency does not skip
  // any step of their intended solve.
  for (const row of rows.slice(0, 3)) {
    expect(row.authored).toBe('medium');
    expect(row.solve.minWinningPeak).toBe(1);
  }
  expect(rows.slice(0, 3).map((row) => row.solve.length)).toEqual([9, 7, 8]);
  expect(rows.slice(0, 3).map((row) => row.solve.heldLaunches)).toEqual([2, 2, 2]);

  // L54-L56 are sustained Medium plans. They retain one-slot best lines while
  // adding longer staged relaunch sequences; L54 and L56 provide fair fail
  // paths without forcing one onto L55.
  for (const row of rows.slice(3, 6)) {
    expect(row.authored).toBe('medium');
    expect(row.solve.minWinningPeak).toBe(1);
  }
  expect(rows.slice(3, 6).map((row) => row.solve.length)).toEqual([11, 10, 11]);
  expect(rows.slice(3, 6).map((row) => row.solve.heldLaunches)).toEqual([5, 4, 4]);
  expect(rows[3]!.solve.failPathLength).toBeGreaterThan(2);
  expect(rows[4]!.solve.failPathLength).toBeNull();
  expect(rows[5]!.solve.failPathLength).toBeGreaterThan(2);

  // L57 remains the last one-slot bridge; L58 introduces peak-2 Holding and a
  // fifth relaunch. Neither transition level is shortened by concurrency.
  expect(rows.slice(6, 8).map((row) => row.authored)).toEqual(['medium', 'medium']);
  expect(rows.slice(6, 8).map((row) => row.solve.minWinningPeak)).toEqual([1, 2]);
  expect(rows.slice(6, 8).map((row) => row.solve.heldLaunches)).toEqual([4, 5]);

  // L59-L60 are peak-2 Hard finishes with real fail paths. L59 allows only a
  // one-step concurrent saving and L60 closes that gap while requiring the
  // world's longest concurrent plan and most manual relaunches.
  for (const row of rows.slice(8)) {
    expect(row).toMatchObject({ authored: 'hard', suggested: 'hard' });
    expect(row.solve.minWinningPeak).toBe(2);
    expect(row.solve.failPathLength).toBeGreaterThan(2);
  }
  expect(rows[9]!.solve.length).toBeGreaterThan(rows[8]!.solve.length);
  expect(rows[9]!.solve.heldLaunches).toBeGreaterThan(rows[8]!.solve.heldLaunches);

  if (process.env.REPORT_WORLD_6) console.log(JSON.stringify(rows, null, 2));
}, 240_000);
