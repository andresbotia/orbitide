/**
 * M2B active-orbit concurrency constants. Every value here is a gameplay
 * TUNABLE — they are collected in one module so a designer can find them.
 *
 * The unit for all logical-time values is one **orbit lap** (a full trip around
 * the rail). 1 lap == `FEEL.ORBIT_DURATION` ms is a presentation fact only; the
 * engine never reads wall-clock time.
 */

/** Default concurrent-pass capacity. Call sites should read `GameState.activeCapacity`. */
export const DEFAULT_ACTIVE_CAPACITY = 5;

/** Back-compat alias of {@link DEFAULT_ACTIVE_CAPACITY}. Prefer `state.activeCapacity`. */
export const MAX_ACTIVE_CHARGES = DEFAULT_ACTIVE_CAPACITY;

/**
 * Logical laps between the insertion points of two consecutive launches in the
 * same epoch. Fixed on purpose: only launch **order** and **count** affect the
 * outcome, never how fast the player taps. Five rapid launches insert at
 * 0, 0.18, 0.36, 0.54, 0.72 — evenly spread around the ring.
 */
export const LAUNCH_SPACING = 0.18;

/**
 * Logical-lap tolerance for "these two encounters happen at the same time".
 * Within this window the deterministic tie-break (launch sequence, then target
 * id) decides the winner.
 */
export const ENCOUNTER_EPSILON = 1e-6;
