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
/**
 * Every flight ends in exactly one of three ways (§ terminal contract):
 * - `consumed`  — ends at its last successful hit; never returns to GateTerminal.
 * - `toHolding` — full lap to GateTerminal, then GateTerminal → exactly `slot`.
 *   `slot` is the Pal's index in the latest reconciled truth Holding; `target`
 *   is that slot's measured screen point (absent only while unmeasured — the Pal
 *   then waits at GateTerminal, never at an off-screen fallback).
 * - `reject`    — full lap to GateTerminal and bursts in place; Holding unchanged.
 */
export type FlightTerminal =
  | { kind: 'consumed' }
  | { kind: 'toHolding'; slot: number; target?: Point; retargets?: HoldingRetarget[] }
  | { kind: 'reject' };

/**
 * Presentation only: a Holding target this Pal was already flying toward when
 * its slot moved (`at` is pass time). The landing re-aims from where the Pal
 * visibly was at `at`, so the path stays continuous.
 */
export interface HoldingRetarget { at: number; target?: Point }

/** One independent charge's script and its UI-thread clock form one playback unit. */
export interface FlightPass {
  passId: number;
  origin: 'tunnel' | 'holding';
  sourceIndex: number;
  from?: Point;
  terminal: FlightTerminal;
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
  /** Derived by `finalizePass` from the fields above; never edited by hand. */
  totalMs: number;
  /** Holding-pressure cue this landing raises (toHolding only). */
  holdingCue?: 'critical' | 'full';
  /** Level result this pass carries, presented after its terminal beat. */
  result?: 'win' | 'fail';
  /** Derived by `finalizePass` from the fields above; never edited by hand. */
  events: PlaybackEvent[];
  /** Pixel id of the clear that wins the level on this pass, if any. */
  finalClearPixelId?: string;
  /**
   * Presentation-clock origin for this pass (`Date.now()` at launch). The
   * UI clock is anchored to it, convoy scheduling aligns leaders with it, and
   * re-scripting uses it to know how much of the pass is already presented.
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
