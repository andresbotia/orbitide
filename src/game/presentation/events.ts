import type { Charge, OrbColor } from '@/game/engine/types';

/**
 * One charge's visible trip: tunnel/holding → orbit → burst or back to holding.
 * A launch that also triggers held-charge auto-resolutions produces several
 * passes played back to back (Milestone 1 is deliberately sequential — one
 * charge visible at a time). `OrbitingCharge` renders a single pass; the
 * session hook re-triggers it per pass, which is also what makes M2's multiple
 * simultaneous orbits a matter of rendering several `OrbitingCharge` instances.
 */
export interface FlightPass {
  passId: number;
  origin: 'tunnel' | 'holding';
  /** Tunnel index when `origin === 'tunnel'`. */
  tunnelIndex: number;
  /** Clock fraction [0,1) where the charge joins the orbit (0 = top). */
  entryFraction: number;
  /** Tunnel/holding → orbit entry. */
  liftMs: number;
  /** Duration of the orbiting portion. */
  orbitMs: number;
  /** Total turns travelled during `orbitMs` (>= 1). */
  sweepTurns: number;
  /** What happens when the orbit finishes. */
  endKind: 'burst' | 'toHolding';
  color: OrbColor;
  startCapacity: number;
}

/**
 * A staged step of an already-committed launch result. The session hook applies
 * these to the *presented* state over time; the engine result itself never
 * depends on them.
 */
export type PresentationEvent =
  | { kind: 'launch'; at: number; tunnelIndex: number }
  | { kind: 'flightStart'; at: number; pass: FlightPass }
  | { kind: 'orbitEnter'; at: number }
  | { kind: 'pixelClear'; at: number; pixelId: string; remaining: number }
  | { kind: 'chargeConsumed'; at: number }
  | { kind: 'moveToHolding'; at: number }
  | { kind: 'holdingLanded'; at: number; charge: Charge }
  | { kind: 'heldReactivate'; at: number; chargeId: string }
  | { kind: 'heldReturn'; at: number; charge: Charge }
  | { kind: 'holdingCritical'; at: number }
  | { kind: 'win'; at: number }
  | { kind: 'fail'; at: number };

export interface PresentationScript {
  /** Events sorted ascending by `at` (ms from the tap). */
  events: PresentationEvent[];
  /** Total length of the staged sequence. */
  totalMs: number;
  /**
   * Pixels this script will clear over time. The board must keep drawing them
   * (from the pre-move snapshot) until their `pixelClear` event fires, even
   * though the engine has already marked them cleared.
   */
  deferredPixelIds: string[];
}
