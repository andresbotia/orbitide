import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
export let HAPTICS_ENABLED = true;
let winTimer: ReturnType<typeof setTimeout> | undefined;
const last = new Map<string, number>();
export function cancelPendingHaptics(): void {
  if (winTimer !== undefined) clearTimeout(winTimer);
  winTimer = undefined;
}
export function setHapticsEnabled(enabled: boolean): void {
  HAPTICS_ENABLED = enabled;
  if (!enabled) cancelPendingHaptics();
  last.clear();
}
function safe(run: () => Promise<unknown>): void {
  if (!HAPTICS_ENABLED || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return;
  try { void run().catch(() => {}); } catch { /* Feedback never interrupts a move. */ }
}
function impact(style: Haptics.ImpactFeedbackStyle) { safe(() => Haptics.impactAsync(style)); }
function notification(style: Haptics.NotificationFeedbackType) { safe(() => Haptics.notificationAsync(style)); }
function throttled(key: string, gap: number, run: () => void) {
  const now = Date.now();
  if (now - (last.get(key) ?? -Infinity) < gap) return;
  last.set(key, now); run();
}
/** Success notification, then one controlled medium impact 120ms later. */
function successThenBloom() {
  cancelPendingHaptics();
  notification(Haptics.NotificationFeedbackType.Success);
  if (!HAPTICS_ENABLED) return;
  winTimer = setTimeout(() => { winTimer = undefined; impact(Haptics.ImpactFeedbackStyle.Medium); }, 120);
}
export const haptics = {
  select: () => throttled('press', 80, () => impact(Haptics.ImpactFeedbackStyle.Medium)),
  heldRelaunch: () => throttled('press', 80, () => impact(Haptics.ImpactFeedbackStyle.Rigid)),
  // Rail full — a light, restrained "not now" tap (spec §19).
  denied: () => throttled('denied', 200, () => impact(Haptics.ImpactFeedbackStyle.Light)),
  orbitEnter: () => impact(Haptics.ImpactFeedbackStyle.Light),
  // One crisp short pulse, rather than stacking impacts to fake intensity.
  pixelPop: () => throttled('pixel', 90, () => impact(Haptics.ImpactFeedbackStyle.Rigid)),
  // Coalesced multi-charge impacts (see hapticArbiter): a pair, then a capped burst.
  pixelCombo: () => throttled('pixel', 60, () => impact(Haptics.ImpactFeedbackStyle.Medium)),
  pixelBurst: () => throttled('pixel', 60, () => impact(Haptics.ImpactFeedbackStyle.Heavy)),
  // Frozen ice crack — a light, brittle tap, distinct from a pixel pop.
  iceCrack: () => throttled('ice', 70, () => impact(Haptics.ImpactFeedbackStyle.Light)),
  shieldBreak: () => throttled('shield', 70, () => impact(Haptics.ImpactFeedbackStyle.Light)),
  linkPrime: () => throttled('link', 70, () => impact(Haptics.ImpactFeedbackStyle.Rigid)),
  linkClear: () => throttled('link', 70, () => impact(Haptics.ImpactFeedbackStyle.Heavy)),
  chargeConsumed: () => impact(Haptics.ImpactFeedbackStyle.Medium),
  holdingLand: () => impact(Haptics.ImpactFeedbackStyle.Rigid),
  holdingCritical: () => throttled('warning', 600, () => notification(Haptics.NotificationFeedbackType.Warning)),
  holdingFull: () => throttled('error', 180, () => notification(Haptics.NotificationFeedbackType.Error)),
  fail: () => throttled('error', 180, () => notification(Haptics.NotificationFeedbackType.Error)),
  win: successThenBloom,
  // Win / Discovery reveal.
  finalClear: () => throttled('final', 90, () => impact(Haptics.ImpactFeedbackStyle.Heavy)),
  discoveryResolve: successThenBloom,
  nextPress: () => throttled('press', 80, () => impact(Haptics.ImpactFeedbackStyle.Medium)),
  // Difficulty Gate intro (tier >= 3).
  gateLock: () => impact(Haptics.ImpactFeedbackStyle.Rigid),
};
