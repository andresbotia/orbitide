import type { GameAction } from '../../engine/actions';
import { createGame } from '../../engine/createGame';
import { iceLayers } from '../../engine/frozen';
import { resolveAction } from '../../engine/resolveLaunch';
import { solve, type SolveMode } from '../../engine/solver';
import type { LevelDefinition } from '../../engine/types';
import { analyzeLevel } from '../../studio/analysis/analyzeLevel';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';

const WORLD_4 = LEVEL_DEFINITIONS.filter((level) => level.id >= 31 && level.id <= 40);
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

test('Curio Cabinet contains only the authored Medium to Hard mastery curve', () => {
  expect(WORLD_4.map((level) => level.id)).toEqual([31, 32, 33, 34, 35, 36, 37, 38, 39, 40]);
  expect(WORLD_4.every((level) => level.themeId === 'curio-cabinet')).toBe(true);
  expect(WORLD_4.map((level) => level.difficulty)).toEqual([
    'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'hard', 'hard',
  ]);
  expect(WORLD_4.every((level) => level.holdingCapacity === 3)).toBe(true);
  expect(WORLD_4.filter((level) => level.modifiers).map((level) => level.id)).toEqual([35, 38, 40]);
  for (const level of WORLD_4.filter((candidate) => candidate.modifiers)) {
    expect(Object.values(level.modifiers!).every((modifier) => modifier.kind === 'frozen')).toBe(true);
    expect(createGame(level).pixels.some((pixel) => iceLayers(pixel) === 1)).toBe(true);
  }

  // Frozen stays on readable object details: the lantern handle, the potion's
  // liquid core, and the chest's central lock/gem rather than its silhouette.
  expect(new Set(createGame(WORLD_4[4]!).pixels.filter((pixel) => iceLayers(pixel) === 1)
    .map((pixel) => pixel.color))).toEqual(new Set(['gold']));
  expect(new Set(createGame(WORLD_4[7]!).pixels.filter((pixel) => iceLayers(pixel) === 1)
    .map((pixel) => pixel.color))).toEqual(new Set(['teal', 'green']));
  expect(new Set(createGame(WORLD_4[9]!).pixels.filter((pixel) => iceLayers(pixel) === 1)
    .map((pixel) => pixel.color))).toEqual(new Set(['cyan', 'blue']));
});

test.each(WORLD_4)('Curio Cabinet level $id has an exact Frozen-aware per-color budget', (level) => {
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

test.each(WORLD_4.flatMap((level) => MODES.map((mode) => ({ level, mode }))))(
  'Curio Cabinet level $level.id solves and its $mode witness replays through runtime',
  ({ level, mode }) => {
    const result = solve(level, { mode });
    expect(result.solved).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.viableFirstMoves).toBeGreaterThanOrEqual(1);
    expect(replay(level, result.moves).status).toBe('won');
  },
  120_000,
);

test('Curio Cabinet analyzer report stays scoped to Levels 31-40', async () => {
  const rows = [];
  for (const level of WORLD_4) {
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

  // L31-L33 are solid Medium entries: each requires a deliberate Holding
  // cycle, but every opening remains recoverable. Only L33 introduces a fair
  // fail path after the two gentler cabinet openers.
  for (const row of rows.slice(0, 3)) {
    expect(row).toMatchObject({ authored: 'medium', suggested: 'medium' });
    expect(row.con.minWinningPeak).toBeGreaterThanOrEqual(1);
    expect(row.con.heldLaunches).toBeGreaterThanOrEqual(1);
    expect(row.con.viableFirstMoves).toBe(row.con.totalFirstMoves);
  }
  expect(rows[0]!.con.failPathLength).toBeNull();
  expect(rows[1]!.con.failPathLength).toBeNull();
  expect(rows[2]!.con.failPathLength).toBeGreaterThan(2);

  // L34-L36 strengthen Medium with eight-action plans, full-capacity risky
  // lines, and a gradual handoff from consequence-free to fail-able play.
  for (const row of rows.slice(3, 6)) {
    expect(row).toMatchObject({ authored: 'medium', suggested: 'medium' });
    expect(row.con.length).toBeGreaterThanOrEqual(8);
    expect(row.con.minWinningPeak).toBeGreaterThanOrEqual(1);
    expect(row.con.heldLaunches).toBeGreaterThanOrEqual(1);
    expect(row.con.maxHolding).toBe(3);
  }
  expect(rows[3]!.con.failPathLength).toBeNull();
  expect(rows[4]!.con.heldLaunches).toBeGreaterThan(rows[3]!.con.heldLaunches);
  expect(rows[5]!.con.failPathLength).toBeGreaterThan(2);

  // L37-L38 deliberately sit on the Medium/Hard boundary in different ways:
  // the globe needs two Holding slots, while Frozen makes the potion a longer
  // three-relaunch plan. Concurrency does not erase either identity.
  for (const row of rows.slice(6, 8)) {
    expect(row).toMatchObject({ authored: 'medium', suggested: 'hard' });
    expect(row.con.maxHolding).toBe(3);
    expect(row.con.failPathLength).toBeGreaterThan(2);
    expect(row.seq.length - row.con.length).toBeLessThan(2);
  }
  expect(rows[6]!.con.minWinningPeak).toBe(2);
  expect(rows[7]!.con.length).toBeGreaterThanOrEqual(10);
  expect(rows[7]!.con.heldLaunches).toBeGreaterThanOrEqual(3);

  // L39 is a real Hard gate; L40 is the longer Frozen finale. Both require two
  // Holding slots, all openings stay viable, and the finale adds three more
  // manual relaunches without retaining its former Super-Hard loss rate.
  for (const row of rows.slice(8)) {
    expect(row).toMatchObject({ authored: 'hard', suggested: 'hard' });
    expect(row.con.minWinningPeak).toBeGreaterThanOrEqual(2);
    expect(row.con.viableFirstMoves).toBe(row.con.totalFirstMoves);
    expect(row.con.failPathLength).toBeGreaterThan(2);
    expect(row.seq.length - row.con.length).toBe(0);
  }
  expect(rows[8]!.con.lossProbability).toBeGreaterThan(0.5);
  expect(rows[9]!.score).toBeGreaterThan(rows[8]!.score);
  expect(rows[9]!.con.length).toBeGreaterThan(rows[8]!.con.length);
  expect(rows[9]!.con.heldLaunches).toBeGreaterThan(rows[8]!.con.heldLaunches);
  expect(rows[9]!.con.lossProbability).toBeLessThan(0.5);

  if (process.env.REPORT_WORLD_4) console.log(JSON.stringify(rows, null, 2));
}, 180_000);
