/**
 * Frozen — the first implemented special-pixel mechanic. Pure, engine-owned.
 *
 * A Frozen pixel keeps its base colour but wears a thick ice shell. A matching
 * charge that reaches it spends one capacity to crack one ice layer; the base
 * pixel is untouched and stays on the board. Only once every ice layer is gone
 * does a further matching hit clear the pixel normally.
 *
 *   authored `modifier.level` = ice layers (durability). Default 1.
 *   each matching encounter:  level -= 1   (one capacity spent)
 *   level reaches 0:          `state: 'broken'` — the pixel is now a normal
 *                             uncleared pixel; the next matching hit clears it.
 *
 * Exposure is unchanged: a Frozen cell (iced or broken) is solid until the
 * pixel itself clears — the flood fill never treats it as empty. Reachability,
 * the clockwise clear order and the deterministic concurrent arbitration are
 * all exactly as before; the only new rule is "an iced pixel eats a hit without
 * clearing".
 */
import type { ModifierInstance, Pixel } from './types';

/** Ice layers still shielding this pixel (0 for a normal or already-thawed pixel). */
export function iceLayers(pixel: Pick<Pixel, 'cleared' | 'modifier'>): number {
  const m = pixel.modifier;
  if (!m || m.kind !== 'frozen' || pixel.cleared) return 0;
  return Math.max(0, Math.trunc(m.level ?? 1));
}

/** Whether a matching hit on this pixel would crack ice rather than clear it. */
export function isIced(pixel: Pick<Pixel, 'cleared' | 'modifier'>): boolean {
  return iceLayers(pixel) > 0;
}

/** Energy-shield layers still protecting this pixel. Production uses one. */
export function shieldLayers(pixel: Pick<Pixel, 'cleared' | 'modifier'>): number {
  const m = pixel.modifier;
  if (!m || m.kind !== 'shielded' || pixel.cleared) return 0;
  return Math.max(0, Math.trunc(m.level ?? 1));
}

export function isShielded(pixel: Pick<Pixel, 'cleared' | 'modifier'>): boolean {
  return shieldLayers(pixel) > 0;
}

export interface MatchingHitResult {
  /** The pixel after the hit (structurally shared when nothing changed). */
  pixel: Pixel;
  /** `true` when the pixel became `cleared` this hit. */
  cleared: boolean;
  /** `true` when this hit cracked an ice layer instead of clearing. */
  frozenBreak: boolean;
  /** `true` when this hit collapsed an energy shield instead of clearing. */
  shieldBreak: boolean;
}

/**
 * Resolve one matching-colour encounter landing on `pixel`. One capacity is
 * always spent by the caller regardless of which branch this takes.
 */
export function resolveMatchingHit(pixel: Pixel): MatchingHitResult {
  const layers = iceLayers(pixel);
  if (layers > 0) {
    const remaining = layers - 1;
    const modifier: ModifierInstance = {
      ...(pixel.modifier as ModifierInstance),
      kind: 'frozen',
      level: remaining,
      state: remaining === 0 ? 'broken' : 'intact',
      progress: 1,
    };
    return { pixel: { ...pixel, modifier }, cleared: false, frozenBreak: true, shieldBreak: false };
  }
  const shields = shieldLayers(pixel);
  if (shields > 0) {
    const remaining = shields - 1;
    const modifier: ModifierInstance = {
      ...(pixel.modifier as ModifierInstance),
      kind: 'shielded',
      level: remaining,
      state: remaining === 0 ? 'broken' : 'intact',
      progress: 1,
    };
    return { pixel: { ...pixel, modifier }, cleared: false, frozenBreak: false, shieldBreak: true };
  }
  return { pixel: { ...pixel, cleared: true }, cleared: true, frozenBreak: false, shieldBreak: false };
}

/**
 * One char per pixel capturing everything a solver / epoch memo key must
 * distinguish: `1` cleared, `0` an open uncleared pixel (normal OR thawed
 * Frozen), `B`–`E` an iced Frozen pixel with 1–4 layers left. Equivalent boards
 * — including a thawed Frozen pixel vs a plain uncleared one — collapse to the
 * same string on purpose.
 */
export function boardFingerprint(pixels: readonly Pixel[]): string {
  return pixels.map((p) => {
    if (p.cleared) return 'C';
    if (p.modifier?.kind === 'frozen') {
      const layers = iceLayers(p);
      return layers > 0 ? `F${layers}` : 'FB';
    }
    if (p.modifier?.kind === 'shielded') {
      const layers = shieldLayers(p);
      return layers > 0 ? `S${layers}` : 'SB';
    }
    return 'N';
  }).join('.');
}
