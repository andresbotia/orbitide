/**
 * Centralized game-feel timing. Every millisecond value the presentation layer
 * uses lives here so it can be tuned in one place during device testing.
 *
 * Nothing here affects game truth — the engine resolves a launch instantly and
 * these constants only control how that already-committed result is staged.
 */
export const FEEL = {
  /** One full 360° lap of the orbital track. */
  ORBIT_DURATION: 1800,
  /** Extra fraction of a lap the charge coasts after its last pixel pop. */
  ORBIT_TAIL_FRACTION: 0.14,
  /** Hard cap on laps for very large clears. */
  MAX_ORBIT_LAPS: 3,

  /** Tunnel → orbit entry. */
  LAUNCH_DURATION: 340,

  /** Minimum spacing between consecutive pixel pops. */
  PIXEL_CLEAR_INTERVAL: 110,
  /** One pixel's pop (anticipation + collapse). */
  PIXEL_POP_DURATION: 160,

  /** Orbit exit → landing in a Holding slot. */
  HOLDING_TRAVEL_DURATION: 400,
  /** Holding slot → back onto the orbit for a held-charge relaunch. */
  HELD_LIFT_DURATION: 320,
  /** Gap between the end of one charge's pass and the next held-charge relaunch. */
  HELD_RELAUNCH_GAP: 160,

  /** Delay from the final pixel pop to showing the win/fail treatment. */
  WIN_DELAY: 300,
  FAIL_DELAY: 220,

  /** How long the flying capacity number takes to tween between values. */
  COUNTDOWN_TWEEN: 130,
} as const;

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
