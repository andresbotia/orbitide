import {
  difficultyA11yLabel,
  difficultyMeta,
  gateGeometry,
  gateIntroTimeline,
  gatePrimitives,
  MAX_DIFFICULTY_TIER,
} from '../difficulty';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';
import type { LevelDifficulty } from '../../engine/types';

const ALL: LevelDifficulty[] = ['easy', 'medium', 'hard', 'super-hard', 'extreme'];

test('every difficulty maps to an ascending tier within range and a valid accent', () => {
  let last = 0;
  for (const key of ALL) {
    const meta = difficultyMeta(key);
    expect(meta.key).toBe(key);
    expect(meta.tier).toBeGreaterThan(last);
    expect(meta.tier).toBeLessThanOrEqual(MAX_DIFFICULTY_TIER);
    expect(['accent', 'warn', 'danger']).toContain(meta.accent);
    last = meta.tier;
  }
});

test('unknown difficulty falls back to easy rather than throwing', () => {
  expect(difficultyMeta('bogus' as LevelDifficulty).key).toBe('easy');
  expect(gateGeometry('bogus' as LevelDifficulty).key).toBe('easy');
});

test('difficultyMeta is derived from the Gate model — one source of truth', () => {
  for (const key of ALL) {
    const g = gateGeometry(key);
    const m = difficultyMeta(key);
    expect(m).toEqual({ key: g.key, label: g.label, tier: g.tier, accent: g.accent });
  }
});

test('Gate geometry escalates by tier: frame, blocks, guard, fracture, weight', () => {
  const g = ALL.map(gateGeometry);
  expect(g.map((x) => x.tier)).toEqual([1, 2, 3, 4, 5]);
  expect(g.map((x) => x.label)).toEqual(['NORMAL', 'MEDIUM', 'HARD', 'SUPER HARD', 'EXTREME']);
  // Mounting-block count IS the tier — the reliable non-colour counter.
  expect(g.map((x) => x.blocks)).toEqual([1, 2, 3, 4, 5]);
  // Round for NORMAL/MEDIUM, angular for HARD+.
  expect(g.map((x) => x.frame)).toEqual(['ring', 'ring', 'hex', 'hex', 'hex']);
  // Segments: clean ring only at NORMAL, then non-decreasing.
  expect(g[0]!.segments).toBe(0);
  for (let i = 1; i < g.length; i++) expect(g[i]!.segments).toBeGreaterThanOrEqual(g[i - 1]!.segments);
  // Outer guard from SUPER HARD; fracture only EXTREME.
  expect(g.map((x) => x.outerGuard)).toEqual([false, false, false, true, true]);
  expect(g.map((x) => x.fracture)).toEqual([false, false, false, false, true]);
  // Line weight strictly increases.
  for (let i = 1; i < g.length; i++) expect(g[i]!.strokeScale).toBeGreaterThan(g[i - 1]!.strokeScale);
});

test('all five tiers are distinguishable without colour (grayscale / small size)', () => {
  const signature = (key: LevelDifficulty) => {
    const g = gateGeometry(key);
    return [g.frame, g.blocks, g.segments, g.outerGuard, g.fracture].join('|');
  };
  const sigs = ALL.map(signature);
  expect(new Set(sigs).size).toBe(ALL.length);

  // Every pair differs in at least two non-colour dimensions.
  for (let i = 0; i < ALL.length; i++) {
    for (let j = i + 1; j < ALL.length; j++) {
      const a = gateGeometry(ALL[i]!);
      const b = gateGeometry(ALL[j]!);
      const diffs = [
        a.frame !== b.frame,
        a.blocks !== b.blocks,
        a.segments !== b.segments,
        a.outerGuard !== b.outerGuard,
        a.fracture !== b.fracture,
      ].filter(Boolean).length;
      expect(diffs).toBeGreaterThanOrEqual(2);
    }
  }

  // The known prior risk: NORMAL vs MEDIUM.
  const n = gateGeometry('easy');
  const m = gateGeometry('medium');
  expect(n.blocks).not.toBe(m.blocks);
  expect(n.segments).not.toBe(m.segments);
});

test('gatePrimitives renders the tier structure at both compact and intro sizes', () => {
  for (const size of [18, 88]) {
    for (const key of ALL) {
      const g = gateGeometry(key);
      const p = gatePrimitives(key, size);
      expect(p.blocks).toHaveLength(g.blocks);
      expect(p.segmentTicks).toHaveLength(g.segments);
      expect(!!p.outerGuard).toBe(g.outerGuard);
      expect(!!p.fracture).toBe(g.fracture);
      expect(p.frame.kind).toBe(g.frame === 'ring' ? 'ring' : 'hex');
      expect(p.frame.path.startsWith('M')).toBe(true);
      expect(p.strokeWidth).toBeGreaterThan(0);
      for (const b of p.blocks) {
        expect(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.rot)).toBe(true);
      }
    }
    // Heavier tiers draw heavier lines at a fixed size.
    const weights = ALL.map((k) => gatePrimitives(k, size).strokeWidth);
    for (let i = 1; i < weights.length; i++) expect(weights[i]!).toBeGreaterThan(weights[i - 1]!);
  }
});

test('accessibility label is a readable difficulty sentence', () => {
  expect(difficultyA11yLabel('easy')).toBe('Difficulty: Normal');
  expect(difficultyA11yLabel('super-hard')).toBe('Difficulty: Super hard');
});

test('gate intro hooks scale with tier and only expose the structures a tier has', () => {
  let lastDuration = 0;
  for (const key of ALL) {
    const t = gateIntroTimeline(key);
    const g = gateGeometry(key);
    expect(t.duration).toBeGreaterThan(lastDuration);
    lastDuration = t.duration;
    for (const v of Object.values(t.phases)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(t.phases.guard > 0).toBe(g.outerGuard);
    expect(t.phases.fracture > 0).toBe(g.fracture);
    expect(t.sound).toBe(`gate_${key}`);
  }
});

test('every campaign level has a resolvable difficulty', () => {
  for (const level of LEVEL_DEFINITIONS) {
    expect(() => gateGeometry(level.difficulty)).not.toThrow();
    expect(gateGeometry(level.difficulty).tier).toBeGreaterThanOrEqual(1);
  }
});
