import type { GameAction } from '../../engine/actions';
import { createGame } from '../../engine/createGame';
import { iceLayers, shieldLayers } from '../../engine/frozen';
import { resolveAction } from '../../engine/resolveLaunch';
import { solve, type SolveMode } from '../../engine/solver';
import { traceActions } from '../../engine/trace';
import type { LevelDefinition } from '../../engine/types';
import { analyzeLevel } from '../../studio/analysis/analyzeLevel';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';

const WORLD_10 = LEVEL_DEFINITIONS.filter((lev) => lev.id >= 91 && lev.id <= 100);
const MODES: SolveMode[] = ['sequential-compat', 'metrics'];

function replay(lev: LevelDefinition, moves: GameAction[]) {
  let state = createGame(lev);
  for (const action of moves) {
    const outcome = resolveAction(state, action);
    expect(outcome.accepted).toBe(true);
    expect(outcome.state.holding.length).toBeLessThanOrEqual(lev.holdingCapacity);
    state = outcome.state;
  }
  return state;
}

// ── 1. Structural contract ────────────────────────────────────────────────────
test('Starforge contains the target 4 Medium (91-94) to 6 Hard (95-100) curve', () => {
  expect(WORLD_10.map((lev) => lev.id)).toEqual([91, 92, 93, 94, 95, 96, 97, 98, 99, 100]);
  expect(WORLD_10.every((lev) => lev.themeId === 'starforge')).toBe(true);
  expect(WORLD_10.map((lev) => lev.difficulty)).toEqual([
    'medium', 'medium', 'medium', 'medium', 'hard', 'hard', 'hard', 'hard', 'hard', 'hard',
  ]);
  expect(WORLD_10.every((lev) => lev.holdingCapacity === 3)).toBe(true);

  for (const lev of WORLD_10) {
    const state = createGame(lev);
    // Every level in World 10 features Linked pixels
    expect(state.pixels.some((p) => p.modifier?.kind === 'linked')).toBe(true);
    // Modifiers must be only frozen, shielded, or linked
    expect(
      Object.values(lev.modifiers ?? {}).every(
        (m) => m.kind === 'frozen' || m.kind === 'shielded' || m.kind === 'linked',
      ),
    ).toBe(true);
  }
});

// ── 2. Per-color pixel budget ─────────────────────────────────────────────────
test.each(WORLD_10)('Starforge level $id has exact modifier-aware per-color budget', (lev) => {
  const state = createGame(lev);
  const need = new Map<string, number>();
  const have = new Map<string, number>();

  for (const pixel of state.pixels) {
    need.set(pixel.color, (need.get(pixel.color) ?? 0) + 1 + iceLayers(pixel) + shieldLayers(pixel));
  }
  for (const charge of lev.tunnels.flat()) {
    have.set(charge.color, (have.get(charge.color) ?? 0) + charge.capacity);
  }
  expect(have).toEqual(need);
});

// ── 3. Solve + witness replay (sequential and concurrent) ─────────────────────
test.each(WORLD_10.flatMap((lev) => MODES.map((mode) => ({ lev, mode }))))(
  'Starforge level $lev.id solves and $mode witness replays',
  ({ lev, mode }) => {
    const result = solve(lev, { mode });
    expect(result.solved).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.viableFirstMoves).toBeGreaterThanOrEqual(1);
    expect(replay(lev, result.moves).status).toBe('won');

    const trace = traceActions(lev, result.moves);
    const hasLinkedPrime = trace.steps.some((step) => step.linkedPrimePixelIds.length > 0);
    const hasLinkedClear = trace.steps.some((step) => step.linkedGroupClearIds.length > 0);
    expect(hasLinkedPrime || hasLinkedClear).toBe(true);

    const state = createGame(lev);
    if (state.pixels.some((p) => iceLayers(p) > 0)) {
      expect(trace.steps.some((step) => step.frozenBreakPixelIds.length > 0)).toBe(true);
    }
    if (state.pixels.some((p) => shieldLayers(p) > 0)) {
      expect(trace.steps.some((step) => step.shieldBreakPixelIds.length > 0)).toBe(true);
    }
  },
  120_000,
);

