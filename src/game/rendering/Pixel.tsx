import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { orbColors, orbGlow } from '@/theme/colors';

import type { Point } from './layout';

interface PixelProps {
  color: keyof typeof orbColors;
  center: Point;
  cell: number;
  /** On the current outer boundary — can be cleared right now. */
  reachable: boolean;
  /** Stagger (ms) applied to this pixel's clear animation. */
  exitDelay: number;
}

function PixelComponent({ color, center, cell, reachable, exitDelay }: PixelProps) {
  const size = Math.max(4, cell - 2);
  const fill = orbColors[color];
  const glow = orbGlow[color];

  // Clear animation: a quick pop bigger, then collapse + fade — staggered so a
  // multi-pixel clear reads as a sweep rather than a single blink. This only
  // runs after the engine has already removed the pixel from game state.
  const exiting = () => {
    'worklet';
    return {
      initialValues: { opacity: 1, transform: [{ scale: 1 }] },
      animations: {
        opacity: withDelay(exitDelay, withTiming(0, { duration: 200 })),
        transform: [
          {
            scale: withDelay(
              exitDelay,
              withSequence(
                withTiming(1.35, { duration: 90, easing: Easing.out(Easing.quad) }),
                withTiming(0, { duration: 170, easing: Easing.in(Easing.cubic) }),
              ),
            ),
          },
        ],
      },
    };
  };

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={exiting}
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          left: center.x - size / 2,
          top: center.y - size / 2,
          borderRadius: Math.max(2, cell * 0.22),
          backgroundColor: fill,
          opacity: reachable ? 1 : 0.55,
          borderColor: glow,
          borderWidth: reachable ? Math.max(1, cell * 0.08) : 0,
        },
      ]}
    >
      {reachable ? (
        <View
          style={[
            styles.spark,
            { backgroundColor: glow, width: size * 0.9, height: size * 0.18 },
          ]}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  spark: {
    marginTop: 2,
    borderRadius: 999,
    opacity: 0.5,
  },
});

export const Pixel = memo(PixelComponent);
