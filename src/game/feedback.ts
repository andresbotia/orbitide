import { cancelPendingHaptics, haptics } from './haptics';
export type FeedbackEvent =
  | keyof typeof haptics
  | 'launch'
  | 'orbitWhoosh'
  /** Sound-only hooks (no haptic). */
  | 'reward'
  | 'gateIntro';
type SoundHandler = (event: FeedbackEvent) => void;
let soundHandler: SoundHandler | null = null;
export function setSoundHandler(handler: SoundHandler | null): void { soundHandler = handler; }
export function emit(event: FeedbackEvent, options: { haptic?: boolean } = {}): void {
  if (options.haptic !== false && event in haptics) haptics[event as keyof typeof haptics]();
  try { soundHandler?.(event); } catch { /* Optional audio must not affect play. */ }
}
export const feedback = { emit, setSoundHandler, cancelPending: cancelPendingHaptics };
