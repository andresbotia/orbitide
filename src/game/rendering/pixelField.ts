import type { OrbColor, Pixel } from '@/game/engine/types';

/**
 * Pure model behind `StaticPixelField` — which board pixels are drawn, and how
 * they group into batched paint variants. No Skia, no React, so the field's
 * visibility and reachability rules are unit-testable on their own, the same
 * way `specialPixels.ts` backs `SpecialPixelLayer`.
 */

/** One paint variant. Every pixel in a bucket produces identical colours. */
export interface Bucket {
  color: OrbColor;
  reachable: boolean;
  /** Quantised `modifierDim`, so near-identical dims share one set of paths. */
  dimStep: number;
  /** Indices into the source `pixels` array, ascending — the exact membership. */
  members: number[];
}

/** Dim is continuous; 4 steps is finer than the eye reads and bounds the buckets. */
export const DIM_STEPS = 4;

/**
 * Group every pixel that should currently be drawn by its paint variant.
 *
 * This is the whole of the field's visibility rule: a pixel is drawn unless it
 * is cleared or an active flight is popping it, and its bucket carries the
 * colour, the reachability the renderer dims by, and the quantised modifier dim.
 * Bucketing is what lets one clear rebuild a single group's paths instead of
 * every pixel on the board.
 */
export function buildPixelBuckets(
  pixels: readonly Pixel[],
  hiddenIds: ReadonlySet<string>,
  dimById: ReadonlyMap<string, number>,
  isReachable: (pixel: Pixel) => boolean,
): Map<string, Bucket> {
  const byKey = new Map<string, Bucket>();
  for (let i = 0; i < pixels.length; i += 1) {
    const p = pixels[i]!;
    if (p.cleared || hiddenIds.has(p.id)) continue;
    const reachable = isReachable(p);
    const dimStep = Math.round((dimById.get(p.id) ?? 0) * DIM_STEPS);
    const key = `${p.color}|${reachable ? 1 : 0}|${dimStep}`;
    const found = byKey.get(key);
    if (found) found.members.push(i);
    else byKey.set(key, { color: p.color, reachable, dimStep, members: [i] });
  }
  return byKey;
}

/** True when two ascending index lists describe the same membership. */
export function sameMembers(a: readonly number[], b: readonly number[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}
