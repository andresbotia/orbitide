import type { GameAction } from '../../engine/actions';
import { createGame } from '../../engine/createGame';
import { iceLayers, shieldLayers } from '../../engine/frozen';
import { resolveAction } from '../../engine/resolveLaunch';
import { solve, type SolveMode } from '../../engine/solver';
import { traceActions } from '../../engine/trace';
import type { LevelDefinition } from '../../engine/types';
import { analyzeLevel } from '../../studio/analysis/analyzeLevel';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';

const WORLD_7 = LEVEL_DEFINITIONS.filter((level) => level.id >= 61 && level.id <= 70);
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

test('Skybound contains only the authored mixed-modifier Medium to Hard curve', () => {
  expect(WORLD_7.map((level) => level.id)).toEqual([61, 62, 63, 64, 65, 66, 67, 68, 69, 70]);
  expect(WORLD_7.every((level) => level.themeId === 'skybound')).toBe(true);
  expect(WORLD_7.map((level) => level.difficulty)).toEqual([
    'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'hard', 'hard',
  ]);
  expect(WORLD_7.every((level) => level.holdingCapacity === 3)).toBe(true);
  for (const level of WORLD_7) {
    const state = createGame(level);
    expect(state.pixels.some((pixel) => iceLayers(pixel) === 1)).toBe(true);
    expect(state.pixels.some((pixel) => shieldLayers(pixel) === 1)).toBe(true);
    expect(Object.values(level.modifiers ?? {}).every(
      (modifier) => modifier.kind === 'frozen' || modifier.kind === 'shielded',
    )).toBe(true);
  }
});

test.each(WORLD_7)('Skybound level $id has an exact modifier-aware per-color budget', (level) => {
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

test.each(WORLD_7.flatMap((level) => MODES.map((mode) => ({ level, mode }))))(
  'Skybound level $level.id solves and its $mode witness replays through runtime',
  ({ level, mode }) => {
    const result = solve(level, { mode });
    expect(result.solved).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.viableFirstMoves).toBeGreaterThanOrEqual(1);
    expect(replay(level, result.moves).status).toBe('won');
    const trace = traceActions(level, result.moves);
    expect(trace.steps.some((step) => step.frozenBreakPixelIds.length > 0)).toBe(true);
    expect(trace.steps.some((step) => step.shieldBreakPixelIds.length > 0)).toBe(true);
  },
  120_000,
);

test('Skybound analyzer report stays scoped to Levels 61-70', async () => {
  const rows = [];
  for (const level of WORLD_7) {
    const analysis = await analyzeLevel(level, { nodeCap: 100_000, now: () => 0 });
    expect(analysis.complete).toBe(true);
    expect(analysis.solvable).toBe(true);
    rows.push({
      id: level.id,
      authored: analysis.authoredDifficulty,
      suggested: analysis.suggestedDifficulty,
      score: analysis.difficultyScore,
      seq: analysis.sequentialResult,
      con: analysis.concurrentResult,
      exposure: analysis.difficulty.factors.exposureDepth,
      warnings: analysis.warnings.map((warning) => `${warning.severity}:${warning.code}`),
    });
  }

  // L61-L63 form the readable aviation Medium opening. Durable-shell pressure
  // on L62 is resolved so Gold does not trap inner bands, and concurrency
  // saves 0 steps across all three openers.
  for (const row of rows.slice(0, 3)) {
    expect(row).toMatchObject({ authored: 'medium', suggested: 'medium' });
    expect(row.con.minWinningPeak).toBe(1);
    expect(row.seq.length - row.con.length).toBe(0);
  }
  expect(rows.slice(0, 3).map((row) => row.con.length)).toEqual([8, 11, 9]);
  expect(rows.slice(0, 3).map((row) => row.con.heldLaunches)).toEqual([2, 2, 2]);

  // L64-L66 provide stronger Medium aerial challenges. L64 demands 4 held relaunches,
  // while L65's parachute rim order eliminates artificial durable-shell lockout.
  for (const row of rows.slice(3, 6)) {
    expect(row).toMatchObject({ authored: 'medium', suggested: 'medium' });
    expect(row.con.minWinningPeak).toBe(1);
    expect(row.seq.length - row.con.length).toBe(0);
  }
  expect(rows.slice(3, 6).map((row) => row.con.length)).toEqual([10, 9, 9]);
  expect(rows.slice(3, 6).map((row) => row.con.heldLaunches)).toEqual([4, 2, 2]);

  // L67-L68 form the Medium/Hard transition bridge. Radar Spire peels cleanly
  // with zero concurrency shortcut, and Rescue Helicopter matches length 9 with gap 0.
  for (const row of rows.slice(6, 8)) {
    expect(row).toMatchObject({ authored: 'medium', suggested: 'medium' });
    expect(row.con.minWinningPeak).toBe(1);
    expect(row.seq.length - row.con.length).toBe(0);
  }
  expect(rows.slice(6, 8).map((row) => row.con.length)).toEqual([8, 9]);
  expect(rows.slice(6, 8).map((row) => row.con.heldLaunches)).toEqual([2, 2]);

  // L69-L70 are true Hard aviation milestones with zero concurrency shortcuts.
  // L69 (Midnight Jetliner) establishes peak-2 holding with 5 relaunches and score 50.
  // L70 (The Skybound Airship) serves as the Hard finale with fair fail-path quality,
  // dropping solver nodes from >60k down to ~12k without solver explosion.
  for (const row of rows.slice(8)) {
    expect(row).toMatchObject({ authored: 'hard', suggested: 'hard' });
    expect(row.seq.length - row.con.length).toBe(0);
    expect(row.score).toBeGreaterThanOrEqual(42);
  }
  expect(rows[8]!.con.minWinningPeak).toBe(2);
  expect(rows[8]!.con.heldLaunches).toBe(5);
  expect(rows[9]!.con.failPathLength).toBe(6);
  expect(rows[9]!.con.nodes).toBeLessThan(30_000);
  expect(rows[9]!.warnings).toEqual([]);

  if (process.env.REPORT_WORLD_7) console.log(JSON.stringify(rows, null, 2));
}, 240_000);