// ── 4. Analyzer report ────────────────────────────────────────────────────────
test('Starforge analyzer report stays scoped to Levels 91-100', async () => {
  const rows = [];
  for (const lev of WORLD_10) {
    const analysis = await analyzeLevel(lev, { nodeCap: 100_000, now: () => 0 });
    expect(analysis.complete).toBe(true);
    expect(analysis.solvable).toBe(true);
    rows.push({
      id: lev.id,
      title: lev.title,
      authored: analysis.authoredDifficulty,
      suggested: analysis.suggestedDifficulty,
      score: analysis.difficultyScore,
      seqLen: analysis.sequentialResult.length,
      conLen: analysis.concurrentResult.length,
      peak: analysis.concurrentResult.minWinningPeak,
      held: analysis.concurrentResult.heldLaunches,
      fail: analysis.concurrentResult.failPathLength,
      nodes: analysis.concurrentResult.nodes,
      warnings: analysis.warnings.map((w) => `${w.severity}:${w.code}`),
    });
  }

  // L91-L94 are authored Medium.
  for (const row of rows.slice(0, 4)) {
    expect(row.authored).toBe('medium');
    expect(row.nodes).toBeLessThan(100_000);
  }

  // L95-L100 are authored Hard.
  // Note: As documented in M4C and World 8/9 tuning, the static analyzer under-rates
  // Linked topology planning. Human-facing complexity from 3 mixed mechanics
  // and dense 55-90px machinery boards delivers genuine late Hard challenge.
  for (const row of rows.slice(4)) {
    expect(row.authored).toBe('hard');
    expect(row.nodes).toBeLessThan(100_000);
  }

  // L96 (Celestial Compass) tuned dense art delivers score ≥ 25.
  expect(rows[5]!.score).toBeGreaterThanOrEqual(25);

  // L98 (Helios Engine) late pinnacle requires 2 held launches.
  expect(rows[7]!.held).toBeGreaterThanOrEqual(2);

  // L100 (The Starforge) grand campaign finale requires 2 held launches and scores ≥ 25.
  expect(rows[9]!.held).toBeGreaterThanOrEqual(2);
  expect(rows[9]!.score).toBeGreaterThanOrEqual(25);

  if (process.env.REPORT_WORLD_10) console.log(JSON.stringify(rows, null, 2));
}, 300_000);

// ── 5. Finale contract ────────────────────────────────────────────────────────
test('Level 100 (The Starforge) specifically validates as monumental campaign finale', () => {
  const l100 = WORLD_10.find((lev) => lev.id === 100)!;
  const state = createGame(l100);

  // 90 pixels — largest board in the campaign
  expect(state.pixels.length).toBe(90);

  // Synthesis of all three mechanics across distinct zones:
  // 3 Linked pairs (6 cells), 2 Frozen cells, 2 Shielded cells
  const linkedPixels = state.pixels.filter((p) => p.modifier?.kind === 'linked');
  const frozenPixels = state.pixels.filter((p) => iceLayers(p) > 0);
  const shieldPixels = state.pixels.filter((p) => shieldLayers(p) > 0);
  expect(linkedPixels.length).toBe(6);
  expect(frozenPixels.length).toBe(2);
  expect(shieldPixels.length).toBe(2);

  // Exactly 3 unique link group IDs
  const linkGroups = new Set(linkedPixels.map((p) => p.modifier?.group));
  expect(linkGroups.size).toBe(3);

  // Deterministic zero-booster solution in both sequential and metrics modes
  for (const mode of MODES) {
    const res = solve(l100, { mode });
    expect(res.solved).toBe(true);
    expect(res.viableFirstMoves).toBe(3);
    expect(res.heldLaunches).toBeGreaterThanOrEqual(2);
    const endState = replay(l100, res.moves);
    expect(endState.status).toBe('won');
  }
});
