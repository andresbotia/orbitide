import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
  withTiming,
} from 'react-native-reanimated';

import { orbColors, orbGlow } from '@/theme/colors';

import type { Point } from './layout';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface OrbProps {
  id: string;
  color: keyof typeof orbColors;
  point: Point;
  /** Board center, so the orb can animate itself into the Core on exit. */
  center: Point;
  radius: number;
  isExposed: boolean;
  /** The orb matches the active Core target (so a tap sends it to the Core). */
  matches: boolean;
  disabled: boolean;
  onPress: (id: string) => void;
}

function OrbComponent({
  id,
  color,
  point,
  center,
  radius,
  isExposed,
  matches,
  disabled,
  onPress,
}: OrbProps) {
  const size = radius * 2;
  const fill = orbColors[color];
  const glow = orbGlow[color];
  const dx = center.x - point.x;
  const dy = center.y - point.y;

  // A matching orb accelerates into the Core and collapses; a held orb drops
  // toward the tray. The engine has already decided which — this is cosmetic.
  const exiting = () => {
    'worklet';
    if (matches) {
      return {
        initialValues: {
          opacity: 1,
          transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
        },
        animations: {
          opacity: withTiming(0, { duration: 300 }),
          transform: [
            { translateX: withTiming(dx, { duration: 320, easing: Easing.in(Easing.cubic) }) },
            { translateY: withTiming(dy, { duration: 320, easing: Easing.in(Easing.cubic) }) },
            { scale: withTiming(0.12, { duration: 320, easing: Easing.in(Easing.cubic) }) },
          ],
        },
      };
    }
    return {
      initialValues: {
        opacity: 1,
        transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
      },
      animations: {
        opacity: withTiming(0, { duration: 220 }),
        transform: [
          { translateX: withTiming(0, { duration: 240 }) },
          { translateY: withTiming(72, { duration: 240, easing: Easing.out(Easing.quad) }) },
          { scale: withTiming(0.65, { duration: 240 }) },
        ],
      },
    };
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${color} orb`}
      disabled={disabled || !isExposed}
      onPress={() => onPress(id)}
      hitSlop={8}
      entering={FadeIn.duration(180)}
      exiting={exiting}
      layout={LinearTransition.duration(240).easing(Easing.inOut(Easing.quad))}
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: radius,
          left: point.x - radius,
          top: point.y - radius,
          opacity: isExposed ? 1 : 0.4,
        },
      ]}
    >
      <View
        style={[
          styles.glow,
          {
            width: size * 1.9,
            height: size * 1.9,
            borderRadius: size,
            backgroundColor: glow,
            opacity: isExposed ? 0.26 : 0.08,
          },
        ]}
      />
      <View
        style={[
          styles.body,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: fill,
            borderColor: '#FFFFFF',
            borderWidth: matches && isExposed ? 2 : 0,
          },
        ]}
      />
      <View
        style={[
          styles.speck,
          {
            width: size * 0.26,
            height: size * 0.26,
            borderRadius: size * 0.13,
            top: size * 0.2,
            left: size * 0.22,
          },
        ]}
      />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: { position: 'absolute' },
  body: { alignItems: 'center', justifyContent: 'center' },
  speck: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});

export const Orb = memo(OrbComponent);
