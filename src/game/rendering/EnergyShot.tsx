import { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { FEEL } from '@/game/presentation/constants';
import type { EnergyShot as Shot } from '@/game/presentation/events';
import { orbColors } from '@/theme/colors';
import { orbitPoint, type BoardLayout, type Point } from './layout';

/** A pass-scoped visual only: removal and capacity are driven by the script. */
export const EnergyShot = memo(function EnergyShot({ shot, layout, target }: {
  shot: Shot; layout: BoardLayout; target: Point;
}) {
  const clock = useSharedValue(0);
  const from = orbitPoint(layout, shot.originFraction * Math.PI * 2 - Math.PI / 2);
  const angle = Math.atan2(target.y - from.y, target.x - from.x);
  const length = Math.min(14, layout.cell * 0.65);
  useEffect(() => {
    clock.value = 0;
    clock.value = withTiming(FEEL.ENERGY_SHOT_DURATION, {
      duration: FEEL.ENERGY_SHOT_DURATION, easing: Easing.linear,
    });
    return () => cancelAnimation(clock);
  }, [clock]);
  const streak = useAnimatedStyle(() => {
    const p = Math.min(1, clock.value / FEEL.ENERGY_TRAVEL_DURATION);
    return {
      opacity: clock.value < FEEL.ENERGY_TRAVEL_DURATION ? 0.95 : 0,
      transform: [
        { translateX: from.x + (target.x - from.x) * p - length / 2 },
        { translateY: from.y + (target.y - from.y) * p - 1.5 },
        { rotate: `${angle}rad` },
      ],
    };
  });
  const flash = useAnimatedStyle(() => ({
    opacity: clock.value >= FEEL.ENERGY_TRAVEL_DURATION ? 0.85 : 0,
    transform: [{ scale: 1 + 0.08 * Math.max(0, (clock.value - FEEL.ENERGY_TRAVEL_DURATION) / 25) }],
  }));
  return <>
    <Animated.View pointerEvents="none" style={[styles.effect,
      { width: length, height: 3, borderRadius: 2, backgroundColor: orbColors[shot.color] }, streak]} />
    <Animated.View pointerEvents="none" style={[styles.effect, {
      left: target.x - layout.cell / 2, top: target.y - layout.cell / 2,
      width: layout.cell, height: layout.cell, borderRadius: 3,
      borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#FFFFFF55',
    }, flash]} />
  </>;
});
const styles = StyleSheet.create({ effect: { position: 'absolute', left: 0, top: 0 } });
