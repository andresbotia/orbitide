import { Blur, Canvas, Circle, Group, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { HomeLayout } from '@/game/rendering/homeGeometry';
import { arcade } from '@/theme/arcade';

interface StarfieldBackdropProps {
  width: number;
  height: number;
  layout: HomeLayout;
  active: boolean;
  reducedMotion: boolean;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * BACKGROUND depth layer: deep-space nebula haze, sparse stars, very slow
 * parallax drift. The two star groups drift at different amplitudes so the
 * field has depth without motion you'd notice head-on.
 */
export function StarfieldBackdrop({ width, height, layout, active, reducedMotion }: StarfieldBackdropProps) {
  const drift = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(drift);
    if (!active || reducedMotion) {
      drift.set(0);
      return;
    }
    drift.set(withRepeat(withTiming(1, { duration: 96000, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(drift);
  }, [active, reducedMotion, drift]);

  const far = useMemo(() => {
    const rand = mulberry32(0x51ede + layout.starCountFar);
    return Array.from({ length: layout.starCountFar }, () => ({
      x: rand() * width,
      y: rand() * height,
      r: 0.4 + rand() * 1.1,
      opacity: 0.05 + rand() * 0.16,
    }));
  }, [width, height, layout.starCountFar]);

  const near = useMemo(() => {
    const rand = mulberry32(0x9a71c + layout.starCountNear);
    return Array.from({ length: layout.starCountNear }, () => ({
      x: rand() * width,
      y: rand() * height,
      r: 0.8 + rand() * 1.6,
      opacity: 0.12 + rand() * 0.26,
    }));
  }, [width, height, layout.starCountNear]);

  const farShift = useDerivedValue(() => [
    { translateX: (drift.value - 0.5) * 10 },
    { translateY: (drift.value - 0.5) * 6 },
  ]);
  const nearShift = useDerivedValue(() => [
    { translateX: (drift.value - 0.5) * 26 },
    { translateY: (drift.value - 0.5) * 16 },
  ]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height} color={arcade.envBottom} />
      {layout.showNebula ? (
        <Group opacity={0.55}>
          <Blur blur={26} />
          <Circle cx={width * 0.24} cy={height * 0.26} r={width * 0.55}>
            <RadialGradient
              c={vec(width * 0.24, height * 0.26)}
              r={width * 0.55}
              colors={[arcade.nebulaCore, 'rgba(10,14,34,0)']}
            />
          </Circle>
          <Circle cx={width * 0.82} cy={height * 0.7} r={width * 0.5}>
            <RadialGradient
              c={vec(width * 0.82, height * 0.7)}
              r={width * 0.5}
              colors={['#241C48', 'rgba(10,14,34,0)']}
            />
          </Circle>
        </Group>
      ) : null}
      <Group transform={farShift} opacity={0.9}>
        {far.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} color={arcade.starFar} opacity={s.opacity} />
        ))}
      </Group>
      <Group transform={nearShift}>
        {near.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} color={arcade.starNear} opacity={s.opacity} />
        ))}
      </Group>
    </Canvas>
  );
}
