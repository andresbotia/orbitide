import { useCallback } from 'react';
import {
  cancelAnimation, Easing, useSharedValue, withSequence, withSpring, withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { GP_MOTION } from '@/theme/gameplayMotion';

/**
 * M5.8B — the small set of UI-thread motion builders every gameplay control
 * shares. Each one only writes a shared value; the component that owns the
 * effect maps it to its own transform/opacity. No timers, no React state.
 */

/** One-shot 0 → 1 → 0 flash. */
export function flash(value: SharedValue<number>, riseMs: number = GP_MOTION.lipRiseMs, fallMs: number = GP_MOTION.lipFallMs): void {
  cancelAnimation(value);
  value.set(withSequence(
    withTiming(1, { duration: riseMs, easing: Easing.out(Easing.quad) }),
    withTiming(0, { duration: fallMs, easing: Easing.inOut(Easing.quad) }),
  ));
}

/** Horizontal refusal shake through `keyframes` (pt), ending at 0. */
export function shake(value: SharedValue<number>, keyframes: readonly number[], stepMs: number = GP_MOTION.shakeStepMs): void {
  cancelAnimation(value);
  const [first, ...rest] = keyframes.map((x, i) => withTiming(x, { duration: i === 0 ? stepMs * 0.75 : stepMs }));
  if (!first) return;
  value.set(withSequence(first, ...rest));
}

/**
 * Jump to `peak`, spring back to 0 — a dip. Only for controls that should
 * feel physically pushed (Holding wells); tunnels deliberately do not bob.
 */
export function kick(value: SharedValue<number>, peak: number, spring: { damping: number; stiffness: number }): void {
  cancelAnimation(value);
  value.set(withSequence(
    withTiming(peak, { duration: 60, easing: Easing.out(Easing.cubic) }),
    withSpring(0, spring),
  ));
}

/**
 * Touch-down depth for a pressable gameplay control. `depth` goes 0 → 1 in
 * `pressInMs` on press-in (before any React commit) and springs back on
 * release; the owner maps it to scale/translate.
 */
export function usePressDepth(): { depth: SharedValue<number>; pressIn: () => void; pressOut: () => void } {
  const depth = useSharedValue(0);
  const pressIn = useCallback(() => {
    cancelAnimation(depth);
    depth.set(withTiming(1, { duration: GP_MOTION.pressInMs, easing: Easing.out(Easing.quad) }));
  }, [depth]);
  const pressOut = useCallback(() => {
    cancelAnimation(depth);
    depth.set(withSpring(0, GP_MOTION.pressSpring));
  }, [depth]);
  return { depth, pressIn, pressOut };
}
