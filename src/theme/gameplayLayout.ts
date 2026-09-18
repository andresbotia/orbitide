/**
 * Gameplay-screen visual metrics for the Pixel Arcadia cabinet redesign.
 * Presentation only — engine rules, holding capacity, and orbit paths are
 * unchanged. Colors come from `homeV2` / `NEON`; this module is sizes.
 */
export const GAMEPLAY = {
  hudHeight: 44,
  hudButton: 36,
  hudButtonHit: 44,
  hudProgressHeight: 7,
  hudMedallion: 34,

  // Reserves room for GameScreen's board frame (padding + hairline border)
  // around the rail — the frame lives outside `boardWrap`, this is its budget.
  boardSidePad: 7,
  boardDeckGap: 8,

  /** Orbiting Pal visual size (pt). chargeRadius ≈ this / 2.1 */
  orbitingPalMin: 32,
  orbitingPalMax: 38,

  holdingWell: 62,
  holdingPal: 52,

  readyPalMin: 64,
  readyPalMax: 76,
  queuePalMin: 44,
  queuePalMax: 54,

  deckPadTop: 8,
  deckPadX: 10,
  deckPadBottom: 8,
  deckGap: 6,

  itemButton: 58,
  itemButtonHit: 64,
} as const;

/** Visual Pal size for a board whose shorter canvas edge is `short`. */
export function orbitingPalVisual(short: number): number {
  if (short < 300) return Math.max(16, Math.min(GAMEPLAY.orbitingPalMin, short * 0.1));
  return Math.max(
    GAMEPLAY.orbitingPalMin,
    Math.min(GAMEPLAY.orbitingPalMax, Math.round(short * 0.095)),
  );
}
