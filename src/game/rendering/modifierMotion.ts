import { useCallback, useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { ModifierMotionKind } from './specialPixels';

/**
 * Reusable animation hooks for special-pixel materials. NOT attached to any
 * mechanic — one-shot hooks are meant to be `trigger()`ed from future engine
 * presentation events; idle hooks take an `enabled` flag whose budgeting is the
 * caller's job (see `pickIdleAnimated`). All animation runs on the UI thread;
 * nothing loops on the JS thread.
 */

/** Motion durations / periods (ms), TUNABLE. */
export const MODIFIER_MOTION: Record<ModifierMotionKind, number> = {
  crack: 260,
  shatter: 320,
  ripple: 420,
  shieldCollapse: 300,
  plateHit: 220,
  clampRelease: 380,
  bombPulse: 1400,
  facetShimmer: 2600,
  wildResolve: 460,
  linkPulse: 1800,
  scanReveal: 3200,
};

interface OneShot {
  /** 0 at rest, animates 0→1 on trigger. */
  value: SharedValue<number>;
  trigger: () => void;
}

/** A one-shot 0→1 ramp — frozen crack, shield collapse, plate hit, clamp release. */
function useOneShot(kind: ModifierMotionKind, onDone?: () => void): OneShot {
  const value = useSharedValue(0);
  const trigger = useCallback(() => {
    cancelAnimation(value);
    value.set(0);
    value.set(withTiming(1, { duration: MODIFIER_MOTION[kind], easing: Easing.out(Easing.cubic) }, (finished) => {
      'worklet';
      if (finished && onDone) runOnJS(onDone)();
    }));
  }, [kind, onDone, value]);
  useEffect(() => () => cancelAnimation(value), [value]);
  return { value, trigger };
}

export const useCrackMotion = (onDone?: () => void) => useOneShot('crack', onDone);
export const useShatterMotion = (onDone?: () => void) => useOneShot('shatter', onDone);
export const useShieldCollapse = (onDone?: () => void) => useOneShot('shieldCollapse', onDone);
export const usePlateHit = (onDone?: () => void) => useOneShot('plateHit', onDone);
export const useClampRelease = (onDone?: () => void) => useOneShot('clampRelease', onDone);
export const useWildResolve = (onDone?: () => void) => useOneShot('wildResolve', onDone);

/** A soft ripple that plays once — shield stress. */
export function useShieldRipple(): OneShot {
  const value = useSharedValue(0);
  const trigger = useCallback(() => {
    cancelAnimation(value);
    value.set(withSequence(
      withTiming(1, { duration: MODIFIER_MOTION.ripple * 0.4, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: MODIFIER_MOTION.ripple * 0.6, easing: Easing.inOut(Easing.quad) }),
    ));
  }, [value]);
  useEffect(() => () => cancelAnimation(value), [value]);
  return { value, trigger };
}

/**
 * An idle repeating motion — bomb warning pulse, wild facet shimmer, linked
 * conduit pulse, hidden scan sweep. Only runs while `enabled` (the caller caps
 * how many run at once).
 */
export function useIdleMotion(kind: ModifierMotionKind, enabled: boolean, reducedMotion = false): SharedValue<number> {
  const value = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(value);
    if (!enabled || reducedMotion) {
      value.set(0);
      return;
    }
    const period = MODIFIER_MOTION[kind];
    const reverse = kind === 'bombPulse' || kind === 'linkPulse';
    value.set(withRepeat(
      withTiming(1, { duration: period, easing: kind === 'facetShimmer' ? Easing.linear : Easing.inOut(Easing.sin) }),
      -1,
      reverse,
    ));
    return () => cancelAnimation(value);
  }, [kind, enabled, reducedMotion, value]);
  return value;
}
