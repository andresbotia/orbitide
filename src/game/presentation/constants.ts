/** Motion durations are presentation-only. A moving lap is still 1800ms. */

/**
 * Shared launch-hub choreography (all TUNABLE). A launched charge lifts from its
 * source, travels to LAUNCH_HUB, briefly seats, then moves radially out to
 * ORBIT_INSERTION before the orbit begins. `LAUNCH_DURATION` is the sum, so the
 * rest of the timeline (which is written relative to `LAUNCH_DURATION`) is
 * unaffected by how the lift is split internally.
 */
export const LAUNCH_HUB = {
  /** Source button -> LAUNCH_HUB. */
  APPROACH: 200,
  /** Seat / align at the hub. */
  SEAT: 60,
  /** LAUNCH_HUB -> ORBIT_INSERTION (radial). */
  TO_INSERTION: 140,
} as const;

/**
 * M5.8 — Core V2's readable perimeter pass. Legacy V1 keeps
 * `FEEL.ORBIT_DURATION` (1800ms) exactly as before; this only applies to
 * `coreV2` passes (selected in `buildScript.ts`, never scattered as a magic
 * number elsewhere). One obvious tunable: convoy pauses can make a lap feel
 * slower than this base, so perceived speed is tuned here first.
 */
export const CORE_V2_ORBIT_DURATION_MS = 6000;

/**
 * M5.8 — minimum Core V2 rail gap between consecutive active Pals, as a
 * fraction of one lap. Launch/tap order is preserved; a trailing Pal may
 * close to this bumper but never overtake. Presentation-only.
 */
export const CORE_V2_CONVOY_SPACING = 0.045;

export const FEEL = {
  ORBIT_DURATION: 1800,
  LAUNCH_DURATION: LAUNCH_HUB.APPROACH + LAUNCH_HUB.SEAT + LAUNCH_HUB.TO_INSERTION,
  ANTICIPATION_DURATION: 20,
  ENERGY_TRAVEL_DURATION: 80,
  IMPACT_DURATION: 10,
  PIXEL_CLEAR_INTERVAL: 110,
  PIXEL_POP_DURATION: 100,
  HOLDING_TRAVEL_DURATION: 300,
  BURST_DURATION: 180,
  WIN_DELAY: 200,
  FAIL_DELAY: 160,
} as const;

/**
 * Single tunable multiplier for the per-encounter presentation (anticipation +
 * projectile + impact). Kept at 1 for M1 parity; wiring it below 1 tightens
 * dense sweeps without touching engine truth.
 */
export const ENCOUNTER_SCALE = 1;
