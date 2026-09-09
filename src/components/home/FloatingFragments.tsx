import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { HomeLayout } from '@/game/rendering/homeGeometry';
import { arcade } from '@/theme/arcade';

interface FloatingFragmentsProps {
  layout: HomeLayout;
  active: boolean;
  reducedMotion: boolean;
}

/**
 * FOREGROUND depth layer: a few suspended machine / glass fragments with very
 * limited float. First layer dropped on small phones or reduced motion.
 */
export const FloatingFragments = memo(function FloatingFragments({ layout, active, reducedMotion }: FloatingFragmentsProps) {
  const { center, machineRadius: R } = layout;
  const pieces = [
    { x: center.x - R * 1.02, y: center.y - R * 0.55, w: 46, h: 14, rot: -0.3, period: 6100, amp: 5 },
    { x: center.x + R * 0.9, y: center.y + R * 0.15, w: 30, h: 30, rot: 0.5, period: 7700, amp: 4 },
    { x: center.x + R * 0.55, y: center.y - R * 1.04, w: 22, h: 10, rot: 0.15, period: 9300, amp: 6 },
  ];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Fragment key={i} piece={p} active={active} reducedMotion={reducedMotion} />
      ))}
    </View>
  );
});

function Fragment({ piece, active, reducedMotion }: {
  piece: { x: number; y: number; w: number; h: number; rot: number; period: number; amp: number };
  active: boolean;
  reducedMotion: boolean;
}) {
  const t = useSharedValue(0.5);

  useEffect(() => {
    cancelAnimation(t);
    if (!active || reducedMotion) { t.set(0.5); return; }
    t.set(withRepeat(withTiming(1, { duration: piece.period, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(t);
  }, [active, reducedMotion, piece.period, t]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: (t.value - 0.5) * piece.amp * 2 },
      { rotate: `${piece.rot + (t.value - 0.5) * 0.06}rad` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.shard,
        { left: piece.x, top: piece.y, width: piece.w, height: piece.h, borderRadius: Math.min(piece.w, piece.h) * 0.35 },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  shard: {
    position: 'absolute',
    backgroundColor: arcade.glassFill,
    borderWidth: 1,
    borderTopColor: arcade.glassEdge,
    borderLeftColor: arcade.glassEdge,
    borderRightColor: arcade.metalLo,
    borderBottomColor: arcade.metalLo,
    opacity: 0.7,
  },
});
