import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
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
  motionEnabled?: boolean;
}

const COLLAPSE_MS = FEEL.PIXEL_POP_DURATION - 60;

function PixelComponent({ color, cx, cy, cell, reachable, motionEnabled = true }: PixelProps) {
  const size = Math.max(4, cell - 2);
  const fill = orbColors[color];
  const glow = orbGlow[color];

  // Anticipation is the incoming shot's impact flash. Collapse at pixelClear.
  const exiting = () => {
    'worklet';
    return {
      initialValues: { opacity: 1, transform: [{ scale: 1.08 }] },
      animations: {
        opacity: withTiming(0, { duration: COLLAPSE_MS }),
        transform: [{ scale: withTiming(0, {
          duration: COLLAPSE_MS, easing: Easing.in(Easing.cubic),
        }) }],
      },
    };
  };

  return (
    <Animated.View
      entering={motionEnabled ? FadeIn.duration(150) : undefined}
      exiting={motionEnabled ? exiting : undefined}
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
