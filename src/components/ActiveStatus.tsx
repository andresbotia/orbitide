import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation, interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated';

import { material } from '@/theme/material';
import { NEON, neonAlpha } from '@/theme/neon';

/** TUNABLE — capacity-refusal flash: rise, then settle back to the normal readout. */
const REFUSAL_RISE_MS = 70;
const REFUSAL_FALL_MS = 430;

/**
 * Compact Core V2 active-occupancy readout. Capacity is passed in; never hardcoded.
 * When `embedded`, this is an inline label on the control deck — no pill, no border.
 */
export const ActiveStatus = memo(function ActiveStatus({
  count, capacity, embedded = false, refusalSeq = 0,
}: {
  count: number;
  capacity: number;
  embedded?: boolean;
  /** Bumped by the session each time a tap is refused because ACTIVE is full. */
  refusalSeq?: number;
}) {
  const full = capacity > 0 && count >= capacity;
  const wasFull = useRef(full);
  const pulse = useSharedValue(0);
  useEffect(() => {
    // One-shot pop only on the transition into full — never a standing/looping state.
    if (full && !wasFull.current) {
      cancelAnimation(pulse);
      pulse.set(withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 220 })));
    }
    wasFull.current = full;
  }, [full, pulse]);
  // Capacity refusal: one restrained danger-red flash of the readout itself.
  const alarm = useSharedValue(0);
  useEffect(() => {
    if (!refusalSeq) return;
    cancelAnimation(alarm);
    alarm.set(withSequence(withTiming(1, { duration: REFUSAL_RISE_MS }), withTiming(0, { duration: REFUSAL_FALL_MS })));
  }, [refusalSeq, alarm]);

  const pulseStyle = useAnimatedStyle(() => ({
    color: interpolateColor(alarm.value, [0, 1], [NEON.cyan, material.danger]),
    transform: [{ scale: 1 + Math.max(pulse.value * 0.16, alarm.value * 0.14) }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(alarm.value, [0, 1], [neonAlpha(NEON.cyanPale, 0.75), material.danger]),
  }));

  if (capacity <= 0) return null;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Active ${count} of ${capacity}`}
      accessibilityLiveRegion="polite"
      style={embedded ? styles.inline : styles.wrap}
    >
      <Animated.Text style={[styles.label, labelStyle]}>ACTIVE </Animated.Text>
      <Animated.Text style={[styles.num, pulseStyle]}>{count}/{capacity}</Animated.Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'baseline' },
  inline: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'baseline', height: 20 },
  label: {
    color: neonAlpha(NEON.cyanPale, 0.75),
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  num: {
    color: NEON.cyan,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
