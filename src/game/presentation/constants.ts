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

  /** Tunnel → orbit entry. */
  LAUNCH_DURATION: 340,

  /** Minimum spacing between consecutive pixel pops. */
  PIXEL_CLEAR_INTERVAL: 110,
  /** Short streak travel followed by target anticipation, before the clear. */
  ENERGY_SHOT_DURATION: 100,
  ENERGY_TRAVEL_DURATION: 75,
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

export { TUNNEL_ENTRY_ANGLE, TUNNEL_ENTRY_FRACTION } from '../engine/orbit';
