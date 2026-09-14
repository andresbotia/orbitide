import { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { homeV2 } from '@/theme/homeV2';

interface HomeMotesProps {
  width: number;
  height: number;
  active: boolean;
  reducedMotion: boolean;
}

const MOTE_COLORS = [homeV2.yellow, homeV2.cyan, homeV2.white] as const;

/**
 * Pooled pixel motes — max 2, transform/opacity only. Appear on a 7–11s
 * randomized cadence; reduced motion turns them off.
 */
export const HomeMotes = memo(function HomeMotes({
  width,
  height,
  active,
  reducedMotion,
}: HomeMotesProps) {
  if (reducedMotion) return null;
  return (
    <>
      <Mote index={0} width={width} height={height} active={active} />
      <Mote index={1} width={width} height={height} active={active} />
    </>
  );
});

const Mote = memo(function Mote({
  index,
  width,
  height,
  active,
}: {
  index: number;
  width: number;
  height: number;
  active: boolean;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const opacity = useSharedValue(0);
  const color = MOTE_COLORS[index % MOTE_COLORS.length]!;

  useEffect(() => {
    cancelAnimation(opacity);
    cancelAnimation(y);
    opacity.set(0);
    if (!active || width <= 0 || height <= 0) return;

    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cycle = () => {
      if (!alive) return;
      const wait = 7000 + Math.random() * 4000 + index * 1100;
      timer = setTimeout(() => {
        if (!alive) return;
        const startX = width * (0.18 + Math.random() * 0.64);
        const startY = height * (0.22 + Math.random() * 0.4);
        x.set(startX);
        y.set(startY);
        y.set(withTiming(startY - 22, { duration: 1600, easing: Easing.out(Easing.quad) }));
        opacity.set(
          withSequence(
            withTiming(0.85, { duration: 380 }),
            withTiming(0.85, { duration: 700 }),
            withTiming(0, { duration: 420 }, (finished) => {
              if (finished) runOnJS(cycle)();
            }),
          ),
        );
      }, wait);
    };

    cycle();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      cancelAnimation(opacity);
      cancelAnimation(y);
    };
  }, [active, height, index, opacity, width, x, y]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
  }));

  return <Animated.View pointerEvents="none" style={[styles.mote, { backgroundColor: color }, style]} />;
});

const styles = StyleSheet.create({
  mote: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 6,
    height: 6,
    borderRadius: 1.5,
  },
});
