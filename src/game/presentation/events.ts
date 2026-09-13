import type { Charge } from '@/game/engine/types';
export interface Point { x: number; y: number }
export interface Shot {
  pixelId: string;
  progress: number;
  target: { x: number; y: number };
  anticipateAt: number;
  fireAt: number;
  impactAt: number;
  clearAt: number;
  remaining: number;
  /** `true` when this shot cracks a Frozen ice layer — the pixel stays on the board. */
  frozenBreak?: boolean;
  shieldBreak?: boolean;
  linkedPrime?: boolean;
  linkedGroupClear?: boolean;
  linkedGroupId?: string;
  linkedClearedPixelIds?: string[];
  linkedClearTargets?: { pixelId: string; x: number; y: number; color: Charge['color'] }[];
}
export type PlaybackKind = 'orbitEnter' | 'pixelClear' | 'frozenHit' | 'shieldHit' | 'linkPrime' | 'linkGroupClear' | 'chargeConsumed' |
  'holdingLanded' | 'holdingCritical' | 'holdingFull' | 'win' | 'fail' | 'complete';
export interface PlaybackEvent { kind: PlaybackKind; at: number; pixelId?: string; remaining?: number;
  pixelIds?: string[]; groupId?: string;
  /** Set on the pixelClear that completes the picture — a stronger presentation beat. */
  final?: boolean }
/** One independent charge's script and its UI-thread clock form one playback unit. */
export interface FlightPass {
  passId: number;
  origin: 'tunnel' | 'holding';
  sourceIndex: number;
  from?: Point;
  holdingTarget?: Point;
  /**
   * Compact presented-Holding index this pass will occupy. Assigned at launch
   * (and reassigned if a landed Pal is relaunched and frees a lower slot).
   * Undefined on burst / non-Holding endings.
   */
  holdingSlotIndex?: number;
  charge: Charge;
  shots: Shot[];
  liftMs: number;
  /**
   * Wall-clock duration of one full perimeter pass for this specific charge —
   * `FEEL.ORBIT_DURATION` (1800ms) for Legacy V1, `CORE_V2_ORBIT_DURATION_MS`
   * for Core V2. Resolved once in `buildLaunchScript` from the charge's
   * ruleset so worklets (`motion.ts`) never need ruleset lookups.
   */
  orbitDurationMs: number;
  orbitEndAt: number;
  endProgress: number;
  landingAt: number;
  totalMs: number;
  endKind: 'burst' | 'toHolding';
  events: PlaybackEvent[];
  /** Pixel id of the clear that wins the level on this pass, if any. */
  finalClearPixelId?: string;
  /**
   * Presentation-clock origin for this pass (`Date.now()` at launch). Used by
   * Core V2 convoy scheduling to align an already-flying leader with a new
   * follower. 0 when unused (Legacy V1).
   */
  launchedAtMs: number;
  /**
   * Extra Core V2 dwells that freeze this Pal behind the Pal ahead. Empty on
   * Legacy V1 and on a Core V2 pass with nobody ahead.
   */
  convoyHolds: ConvoyHold[];
}

/** One convoy bumper-wait: freeze at `progress` from `startAt` to `endAt`. */
export interface ConvoyHold {
  progress: number;
  startAt: number;
  endAt: number;
}
export interface PresentationScript { pass: FlightPass; totalMs: number }
