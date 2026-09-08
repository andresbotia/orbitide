import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { FEEL } from '@/game/presentation/constants';
import { orbColors, orbGlow } from '@/theme/colors';
interface PixelProps {
  color: keyof typeof orbColors; cx: number; cy: number; cell: number; reachable: boolean;
  clock: SharedValue<number>; clearAt?: number;
}
export const Pixel = memo(function Pixel({ color, cx, cy, cell, reachable, clock, clearAt }: PixelProps) {
  const size = Math.max(4, cell - 2);
  const animated = useAnimatedStyle(() => {
    const p = clearAt === undefined ? 0 : Math.max(0, Math.min(1, (clock.value - clearAt) / FEEL.PIXEL_POP_DURATION));
    return { opacity: (reachable ? 1 : 0.5) * (1 - p), transform: [{ scale: 1 - p }] };
  });
  return <Animated.View pointerEvents="none" style={[styles.wrap, {
    width: size, height: size, left: cx - size / 2, top: cy - size / 2,
    borderRadius: Math.max(2, cell * 0.22), backgroundColor: orbColors[color],
    borderColor: orbGlow[color], borderWidth: reachable ? Math.max(1, cell * 0.09) : 0,
  }, animated]}>
    {reachable ? <View style={[styles.spark, { backgroundColor: orbGlow[color], width: size * 0.85, height: size * 0.16 }]} /> : null}
  </Animated.View>;
});
const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'center', overflow: 'hidden' },
  spark: { marginTop: 2, borderRadius: 999, opacity: 0.5 },
});
