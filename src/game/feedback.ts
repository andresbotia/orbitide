import { cancelPendingHaptics, haptics } from './haptics';
export type FeedbackEvent =
  | keyof typeof haptics
  | 'launch'
  | 'orbitWhoosh'
  /** Sound-only hooks (no haptic). */
  | 'reward'
  | 'gateIntro';

/**
 * Per-emit context for the sound layer. `voice` groups transient sounds so the
 * mixer can cap identical concurrent voices (spec §17: max 3 simultaneous
 * identical shot voices; extras duck into the existing transient bed). No final
 * audio assets yet — this is the hook they will read.
 */
export interface FeedbackMeta { haptic?: boolean; voice?: 'shot' | 'orbit' }

type SoundHandler = (event: FeedbackEvent, meta?: FeedbackMeta) => void;
let soundHandler: SoundHandler | null = null;
export function setSoundHandler(handler: SoundHandler | null): void { soundHandler = handler; }
export function emit(event: FeedbackEvent, meta: FeedbackMeta = {}): void {
  if (meta.haptic !== false && event in haptics) haptics[event as keyof typeof haptics]();
  try { soundHandler?.(event, meta); } catch { /* Optional audio must not affect play. */ }
}
export const feedback = { emit, setSoundHandler, cancelPending: cancelPendingHaptics };
