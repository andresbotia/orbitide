import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Low-level, centralized haptic vocabulary. Gameplay code should not call this
 * directly — it goes through `feedback.ts`, which also fans out to the (M2)
 * sound layer. This module only owns the raw taps and the global toggle.
 *
 * Flip `HAPTICS_ENABLED` to false (or toggle it from the debug overlay) to
 * silence all haptics — useful during development and required wherever the
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

/**
 * Pixel pops arrive ~110 ms apart (see `FEEL.PIXEL_CLEAR_INTERVAL`); this
 * throttle only guards against accidental double-fires within a single pop, not
 * against the intended rhythmic cadence.
 */
let lastPixelTick = 0;
const PIXEL_TICK_MIN_GAP = 45;

export const haptics = {
  /** Tunnel / charge selected. */
  select: () => safe(() => Haptics.selectionAsync()),

  /** Charge joins the orbit — very soft. */
  orbitEnter: () =>
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),

  /** One pixel cleared — light, rhythmic, synced to the pop. */
  pixelPop: () => {
    const now = Date.now();
    if (now - lastPixelTick < PIXEL_TICK_MIN_GAP) return;
    lastPixelTick = now;
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },

  /** A charge counted down to zero on its pass — a touch stronger. */
  chargeConsumed: () =>
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),

  /** A charge landed in a Holding slot — distinct, soft. */
  holdingLand: () =>
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)),

  /** A parked charge lifted out of Holding to relaunch. */
  heldRelaunch: () => safe(() => Haptics.selectionAsync()),

  /** Holding reached one slot from full. */
  holdingCritical: () =>
    safe(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    ),

  /** Level solved — stronger than a normal clear. */
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
