import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Restrained haptic vocabulary for ORBITIDE.
 *
 * Flip `HAPTICS_ENABLED` to false (or set it from a dev/test flag) to silence
 * all feedback — useful during development and required for any environment
 * where the native module is unavailable.
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

export const haptics = {
  /** Light tick when an orb is selected. */
  select: () => safe(() => Haptics.selectionAsync()),
  /** Successful orb absorbed into the Core. */
  absorb: () =>
    safe(() =>
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    ),
  /** A Core target was completed. */
  targetComplete: () =>
    safe(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    ),
  /** Level solved. */
  win: () =>
    safe(async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }),
  /** Level failed (tray overflow). */
  fail: () =>
    safe(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    ),
};
