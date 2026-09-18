import { memo, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated';

import { NEON, neonAlpha } from '@/theme/neon';

/**
 * Compact Core V2 active-occupancy readout. Capacity is passed in; never hardcoded.
 * When `embedded`, this is an inline label on the control deck — no pill, no border.
 */
export const ActiveStatus = memo(function ActiveStatus({
  count, capacity, embedded = false,
}: {
  count: number;
  capacity: number;
  embedded?: boolean;
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
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.16 }] }));

  if (capacity <= 0) return null;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Active ${count} of ${capacity}`}
      accessibilityLiveRegion="polite"
      style={embedded ? styles.inline : styles.wrap}
    >
      <Text style={styles.label}>ACTIVE </Text>
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
