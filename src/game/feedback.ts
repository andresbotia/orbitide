import { haptics } from './haptics';

/**
 * Single fan-out point for game-feel feedback. Presentation code emits abstract
 * events; this module maps each to a haptic now and to a sound later.
 *
 * M2 audio: call `setSoundHandler(fn)` once at app start with a real player.
 * Until then the sound side is a no-op — do NOT add audio assets here yet.
 */
export type FeedbackEvent =
  | 'select'
  | 'launch'
  | 'orbitEnter'
  | 'orbitWhoosh'
  | 'pixelPop'
  | 'chargeConsumed'
  | 'holdingLand'
  | 'heldRelaunch'
  | 'holdingCritical'
  | 'win'
  | 'fail';

type SoundHandler = (event: FeedbackEvent) => void;

let soundHandler: SoundHandler | null = null;

/** Register the M2 sound player. Pass `null` to detach. */
export function setSoundHandler(handler: SoundHandler | null): void {
  soundHandler = handler;
}

const HAPTIC: Partial<Record<FeedbackEvent, () => void>> = {
  select: haptics.select,
  launch: haptics.select,
  orbitEnter: haptics.orbitEnter,
  pixelPop: haptics.pixelPop,
  chargeConsumed: haptics.chargeConsumed,
  holdingLand: haptics.holdingLand,
  heldRelaunch: haptics.heldRelaunch,
  holdingCritical: haptics.holdingCritical,
  win: haptics.win,
  fail: haptics.fail,
  // 'orbitWhoosh' is sound-only.
};

export function emit(event: FeedbackEvent): void {
  HAPTIC[event]?.();
  soundHandler?.(event);
}

export const feedback = { emit, setSoundHandler };
