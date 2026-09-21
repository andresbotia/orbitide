import type { GameAction } from '../../engine/actions';
import { createGame } from '../../engine/createGame';
import { iceLayers, shieldLayers } from '../../engine/frozen';
import { applyActionWithArrivals } from '../../engine/holdingArrival';
import { solve } from '../../engine/solver';
import { traceActions } from '../../engine/trace';
import type { LevelDefinition } from '../../engine/types';
import { analyzeLevel } from '../../studio/analysis/analyzeLevel';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';

const WORLD_9 = LEVEL_DEFINITIONS.filter((lev) => lev.id >= 81 && lev.id <= 90);

function replay(lev: LevelDefinition, moves: GameAction[]) {
  let state = createGame(lev);
  for (const action of moves) {
    const outcome = applyActionWithArrivals(state, action);
    expect(outcome.accepted).toBe(true);
    expect(outcome.state.holding.length).toBeLessThanOrEqual(lev.holdingCapacity);
    state = outcome.state;
  }
  return state;
}

// ── 1. Structural contract ────────────────────────────────────────────────────
test('Arcane Relics contains the authored Medium (81-86) to Hard (87-90) curve', () => {
  expect(WORLD_9.map((lev) => lev.id)).toEqual([81, 82, 83, 84, 85, 86, 87, 88, 89, 90]);
  expect(WORLD_9.every((lev) => lev.themeId === 'arcane-relics')).toBe(true);
  expect(WORLD_9.map((lev) => lev.difficulty)).toEqual([
    'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'hard', 'hard', 'hard', 'hard',
  ]);
  expect(WORLD_9.every((lev) => lev.holdingCapacity === 3)).toBe(true);

  for (const lev of WORLD_9) {
    const state = createGame(lev);
    // Every level in World 9 features Linked pixels
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
test.each(WORLD_9)('Arcane Relics level $id has exact modifier-aware per-color budget', (lev) => {
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
test.each(WORLD_9)(
  'Arcane Relics level $id solves and its witness replays',
  (lev) => {
    const result = solve(lev);
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
test('Arcane Relics analyzer report stays scoped to Levels 81-90', async () => {
  const rows = [];
  for (const lev of WORLD_9) {
    const analysis = await analyzeLevel(lev, { nodeCap: 100_000, now: () => 0 });
    expect(analysis.complete).toBe(true);
    expect(analysis.solvable).toBe(true);
    rows.push({
      id: lev.id,
      title: lev.title,
      authored: analysis.authoredDifficulty,
      suggested: analysis.suggestedDifficulty,
      score: analysis.difficultyScore,
      len: analysis.solveResult.length,
      peak: analysis.solveResult.minWinningPeak,
      held: analysis.solveResult.heldLaunches,
      fail: analysis.solveResult.failPathLength,
      nodes: analysis.solveResult.nodes,
      warnings: analysis.warnings.map((w) => `${w.severity}:${w.code}`),
    });
  }

  // L81-L86 are authored Medium.
  // Note: As documented in M4C and World 8 tuning, the advisory difficulty metric
  // does not score Linked relationship reasoning directly. Structural difficulty
  // and multi-modifier exposure provide authentic Medium challenge.
  for (const row of rows.slice(0, 6)) {
    expect(row.authored).toBe('medium');
    expect(row.nodes).toBeLessThan(100_000);
  }
  // L86 (Verdant Crystal Staff) combines all three mechanics (Frozen + Shielded + Linked)
  // and delivers solid Medium score with 2 held launches.
  expect(rows[5]!.score).toBeGreaterThanOrEqual(25);
  expect(rows[5]!.held).toBeGreaterThanOrEqual(2);

  // L87-L90 are authored Hard.
  for (const row of rows.slice(6)) {
    expect(row.authored).toBe('hard');
    expect(row.nodes).toBeLessThan(100_000);
  }
  // L87 (Phoenix Sigil) tuned dense art delivers score ≥ 35 and 2 held launches.
  expect(rows[6]!.score).toBeGreaterThanOrEqual(35);
  expect(rows[6]!.held).toBeGreaterThanOrEqual(2);

  // L90 (Throne of Relics) grand finale features all three mechanics and 2 held launches.
  expect(rows[9]!.score).toBeGreaterThanOrEqual(25);
  expect(rows[9]!.held).toBeGreaterThanOrEqual(2);

  if (process.env.REPORT_WORLD_9) console.log(JSON.stringify(rows, null, 2));
}, 300_000);
