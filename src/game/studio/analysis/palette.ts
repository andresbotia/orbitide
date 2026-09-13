/**
 * Deterministic campaign palette comparison. Cheap — set math over authored
 * colour histograms, no solver. No hard rejection threshold; helpers only
 * flag high adjacent-level similarity for human review.
 */
import type { LevelDefinition, OrbColor } from '@/game/engine/types';
import { paletteSnapshot } from './boardMetrics';
import type {
  AdjacentPaletteComparison, AnalysisWarning, PaletteComparison, PaletteSnapshot,
} from './types';

export const PALETTE_REPEAT_THRESHOLDS = {
  /** Jaccard similarity of unique colour sets. */
  jaccard: 0.8,
  /** Shared colours among each level's dominant set. */
  dominantOverlap: 2,
} as const;

export function comparePalettes(a: PaletteSnapshot, b: PaletteSnapshot): PaletteComparison {
  return {
    jaccard: jaccard(a.uniqueColors, b.uniqueColors),
    dominantOverlap: intersectionSize(a.dominantColors, b.dominantColors),
  };
}

export function compareLevelPalettes(a: LevelDefinition, b: LevelDefinition): PaletteComparison {
  return comparePalettes(paletteSnapshot(a), paletteSnapshot(b));
}

/**
 * Adjacent-pair comparisons in the given campaign / batch order. O(n) in the
 * number of levels; histogram work is linear in occupied cells.
 */
export function adjacentPaletteComparisons(defs: readonly LevelDefinition[]): AdjacentPaletteComparison[] {
  const out: AdjacentPaletteComparison[] = [];
  for (let i = 1; i < defs.length; i += 1) {
    const from = defs[i - 1]!;
    const to = defs[i]!;
    const cmp = compareLevelPalettes(from, to);
    out.push({ fromLevelId: from.id, toLevelId: to.id, ...cmp });
  }
  return out;
}

export function paletteRepeatWarning(cmp: PaletteComparison): AnalysisWarning | null {
  const T = PALETTE_REPEAT_THRESHOLDS;
  if (cmp.jaccard < T.jaccard || cmp.dominantOverlap < T.dominantOverlap) return null;
  return {
    code: 'PALETTE_REPEAT',
    severity: 'info',
    message: 'Adjacent levels share a very similar palette.',
    detail: `Jaccard ${cmp.jaccard.toFixed(2)} (threshold ${T.jaccard}), dominant overlap ${cmp.dominantOverlap} (threshold ${T.dominantOverlap}).`,
  };
}

function jaccard(a: readonly OrbColor[], b: readonly OrbColor[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setB = new Set(b);
  let inter = 0;
  for (const c of a) if (setB.has(c)) inter += 1;
  const union = a.length + b.length - inter;
  return union > 0 ? inter / union : 1;
}

function intersectionSize(a: readonly OrbColor[], b: readonly OrbColor[]): number {
  const setB = new Set(b);
  let n = 0;
  for (const c of a) if (setB.has(c)) n += 1;
  return n;
}
