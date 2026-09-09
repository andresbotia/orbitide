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
}
export type PlaybackKind = 'orbitEnter' | 'pixelClear' | 'frozenHit' | 'shieldHit' | 'chargeConsumed' |
  'holdingLanded' | 'holdingCritical' | 'holdingFull' | 'win' | 'fail' | 'complete';
export interface PlaybackEvent { kind: PlaybackKind; at: number; pixelId?: string; remaining?: number;
  /** Set on the pixelClear that completes the picture — a stronger presentation beat. */
  final?: boolean }
/** One independent charge's script and its UI-thread clock form one playback unit. */
export interface FlightPass {
  passId: number;
  origin: 'tunnel' | 'holding';
  sourceIndex: number;
  from?: Point;
  holdingTarget?: Point;
  charge: Charge;
  shots: Shot[];
  liftMs: number;
  orbitEndAt: number;
  endProgress: number;
  landingAt: number;
  totalMs: number;
  endKind: 'burst' | 'toHolding';
  events: PlaybackEvent[];
  /** Pixel id of the clear that wins the level on this pass, if any. */
  finalClearPixelId?: string;
}
export interface PresentationScript { pass: FlightPass; totalMs: number }
