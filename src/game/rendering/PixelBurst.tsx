import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { orbGlow } from '@/theme/colors';

import type { Point } from './layout';

export interface BurstSpec {
  key: string;
  point: Point;
  color: keyof typeof orbGlow;
  cell: number;
}

const SPARKS = [
  { dx: -1, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 1 },
  { dx: 1, dy: 1 },
  { dx: 0, dy: -1.3 },
  { dx: 0, dy: 1.3 },
  { dx: -1.3, dy: 0 },
  { dx: 1.3, dy: 0 },
];
const DURATION = 220;

/**
 * A single, cheap pixel-clear flourish: an expanding ring plus four spark dots.
 * Fixed element count, one shared value, self-expires (the board drops it from
 * its capped list). Not a particle system.
 */
function PixelBurstComponent({ point, color, cell }: Omit<BurstSpec, 'key'>) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.quad) });
    return () => cancelAnimation(t);
  }, [t]);

  const ring = useAnimatedStyle(() => ({
    opacity: (1 - t.value) * 0.85,
    transform: [{ scale: 0.4 + t.value * 2.1 }],
  }));

  const reach = cell * 0.9;

  return (
    <View pointerEvents="none" style={[styles.root, { left: point.x, top: point.y }]}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: cell,
            height: cell,
            borderRadius: cell / 2,
            borderColor: orbGlow[color],
            marginLeft: -cell / 2,
            marginTop: -cell / 2,
          },
          ring,
        ]}
      />
      {SPARKS.map((s, i) => (
        <Spark key={i} t={t} dx={s.dx * reach} dy={s.dy * reach} color={orbGlow[color]} size={Math.max(2, cell * 0.16)} />
      ))}
    </View>
  );
}

function Spark({
  t,
  dx,
  dy,
  color,
  size,
}: {
  t: { value: number };
  dx: number;
  dy: number;
  color: string;
  size: number;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [
      { translateX: dx * t.value - size / 2 },
      { translateY: dy * t.value - size / 2 },
      { scale: 1 - t.value * 0.6 },
    ],
  }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', width: 0, height: 0 },
  ring: { position: 'absolute', borderWidth: 1.5 },
});

export const PixelBurst = memo(PixelBurstComponent);
