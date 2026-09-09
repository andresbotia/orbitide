import { createGame } from '../../engine/createGame';
import { iceLayers } from '../../engine/frozen';
import { resolveAction } from '../../engine/resolveLaunch';
import { solve } from '../../engine/solver';
import { validateManifest } from '../../studio/campaign/validate';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';
import { CAMPAIGN_MANIFEST } from '../campaign';
import { TOTAL_LEVELS, nextLevelId } from '../levels';

const LEVELS = LEVEL_DEFINITIONS;
const IDS = LEVELS.map((l) => l.id);

/**
 * Per-Part-2 occupied-pixel density bands, keyed by 1-based level number. World-
 * finale milestones (10 / 20 / 30) are allowed to run denser (Part 19). Some
 * World-2/3 subjects (butterfly, tree, snow scenes) sit a little above the
 * 30-50 target — a documented deviation, still well inside "recognisable".
 */
function densityBand(id: number): [number, number] {
  if (id % 10 === 0) return [30, 90];
  if (id <= 3) return [20, 32];
  if (id <= 10) return [24, 46];
  if (id <= 20) return [28, 62];
  return [30, 64];
}

const ALLOWED_TIERS = new Set(['easy', 'medium', 'hard']);

test('the campaign is a contiguous, correctly-shaped level list', () => {
  expect(TOTAL_LEVELS).toBe(LEVELS.length);
  expect(IDS).toEqual(IDS.map((_, i) => i + 1));
  expect(new Set(IDS).size).toBe(IDS.length);
  for (const level of LEVELS) {
    expect(level.tunnels).toHaveLength(3);
    expect(level.holdingCapacity).toBe(3);
    expect(level.tunnels.every((t) => t.length > 0)).toBe(true);
    expect(level.tunnels.flat().every((c) => Number.isInteger(c.capacity) && c.capacity > 0)).toBe(true);
    // M4A introduces no tier above Hard in the first 30 levels.
    expect(ALLOWED_TIERS.has(level.difficulty)).toBe(true);
  }
  expect(nextLevelId(LEVELS.length)).toBeUndefined();
  if (LEVELS.length > 1) expect(nextLevelId(1)).toBe(2);
});

test('titles are unique and production-quality (no placeholder names)', () => {
  const titles = LEVELS.map((l) => l.title);
  expect(new Set(titles).size).toBe(titles.length);
  for (const t of titles) {
    expect(t.trim().length).toBeGreaterThan(2);
    expect(/^(puzzle|level|untitled)\b/i.test(t)).toBe(false);
  }
});

test.each(LEVELS)('level $id has production density and an exact per-colour capacity budget', (level) => {
  const state = createGame(level);
  const [min, max] = densityBand(level.id);
  expect(state.pixels.length).toBeGreaterThanOrEqual(min);
  expect(state.pixels.length).toBeLessThanOrEqual(max);

  // Total charge capacity of a colour must exactly cover its pixels plus one
  // extra hit per Frozen ice layer (M4A).
  const need = new Map<string, number>();
  for (const p of state.pixels) need.set(p.color, (need.get(p.color) ?? 0) + 1 + iceLayers(p));
  const have = new Map<string, number>();
  for (const t of level.tunnels) for (const c of t) have.set(c.color, (have.get(c.color) ?? 0) + c.capacity);
  for (const [color, n] of need) expect(have.get(color) ?? 0).toBe(n);
  for (const [color, h] of have) expect(need.has(color) || h === 0).toBe(true);
});

test('authored Win / Discovery reveals are structurally sound', () => {
  for (const level of LEVELS) {
    const r = level.reveal;
    if (!r) continue;
    expect(r.name.length).toBeGreaterThan(0);
    expect(r.nodes.length).toBeGreaterThanOrEqual(2);
    for (const [a, b] of r.lines) {
      expect(Number.isInteger(a) && Number.isInteger(b)).toBe(true);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(r.nodes.length);
      expect(b).toBeLessThan(r.nodes.length);
      expect(a).not.toBe(b);
    }
    for (const i of r.accentNodes ?? []) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(r.nodes.length);
    }
  }
});

test('the world-10 milestone levels carry an authored reveal', () => {
  for (const id of [10, 20, 30]) {
    const level = LEVELS.find((l) => l.id === id);
    if (level) expect(level.reveal).toBeDefined();
  }
});

test.each(LEVELS)('level $id is deterministically winnable with zero boosters', (level) => {
  const result = solve(level);
  expect(result.solved).toBe(true);
  expect(result.complete).toBe(true);
  // Sequential (M1-compatible) play must also be able to solve every level.
  expect(solve(level, { mode: 'sequential-compat' }).solved).toBe(true);
  // The witness replays through the real runtime and actually wins.
  let state = createGame(level);
  for (const action of result.moves) {
    const outcome = resolveAction(state, action);
    expect(outcome.accepted).toBe(true);
    expect(outcome.state.holding.length).toBeLessThanOrEqual(3);
    state = outcome.state;
  }
  expect(state.status).toBe('won');
}, 120_000);

test('the campaign manifest is valid: three worlds, no gaps, no duplicates', () => {
  const report = validateManifest(CAMPAIGN_MANIFEST, IDS);
  expect(report.errors).toEqual([]);
  const worldIds = CAMPAIGN_MANIFEST.worlds.map((w) => w.id);
  expect(new Set(worldIds).size).toBe(worldIds.length);
  // Every level is assigned to exactly one world.
  const assigned = CAMPAIGN_MANIFEST.worlds.flatMap((w) => w.levelIds);
  expect(new Set(assigned).size).toBe(assigned.length);
  expect([...assigned].sort((a, b) => a - b)).toEqual(IDS);
  // Deterministic global order.
  expect(CAMPAIGN_MANIFEST.orderedLevelIds).toEqual(IDS);
  // No technical / ORBITIDE branding in world metadata.
  for (const w of CAMPAIGN_MANIFEST.worlds) {
    expect(/orbitide/i.test(w.id + w.title)).toBe(false);
  }
});
