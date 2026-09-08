/**
 * Canonical entry angle (screen radians) for each Launch Tunnel, ordered to
 * match the on-screen T1/T2/T3 bar left-to-right. `layout.ts` derives the board
 * tunnel-port positions from this same array so the charge always launches from
 * where the port is drawn.
 */
export const TUNNEL_ENTRY_ANGLE = [
  Math.PI - Math.PI / 4.5, // T1 lower-left
  Math.PI / 2, // T2 bottom
  Math.PI / 4.5, // T3 lower-right
] as const;

/** The same entry angles expressed as clock fractions in [0, 1) (0 = top). */
export const TUNNEL_ENTRY_FRACTION = TUNNEL_ENTRY_ANGLE.map((a) => {
  const twoPi = Math.PI * 2;
  return (((a + Math.PI / 2) % twoPi) + twoPi) % twoPi / twoPi;
});

/** Held charges enter from the bottom of the same clockwise circular path. */
export const HELD_ENTRY_FRACTION = 0.5;
export function clockwiseGap(from: number, to: number): number {
  return ((to - from) % 1 + 1) % 1;
}
