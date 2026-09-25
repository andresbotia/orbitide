/**
 * M5.8B — gameplay chrome motion constants (all TUNABLE). Pure data + pure
 * worklet helpers, so they are unit-testable without React Native.
 *
 * Board choreography that is tied to engine timestamps (lift, shots, lap,
 * landing, result beats) stays in `game/presentation/constants.ts`; nothing
 * here moves an engine event. These are the ACTION → RESPONSE → SETTLE beats
 * the chrome plays around them.
 */
export const GP_MOTION = {
  /** Touch-down depth on any gameplay control. */
  pressInMs: 55,
  pressSpring: { damping: 15, stiffness: 320 },

  /**
   * Accepted tunnel launch: lip energy flash, then the queue advances.
   * Device QA — the bay itself no longer moves vertically and the advance is a
   * plain ease-out, not a spring: springs read as bobbing on an already busy
   * screen (ACTION -> RESPONSE -> SETTLE, never bounce-bounce-settle).
   */
  lipRiseMs: 50,
  lipFallMs: 220,
  queueAdvanceMs: 170,
  queueAdvanceReducedMs: 90,

  /** Refusals. `firm` = ACTIVE full, `soft` = any other reason. */
  shakeFirm: [-4, 4, -3, 0] as readonly number[],
  shakeSoft: [-2, 2, 0] as readonly number[],
  shakeStepMs: 45,

  /** ACTIVE capacity refusal (behaviour locked: red flash + ~1.14× pulse). */
  capacityRiseMs: 70,
  capacityFallMs: 430,
  capacityScale: 0.14,

  /** Holding. */
  captureMs: 320,
  releaseMs: 240,
  wellDip: { damping: 13, stiffness: 240 },

  /** Gate responses, in pass time relative to their engine beat. */
  gateTransitLeadMs: 40,
  gateTransitMs: 260,
  gateCaptureMs: 320,
  gateRejectMs: 360,

  /** Launch trail, from launch until rail entry. */
  trailStartMs: 40,

  /** Count-badge tick on each hit. */
  badgeTickMs: 150,
  badgeTickScale: 0.22,

  /** Loss card after the (unchanged) result beat. */
  lossCardMs: 260,
  lossCardRise: 18,

  /** Board (re)entry after the intro lifts / on retry, and the NEXT exit fade. */
  boardEntryMs: 220,
  exitFadeMs: 160,
  reducedFadeMs: 90,
} as const;

/** 0..1 → 0..1 → 0 envelope for a one-shot pulse of `ms`, rising over `rise`. */
export function pulseEnvelope(elapsed: number, ms: number, rise: number): number {
  'worklet';
  if (elapsed < 0 || elapsed >= ms) return 0;
  if (elapsed < rise) return elapsed / Math.max(1, rise);
  return 1 - (elapsed - rise) / Math.max(1, ms - rise);
}
