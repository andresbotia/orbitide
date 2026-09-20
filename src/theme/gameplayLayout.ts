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

/* -------------------------------------------------------------------------- */
/*  M5.8B device QA — tunnel queue hierarchy + active count plate              */
/* -------------------------------------------------------------------------- */

/** Bay padding around the ready Pal (pt). Must exceed the ready badge's drop. */
export const BAY_PAD = 5;
/**
 * Queue hierarchy. The ready Pal is the focus (scale 1, full opacity, seated
 * in the bay); each upcoming Pal steps down in size and emphasis so the stack
 * reads as "these are coming next".
 *
 * `QUEUE_TUCK[i]` is how far slot `i` hides behind what sits above it, as a
 * fraction of its own size. Slot 0 never tucks — it clears the ready Pal's own
 * count badge by {@link QUEUE_GAP} — and only deeper slots tuck, which keeps
 * the column about the height it was rather than stealing board space.
 */
export const QUEUE_SCALE: readonly number[] = [0.62, 0.48];
export const QUEUE_TUCK: readonly number[] = [0, 0.42];
export const QUEUE_OPACITY: readonly number[] = [0.9, 0.68];
/** Clear space under the ready Pal's badge before the first queue chip (pt). */
export const QUEUE_GAP = 2;

function atSlot(table: readonly number[], i: number): number {
  return table[i] ?? table[table.length - 1] ?? 0;
}

/** Pal size for each visible queue slot, largest first. */
export function queueSizes(readySize: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => Math.round(readySize * atSlot(QUEUE_SCALE, i)));
}

/** Top of queue slot `i` inside the queue column (matches the tuck margins). */
export function queueSlotY(i: number, sizes: readonly number[]): number {
  let y = QUEUE_GAP;
  for (let k = 1; k <= i; k++) y += (sizes[k - 1] ?? 0) - (sizes[k] ?? 0) * atSlot(QUEUE_TUCK, k);
  return y;
}

/** Margin that positions slot `i` (slot 0 sits below the bay, never under it). */
export function queueSlotMargin(i: number, size: number): number {
  return i === 0 ? QUEUE_GAP : -size * atSlot(QUEUE_TUCK, i);
}

/** Opacity for slot `i`. */
export function queueSlotOpacity(i: number): number {
  return atSlot(QUEUE_OPACITY, i);
}

/** Total height of the queue column below the bay (pt). */
export function queueColumnHeight(readySize: number, count: number): number {
  const sizes = queueSizes(readySize, count);
  return sizes.reduce((h, size, i) => h + queueSlotMargin(i, size) + size, 0);
}

/**
 * The in-flight count plate (device QA): at the old 14pt/9.5pt the remaining
 * count was unreadable at arm's length over busy pixel art. ~16pt plate with a
 * ~10.5pt numeral on a 34pt Pal.
 */
export const ACTIVE_BADGE_MIN_HEIGHT = 16;
export const ACTIVE_BADGE_MIN_FONT = 10.5;

export function activePalBadge(palSize: number): { height: number; fontSize: number } {
  const height = Math.max(ACTIVE_BADGE_MIN_HEIGHT, palSize * 0.46);
  return { height, fontSize: Math.max(ACTIVE_BADGE_MIN_FONT, height * 0.66) };
}
