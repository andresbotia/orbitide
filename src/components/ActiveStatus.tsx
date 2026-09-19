import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { flash } from '@/components/gameplay/motionKit';
import { GP, GP_TYPE } from '@/theme/gameplayUi';
import { GP_MOTION } from '@/theme/gameplayMotion';

/**
 * Core V2 ACTIVE occupancy: label, one pip per rail slot, and `n/cap`.
 * Capacity is passed in; never hardcoded. Pips fill cyan as Pals launch and
 * the whole meter warms to gold at capacity (pressure, not failure).
 *
 * Capacity refusal (a tap while ACTIVE is full) is one restrained danger flash
 * of this readout with a ~1.14× pulse — never the screen. `refusalSeq` bumps
 * once per refused tap; the Error haptic and its throttle live in the session.
 */
export const ActiveStatus = memo(function ActiveStatus({
  count, capacity, refusalSeq = 0,
}: {
  count: number;
  capacity: number;
  /** Bumped by the session each time a tap is refused because ACTIVE is full. */
  refusalSeq?: number;
}) {
  const reducedMotion = useReducedMotion();
  const full = capacity > 0 && count >= capacity;
  const wasFull = useRef(full);
  const pop = useSharedValue(0);
  const warm = useSharedValue(full ? 1 : 0);
  useEffect(() => {
    warm.set(withTiming(full ? 1 : 0, { duration: 160 }));
    // One-shot pop only on the transition into full — never a standing state.
    if (full && !wasFull.current && !reducedMotion) flash(pop, 90, 220);
    wasFull.current = full;
  }, [full, pop, warm, reducedMotion]);

  const alarm = useSharedValue(0);
  useEffect(() => {
    if (!refusalSeq) return;
    cancelAnimation(alarm);
    alarm.set(withSequence(
      withTiming(1, { duration: GP_MOTION.capacityRiseMs }),
      withTiming(0, { duration: GP_MOTION.capacityFallMs }),
    ));
  }, [refusalSeq, alarm]);

  const meterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reducedMotion ? 1 : 1 + Math.max(pop.value * 0.1, alarm.value * GP_MOTION.capacityScale) }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(alarm.value, [0, 1], [GP.textSecondary, GP.danger]),
  }));
  const numStyle = useAnimatedStyle(() => {
    const base = interpolateColor(warm.value, [0, 1], [GP.cyan, GP.gold]);
    return { color: interpolateColor(alarm.value, [0, 1], [base, GP.danger]) };
  });

  if (capacity <= 0) return null;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Active ${count} of ${capacity}${full ? ', full' : ''}`}
      accessibilityLiveRegion="polite"
      style={styles.row}
    >
      <Animated.Text style={[styles.label, labelStyle]}>ACTIVE</Animated.Text>
      <Animated.View style={[styles.meter, meterStyle]}>
        <View style={styles.pips}>
          {Array.from({ length: capacity }, (_, i) => (
            <Pip key={i} on={i < count} warm={warm} alarm={alarm} reducedMotion={reducedMotion} />
          ))}
        </View>
        <Animated.Text style={[styles.num, numStyle]}>{count}/{capacity}</Animated.Text>
      </Animated.View>
    </View>
  );
});

const Pip = memo(function Pip({ on, warm, alarm, reducedMotion }: {
  on: boolean; warm: SharedValue<number>; alarm: SharedValue<number>; reducedMotion: boolean;
}) {
  const fill = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    fill.set(withTiming(on ? 1 : 0, { duration: reducedMotion ? 0 : 140 }));
  }, [on, fill, reducedMotion]);
  const style = useAnimatedStyle(() => {
    const lit = interpolateColor(warm.value, [0, 1], [GP.cyan, GP.gold]);
    const body = interpolateColor(fill.value, [0, 1], [GP.wellDeep, lit]);
    return {
      backgroundColor: interpolateColor(alarm.value, [0, 1], [body, GP.danger]),
      borderColor: fill.value > 0.5 ? 'transparent' : GP.hairlineStrong,
      transform: [{ scaleY: reducedMotion ? 1 : 0.7 + fill.value * 0.3 }],
    };
  });
  return <Animated.View style={[styles.pip, style]} />;
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 18 },
  label: { ...GP_TYPE.label, color: GP.textSecondary },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pips: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pip: {
    width: 11,
    height: 8,
    borderRadius: 2.5,
    borderWidth: 1,
  },
  num: { ...GP_TYPE.numeral, color: GP.cyan, minWidth: 26 },
});
