import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { material } from '@/theme/material';

/** TUNABLE — ring rise at the reject burst (ms). */
export const REJECT_RING_RISE_MS = 80;
/**
 * TUNABLE — the ring is fully gone this long after the burst starts. Kept
 * inside the reject → `fail` gap (burst 180 + FAIL_DELAY 160 = 340 ms) so it
 * never gets cut off when the flight retires at the result.
 */
export const REJECT_RING_END_MS = 320;
const PEAK_OPACITY = 0.7;

/**
 * The board's immediate response to a GateTerminal reject: one restrained
 * danger-edge pulse, driven by the rejecting Pal's own clock so it lands on the
 * same frame as the visible burst. No JS, no idle animation.
 */
export const RejectPulse = memo(function RejectPulse({ clock, at }: { clock: SharedValue<number>; at: number }) {
  const style = useAnimatedStyle(() => {
    const t = clock.value - at;
    if (t < 0 || t >= REJECT_RING_END_MS) return { opacity: 0 };
    const v = t < REJECT_RING_RISE_MS
      ? t / REJECT_RING_RISE_MS
      : 1 - (t - REJECT_RING_RISE_MS) / (REJECT_RING_END_MS - REJECT_RING_RISE_MS);
    return { opacity: v * PEAK_OPACITY };
  });
  return <Animated.View pointerEvents="none" style={[styles.ring, style]} />;
});

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    top: -2, left: -2, right: -2, bottom: -2,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: material.danger,
  },
});
