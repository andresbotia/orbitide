import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Restrained, centralized haptic vocabulary for ORBITIDE's pixel-clearing
 * mechanic.
 *
 * Flip `HAPTICS_ENABLED` to false (or toggle it from the debug overlay) to
 * silence all feedback — useful during development and required wherever the
 * native module is unavailable.
 */
export let HAPTICS_ENABLED = true;

export function setHapticsEnabled(enabled: boolean): void {
  HAPTICS_ENABLED = enabled;
}

const isSupported = Platform.OS === 'ios' || Platform.OS === 'android';

function safe(run: () => Promise<unknown>): void {
  if (!HAPTICS_ENABLED || !isSupported) return;
  void run().catch(() => {
    // Haptics are best-effort; never let them throw into gameplay.
  });
}

/** Pixel-clear ticks are throttled so a big sweep doesn't machine-gun. */
let lastPixelTick = 0;
const PIXEL_TICK_MS = 55;

export const haptics = {
  /** Tunnel / charge selected. */
  select: () => safe(() => Haptics.selectionAsync()),

  /** One pixel cleared — very subtle, throttled. */
  pixelClear: () => {
    const now = Date.now();
    if (now - lastPixelTick < PIXEL_TICK_MS) return;
    lastPixelTick = now;
    safe(() => Haptics.selectionAsync());
  },

  /** A charge fully emptied on its pass. */
  chargeConsumed: () =>
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),

  /** A charge parked in Holding with leftover capacity. */
  held: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)),

  /** A parked charge auto-relaunched. */
  reactivate: () => safe(() => Haptics.selectionAsync()),

  /** Holding is one slot from full. */
  holdingCritical: () =>
    safe(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    ),

  /** Level solved. */
  win: () =>
    safe(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    ),

  /** Level failed (Holding jammed). */
  fail: () =>
    safe(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    ),
};
