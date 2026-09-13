/**
 * PIXEL ARCADIA MOTION SYSTEM (redesign Milestone 1).
 *
 * Reusable UI-chrome motion language: press feedback, panels/cards, alert
 * pulses, reward/success beats. This is presentation-only vocabulary — no
 * screen is rewired to use it in this milestone.
 *
 * Explicitly OUT of scope: gameplay-board choreography. Launch/orbit/clear
 * timing is engine-driven and lives in `game/presentation/motion.ts` +
 * `game/presentation/constants.ts` (`FEEL`, `LAUNCH_HUB`) — those are tuned
 * against precise engine event timestamps and must not be touched or
 * duplicated here. Brand-moment motion (splash/logo/CTA glow) similarly stays
 * in `theme/brand.ts`'s `brandMotion` — this module is the general product-
 * chrome layer that sits between those two, for buttons/cards/panels/alerts.
 *
 * Three duration tiers, per the redesign brief:
 *   MICRO    50-150ms  button/selection/press response
 *   STANDARD 150-350ms cards/panels/HUD chrome movement
 *   MAJOR    350-800ms wins/world transitions/reward moments
 */
export const motionTier = {
  micro: { min: 50, max: 150 },
  standard: { min: 150, max: 350 },
  major: { min: 350, max: 800 },
} as const;

export type MotionTierName = keyof typeof motionTier;

export interface SpringConfig {
  damping: number;
  stiffness: number;
  mass?: number;
}

export interface MotionPreset {
  tier: MotionTierName;
  durationMs: number;
  easing: 'linear' | 'easeOut' | 'easeInOut' | 'spring';
  /** Present only when `easing === 'spring'`. */
  spring?: SpringConfig;
  /** What a reduced-motion viewer sees instead of the animated path. */
  reducedMotion: 'end-state' | 'static-hold';
}

/**
 * Named motion primitives. Each name is a reusable *intent* ("this is what a
 * press looks like everywhere"), not a per-component one-off. When a later
 * milestone adds real motion to a screen, it should reach for one of these
 * (or add a new named entry here) rather than hand-rolling a duration/easing
 * pair at the call site — the same discipline `brandMotion` already applies
 * to brand moments.
 */
export const motion = {
  // MICRO — 50-150ms ------------------------------------------------------
  /** Pressed-state squash on a tappable control. */
  pressSquash: { tier: 'micro', durationMs: 80, easing: 'easeOut', reducedMotion: 'end-state' },
  /** Release/settle back to rest after a press. */
  release: { tier: 'micro', durationMs: 120, easing: 'spring', spring: { damping: 14, stiffness: 260 }, reducedMotion: 'end-state' },
  /** A lightweight selection/navigation tick (tab, chip, list-row focus). */
  selectionTick: { tier: 'micro', durationMs: 60, easing: 'linear', reducedMotion: 'end-state' },

  // STANDARD — 150-350ms ---------------------------------------------------
  /** A panel/sheet entering the screen (e.g. a future modal). */
  panelEnter: { tier: 'standard', durationMs: 220, easing: 'easeOut', reducedMotion: 'end-state' },
  /** A card/tile entering a list (world cards, level nodes). */
  cardEnter: { tier: 'standard', durationMs: 240, easing: 'spring', spring: { damping: 18, stiffness: 210 }, reducedMotion: 'end-state' },
  /** A repeating attention pulse for a warning/pressure state (e.g. Holding near-full). */
  warningPulse: { tier: 'standard', durationMs: 260, easing: 'easeInOut', reducedMotion: 'static-hold' },

  // MAJOR — 350-800ms -------------------------------------------------------
  /** A success confirmation beat (level objective met, useful action landed). */
  successResponse: { tier: 'major', durationMs: 420, easing: 'spring', spring: { damping: 16, stiffness: 180 }, reducedMotion: 'end-state' },
  /** A reward/payoff moment (win reveal beats, capstone emphasis). */
  rewardResponse: { tier: 'major', durationMs: 600, easing: 'easeOut', reducedMotion: 'end-state' },
} as const satisfies Record<string, MotionPreset>;

export type MotionName = keyof typeof motion;

/** Clamp an arbitrary ms value into a named tier's declared range. */
export function clampToTier(tier: MotionTierName, ms: number): number {
  const { min, max } = motionTier[tier];
  return Math.min(max, Math.max(min, ms));
}
