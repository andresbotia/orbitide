import type { GameAction } from '../../engine/actions';
import { createGame } from '../../engine/createGame';
import { iceLayers, shieldLayers } from '../../engine/frozen';
import { resolveAction } from '../../engine/resolveLaunch';
import { solve, type SolveMode } from '../../engine/solver';
import { traceActions } from '../../engine/trace';
import type { LevelDefinition } from '../../engine/types';
import { analyzeLevel } from '../../studio/analysis/analyzeLevel';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';

const WORLD_5 = LEVEL_DEFINITIONS.filter((level) => level.id >= 41 && level.id <= 50);
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

test('Prism Works contains only the authored Shielded Medium to Hard curve', () => {
  expect(WORLD_5.map((level) => level.id)).toEqual([41, 42, 43, 44, 45, 46, 47, 48, 49, 50]);
  expect(WORLD_5.every((level) => level.themeId === 'prism-works')).toBe(true);
  expect(WORLD_5.map((level) => level.difficulty)).toEqual([
    'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'hard', 'hard',
  ]);
  expect(WORLD_5.every((level) => level.holdingCapacity === 3)).toBe(true);
  expect(WORLD_5.filter((level) => level.tutorial).map((level) => level.id)).toEqual([41]);
  expect(WORLD_5[0]!.tutorial).toBe('Shielded pixels absorb one hit — launch that color again to clear.');
  for (const level of WORLD_5) {
    expect(level.modifiers).toBeDefined();
    expect(Object.values(level.modifiers!).every((modifier) => modifier.kind === 'shielded')).toBe(true);
    expect(createGame(level).pixels.some((pixel) => shieldLayers(pixel) === 1)).toBe(true);
  }
});

test('Glass Seed teaches a Shielded break and relaunch without presenting Frozen', () => {
  const level = WORLD_5[0]!;
  const initial = createGame(level);
  expect(initial.pixels.filter((pixel) => shieldLayers(pixel) === 1)).toHaveLength(1);
  expect(initial.pixels.some((pixel) => iceLayers(pixel) > 0)).toBe(false);

  const result = solve(level, { mode: 'metrics' });
  const trace = traceActions(level, result.moves);
  expect(trace.outcome).toBe('won');
  expect(result.heldLaunches).toBeGreaterThanOrEqual(1);
  expect(trace.steps.some((step) => step.shieldBreakPixelIds.length > 0)).toBe(true);
  expect(trace.steps.every((step) => step.frozenBreakPixelIds.length === 0)).toBe(true);
});

test.each(WORLD_5)('Prism Works level $id has an exact Shielded-aware per-color budget', (level) => {
  const state = createGame(level);
  const need = new Map<string, number>();
  const have = new Map<string, number>();

  for (const pixel of state.pixels) {
    need.set(pixel.color, (need.get(pixel.color) ?? 0) + 1 + shieldLayers(pixel));
  }
  for (const charge of level.tunnels.flat()) {
    have.set(charge.color, (have.get(charge.color) ?? 0) + charge.capacity);
  }

  expect(have).toEqual(need);
});

test.each(WORLD_5.flatMap((level) => MODES.map((mode) => ({ level, mode }))))(
  'Prism Works level $level.id solves and its $mode witness replays through runtime',
  ({ level, mode }) => {
    const result = solve(level, { mode });
    expect(result.solved).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.viableFirstMoves).toBeGreaterThanOrEqual(1);
    expect(replay(level, result.moves).status).toBe('won');
  },
  120_000,
);

test('Prism Works analyzer report stays scoped to Levels 41-50', async () => {
  const rows = [];
  for (const level of WORLD_5) {
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

  // L41-L43 teach the membrane break/relaunch loop with one unavoidable
  // Holding slot, then reinforce it through progressively longer plans.
  for (const row of rows.slice(0, 3)) {
    expect(row).toMatchObject({ authored: 'medium', suggested: 'medium' });
    expect(row.con.minWinningPeak).toBe(1);
    expect(row.con.viableFirstMoves).toBe(row.con.totalFirstMoves);
    expect(row.seq.length - row.con.length).toBe(0);
  }
  expect(rows.slice(0, 3).map((row) => row.con.length)).toEqual([6, 7, 9]);
  expect(rows.slice(0, 3).map((row) => row.con.heldLaunches)).toEqual([2, 2, 3]);

  // L44-L48 remain Medium while the relaunch burden grows. L46 no longer
  // spikes to a two-slot plan, L47 stays deliberate without a concurrency
  // shortcut, and L48 is the ten-action/four-relaunch bridge into Hard.
  for (const row of rows.slice(3, 8)) {
    expect(row).toMatchObject({ authored: 'medium', suggested: 'medium' });
    expect(row.con.minWinningPeak).toBe(1);
    expect(row.seq.length - row.con.length).toBeLessThan(2);
  }
  expect(rows[5]!.con).toMatchObject({ length: 9, heldLaunches: 4 });
  expect(rows[6]!.con).toMatchObject({ length: 10, heldLaunches: 3 });
  expect(rows[7]!.con).toMatchObject({ length: 10, heldLaunches: 4 });
  for (const row of rows.slice(5, 8)) expect(row.seq.length - row.con.length).toBe(0);

  // L49 supplies the fair fail path; L50 is the sustained finale. The finale
  // deliberately keeps every opening recoverable, but its enclosed color cores
  // require two Holding slots and more relaunch planning than L49. Concurrency
  // cannot bypass either Hard solution.
  for (const row of rows.slice(8)) {
    expect(row).toMatchObject({ authored: 'hard', suggested: 'hard' });
    expect(row.seq.length - row.con.length).toBe(0);
  }
  expect(rows[8]!.con.failPathLength).toBeGreaterThan(2);
  expect(rows[9]!.con.failPathLength).toBeNull();
  expect(rows[9]!.con.minWinningPeak).toBe(2);
  expect(rows[9]!.con.length).toBeGreaterThan(rows[8]!.con.length);
  expect(rows[9]!.con.heldLaunches).toBeGreaterThan(rows[8]!.con.heldLaunches);

  if (process.env.REPORT_WORLD_5) console.log(JSON.stringify(rows, null, 2));
}, 180_000);
