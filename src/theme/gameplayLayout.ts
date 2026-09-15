/**
 * Gameplay-screen visual metrics for the Pixel Arcadia cabinet redesign.
 * Presentation only — engine rules, holding capacity, and orbit paths are
 * unchanged. Colors come from `homeV2` / `NEON`; this module is sizes.
 */
export const GAMEPLAY = {
  hudHeight: 48,
  hudButton: 38,
  hudButtonHit: 44,
  hudProgressHeight: 8,
  hudMedallion: 36,

  boardSidePad: 8,
  boardDeckGap: 6,

  /** Orbiting Pal visual size (pt). chargeRadius ≈ this / 2.1 */
  orbitingPalMin: 32,
  orbitingPalMax: 38,

  holdingWell: 56,
  holdingPal: 48,

  readyPalMin: 60,
  readyPalMax: 70,
  queuePalMin: 42,
  queuePalMax: 52,

  deckPadTop: 10,
  deckPadX: 12,
  deckPadBottom: 10,
  deckGap: 8,

  itemButton: 44,
  itemButtonHit: 44,
} as const;

/** Visual Pal size for a board whose shorter canvas edge is `short`. */
export function orbitingPalVisual(short: number): number {
  if (short < 300) return Math.max(16, Math.min(GAMEPLAY.orbitingPalMin, short * 0.1));
  return Math.max(
    GAMEPLAY.orbitingPalMin,
    Math.min(GAMEPLAY.orbitingPalMax, Math.round(short * 0.095)),
  );
}
