import type { GameAction } from '../../engine/actions';
import { createGame } from '../../engine/createGame';
import { resolveAction } from '../../engine/resolveLaunch';
import { solve, type SolveMode } from '../../engine/solver';
import type { LevelDefinition } from '../../engine/types';
import { analyzeLevel } from '../../studio/analysis/analyzeLevel';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';

const WORLD_2 = LEVEL_DEFINITIONS.filter((level) => level.id >= 11 && level.id <= 20);
const MODES: SolveMode[] = ['sequential-compat', 'metrics'];

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

test('Wild Garden contains only the authored Easy to Medium to Hard curve', () => {
  expect(WORLD_2.map((level) => level.id)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  expect(WORLD_2.every((level) => level.themeId === 'wild-garden')).toBe(true);
  expect(WORLD_2.map((level) => level.difficulty)).toEqual([
    'easy', 'easy', 'easy', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'hard',
  ]);
  expect(WORLD_2.every((level) => level.holdingCapacity === 3)).toBe(true);
  expect(WORLD_2.every((level) => level.modifiers === undefined)).toBe(true);
});

test.each(WORLD_2)('Wild Garden level $id has an exact per-color charge budget', (level) => {
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

test.each(WORLD_2.flatMap((level) => MODES.map((mode) => ({ level, mode }))))(
  'Wild Garden level $level.id solves and its $mode witness replays through runtime',
  ({ level, mode }) => {
    const result = solve(level, { mode });
    expect(result.solved).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.viableFirstMoves).toBeGreaterThanOrEqual(1);
    expect(replay(level, result.moves).status).toBe('won');
  },
  120_000,
);

test('Wild Garden analyzer report stays scoped to Levels 11-20', async () => {
  const rows = [];
  for (const level of WORLD_2) {
    const analysis = await analyzeLevel(level, { nodeCap: 250_000, now: () => 0 });
    expect(analysis.complete).toBe(true);
    expect(analysis.solvable).toBe(true);
    rows.push({
      id: level.id,
      authored: analysis.authoredDifficulty,
      suggested: analysis.suggestedDifficulty,
      score: analysis.difficultyScore,
      seq: analysis.sequentialResult,
      con: analysis.concurrentResult,
      warnings: analysis.warnings.map((warning) => `${warning.severity}:${warning.code}`),
    });
  }

  // L11-L13 are forgiving Easy entries: every opening works, the calm line
  // avoids Holding, and none has a fail path.
  for (const row of rows.slice(0, 3)) {
    expect(row).toMatchObject({ authored: 'easy', suggested: 'easy' });
    expect(row.con.viableFirstMoves).toBe(row.con.totalFirstMoves);
    expect(row.con.minWinningPeak).toBe(0);
    expect(row.con.failPathLength).toBeNull();
  }

  // L14-L18 establish Medium through required Holding and longer six-move
  // lines. They intentionally need not manufacture fail paths.
  for (const row of rows.slice(3, 8)) {
    expect(row).toMatchObject({ authored: 'medium', suggested: 'medium' });
    expect(row.con.length).toBeGreaterThanOrEqual(6);
    expect(row.con.minWinningPeak).toBeGreaterThanOrEqual(1);
    expect(row.con.heldLaunches).toBeGreaterThanOrEqual(1);
  }

  // L19 remains a strong Medium despite the accepted concurrency tradeoff:
  // joining shortens its line, but does not erase required Holding pressure.
  expect(rows[8]).toMatchObject({ authored: 'medium', suggested: 'medium' });
  expect(rows[8]!.con.minWinningPeak).toBeGreaterThanOrEqual(1);
  expect(rows[8]!.seq.length - rows[8]!.con.length).toBe(2);
  expect(rows[8]!.warnings).toContain('warn:CONCURRENCY_TRIVIALIZES_LEVEL');

  // L20 is a clear Hard finale through sustained Holding and relaunch planning,
  // even though exact color budgets make the authored line unloseable.
  expect(rows[9]).toMatchObject({ authored: 'hard', suggested: 'hard' });
  expect(rows[9]!.score).toBeGreaterThan(Math.max(...rows.slice(3, 9).map((row) => row.score)));
  expect(rows[9]!.con.length).toBeGreaterThanOrEqual(8);
  expect(rows[9]!.con.minWinningPeak).toBeGreaterThanOrEqual(2);
  expect(rows[9]!.con.heldLaunches).toBeGreaterThanOrEqual(2);
  expect(rows[9]!.con.viableFirstMoves).toBe(rows[9]!.con.totalFirstMoves);

  if (process.env.REPORT_WORLD_2) console.log(JSON.stringify(rows, null, 2));
}, 180_000);
