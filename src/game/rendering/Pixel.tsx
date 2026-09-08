import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { FEEL } from '@/game/presentation/constants';
import { orbColors, orbGlow } from '@/theme/colors';

interface PixelProps {
  color: keyof typeof orbColors;
  /** Board-space centre of the cell (primitives, so `memo` holds). */
  cx: number;
  cy: number;
  cell: number;
  /** On the current outer boundary — can be cleared right now. */
  reachable: boolean;
}

const ANTICIPATION_MS = 60;
const COLLAPSE_MS = Math.max(60, FEEL.PIXEL_POP_DURATION - ANTICIPATION_MS);

function PixelComponent({ color, cx, cy, cell, reachable }: PixelProps) {
  const size = Math.max(4, cell - 2);
  const fill = orbColors[color];
  const glow = orbGlow[color];

  // The pop: tiny anticipation scale, then a fast collapse + fade. Self
  // contained and short so consecutive pops stay readable. Runs only after the
  // engine (via the presented state) has removed this pixel.
  const exiting = () => {
    'worklet';
    return {
      initialValues: { opacity: 1, transform: [{ scale: 1 }] },
      animations: {
        opacity: withDelay(
          ANTICIPATION_MS,
          withTiming(0, { duration: COLLAPSE_MS }),
        ),
        transform: [
          {
            scale: withSequence(
              withTiming(1.08, {
                duration: ANTICIPATION_MS,
                easing: Easing.out(Easing.quad),
              }),
              withTiming(0, {
                duration: COLLAPSE_MS,
                easing: Easing.in(Easing.cubic),
              }),
            ),
          },
        ],
      },
    };
  };

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={exiting}
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          left: cx - size / 2,
          top: cy - size / 2,
          borderRadius: Math.max(2, cell * 0.22),
          backgroundColor: fill,
          opacity: reachable ? 1 : 0.5,
          borderColor: glow,
          borderWidth: reachable ? Math.max(1, cell * 0.09) : 0,
        },
      ]}
    >
      {reachable ? (
        <View
          style={[
            styles.spark,
            { backgroundColor: glow, width: size * 0.85, height: size * 0.16 },
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
  spark: { marginTop: 2, borderRadius: 999, opacity: 0.5 },
});

export const Pixel = memo(PixelComponent);
