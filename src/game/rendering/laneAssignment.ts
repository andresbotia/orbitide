/**
 * Presentation-only radial lanes for concurrent Pals.
 *
 * A Pal keeps the lane it was given at launch for its whole flight. Lanes used
 * to be derived from a Pal's index in the current flights list, so whenever an
 * earlier Pal left, every Pal behind it shifted lanes — a 3–9 px sideways snap
 * in a single frame. Lanes only nudge Pals radially; rail order (FIFO) and the
 * convoy spacing are decided by progress and are unaffected.
 */

/** Lane slot index -> symmetric offset: 0, +1, −1, +2, −2 … steps. */
export function laneOffset(slot: number, stepPx: number): number {
  const step = Math.ceil(slot / 2);
  return (slot % 2 === 0 ? -step : step) * stepPx;
}

/**
 * Keep every present Pal's lane slot; give each newcomer the lowest slot no
 * present Pal is using. Pals no longer present release their slot. Returns the
 * previous map unchanged when nothing changed.
 */
export function assignLaneSlots(
  previous: ReadonlyMap<number, number>,
  passIds: readonly number[],
): ReadonlyMap<number, number> {
  const next = new Map<number, number>();
  const used = new Set<number>();
  for (const id of passIds) {
    const slot = previous.get(id);
    if (slot !== undefined) { next.set(id, slot); used.add(slot); }
  }
  for (const id of passIds) {
    if (next.has(id)) continue;
    let slot = 0;
    while (used.has(slot)) slot += 1;
    next.set(id, slot);
    used.add(slot);
  }
  if (next.size === previous.size && [...next].every(([id, slot]) => previous.get(id) === slot)) return previous;
  return next;
}
