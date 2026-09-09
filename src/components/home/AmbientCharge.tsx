import { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { AmbientChargeSpec, Point } from '@/game/rendering/homeGeometry';
import { orbColors, orbGlow } from '@/theme/colors';
import { arcade } from '@/theme/arcade';

interface AmbientChargeProps {
  spec: AmbientChargeSpec;
  center: Point;
  radius: number;
  size: number;
  active: boolean;
  reducedMotion: boolean;
}

/**
 * One decorative charge riding the Home centerpiece rail. PRESENTATION ONLY —
 * no capacity, no shooting, not bound to engine state. Own period so the set
 * never reads as one synced loop.
 */
export const AmbientCharge = memo(function AmbientCharge({
  spec, center, radius, size, active, reducedMotion,
}: AmbientChargeProps) {
  const phase = useSharedValue(spec.phase);
  const r = size / 2;
  const period = spec.periodMs * (reducedMotion ? 1.9 : 1);

  useEffect(() => {
    cancelAnimation(phase);
    if (!active) return;
    // Resume from wherever the orbit paused; angle wraps mod 1 so start and
    // start+1 are the same rail position — the loop is visually continuous.
    const start = ((phase.get() % 1) + 1) % 1;
    phase.set(start);
    phase.set(withRepeat(withTiming(start + 1, { duration: period, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(phase);
  }, [active, period, phase]);

  const orbAt = (turns: number) => {
    'worklet';
    const angle = (turns % 1) * Math.PI * 2 - Math.PI / 2;
    return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
  };

  const body = useAnimatedStyle(() => {
    const p = orbAt(phase.value + spec.phase);
    return { transform: [{ translateX: p.x - r }, { translateY: p.y - r }] };
  });

  const trail = useAnimatedStyle(() => {
    if (reducedMotion || spec.trail <= 0) return { opacity: 0 };
    const p = orbAt(phase.value + spec.phase - 0.02);
    return { opacity: spec.trail, transform: [{ translateX: p.x - r * 0.6 }, { translateY: p.y - r * 0.6 }, { scale: 0.6 }] };
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.trail, { width: r * 1.2, height: r * 1.2, borderRadius: r * 0.6, backgroundColor: orbGlow[spec.color] }, trail]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orb,
          { width: size, height: size, borderRadius: r, backgroundColor: orbColors[spec.color], borderColor: orbGlow[spec.color] },
          body,
        ]}
      >
        <Animated.View style={[styles.gloss, { width: r, height: r * 0.7, borderRadius: r, top: r * 0.25, left: r * 0.28 }]} />
      </Animated.View>
    </>
  );
});

const styles = StyleSheet.create({
  orb: { position: 'absolute', left: 0, top: 0, borderWidth: 1.5, overflow: 'hidden' },
  gloss: { position: 'absolute', backgroundColor: arcade.glassHi, opacity: 0.5 },
  trail: { position: 'absolute', left: 0, top: 0 },
});
