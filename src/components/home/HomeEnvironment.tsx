import { Canvas, Circle, Group, RadialGradient, Rect, RoundedRect, vec } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { brandGradient, brandColor } from '@/theme/brand';
import { material } from '@/theme/material';
import type { HomeLayout } from '@/game/rendering/homeGeometry';

interface HomeEnvironmentProps {
  width: number;
  height: number;
  layout: HomeLayout;
  /** World-accent hint, used only as a faint distant tint — never full chrome. */
  worldAccent: string;
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
 * PIXEL ARCADIA HOME ENVIRONMENT (UI-R2) — replaces `StarfieldBackdrop`'s
 * deep-space nebula/star field. Reads as an arcade hub: the true radial
 * `brandGradient.background`, distant dimensional structural silhouettes
 * echoing the icon's arch/blocks, a rising warm portal glow, and a SPARSE,
 * low-opacity sparkle layer kept deliberately minor — night sky is
 * background texture here, not the identity (redesign brief). World
 * identity shows only as one faint distant tint, never a chrome recolor.
 */
export const HomeEnvironment = memo(function HomeEnvironment({
  width, height, layout, worldAccent, active, reducedMotion,
}: HomeEnvironmentProps) {
  const drift = useSharedValue(0);
  const glowBreath = useSharedValue(0.5);

  useEffect(() => {
    cancelAnimation(drift);
    cancelAnimation(glowBreath);
    if (!active) return;
    if (!reducedMotion) {
      drift.set(withRepeat(withTiming(1, { duration: 42000, easing: Easing.inOut(Easing.sin) }), -1, true));
    }
    glowBreath.set(withRepeat(
      withTiming(1, { duration: reducedMotion ? 6000 : 3400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    ));
    return () => { cancelAnimation(drift); cancelAnimation(glowBreath); };
  }, [active, reducedMotion, drift, glowBreath]);

  // Sparse minor sparkle layer — a fraction of the old starfield's density,
  // deliberately dim. Fixed seed so Home doesn't re-scatter on every layout pass.
  const sparkles = useMemo(() => {
    const rand = mulberry32(0x504958);
    const count = Math.min(22, Math.max(6, Math.round(layout.starCountFar * 0.35)));
    return Array.from({ length: count }, () => ({
      x: rand() * width,
      y: rand() * height * 0.75,
      r: 0.5 + rand() * 1.1,
      opacity: 0.05 + rand() * 0.12,
    }));
  }, [width, height, layout.starCountFar]);

  // Distant structural silhouettes — blocky, low-contrast shapes near the
  // base, echoing the icon's pillar/arch language without drawing the icon.
  const structures = useMemo(() => {
    const baseY = height * 0.86;
    return [
      { x: width * 0.06, w: width * 0.22, h: height * 0.16, r: 10 },
      { x: width * 0.74, w: width * 0.2, h: height * 0.13, r: 10 },
      { x: width * 0.32, w: width * 0.14, h: height * 0.08, r: 8 },
    ].map((s) => ({ ...s, y: baseY - s.h }));
  }, [width, height]);

  const driftShift = useDerivedValue(() => [{ translateX: (drift.value - 0.5) * 8 }]);
  const glowOpacity = useDerivedValue(() => 0.1 + glowBreath.value * 0.06);

  const bg = brandGradient.background;
  const portalCx = (width * (bg.center?.[0] ?? 50)) / 100;
  const portalCy = (height * (bg.center?.[1] ?? 34)) / 100;
  const portalR = Math.max(width, height) * ((bg.radius ?? 130) / 100);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Base field — the true radial `brandGradient.background`, not the
          LinearGradient top-to-bottom fallback `BrandGradientView` uses. */}
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(portalCx, portalCy)}
          r={portalR}
          colors={bg.stops.map((s) => s.color)}
          positions={bg.stops.map((s) => s.at)}
        />
      </Rect>

      {/* Distant dimensional structures — low-contrast, never competing with the centerpiece. */}
      <Group opacity={0.5}>
        {structures.map((s, i) => (
          <RoundedRect key={i} x={s.x} y={s.y} width={s.w} height={s.h} r={s.r} color={material.recessedSurface} />
        ))}
      </Group>

      {/* Rising warm portal glow — establishes "portal" mood before the centerpiece mounts. */}
      <Circle cx={width / 2} cy={height * 0.62} r={width * 0.75} opacity={glowOpacity}>
        <RadialGradient
          c={vec(width / 2, height * 0.62)}
          r={width * 0.75}
          colors={[material.energyGlow, 'rgba(255,178,77,0)']}
        />
      </Circle>

      {/* Faint world-accent tint, far background only — environment hint, not chrome recolor. */}
      <Circle cx={width * 0.5} cy={height * 0.2} r={width * 0.6} opacity={0.16}>
        <RadialGradient
          c={vec(width * 0.5, height * 0.2)}
          r={width * 0.6}
          colors={[worldAccent, 'rgba(0,0,0,0)']}
        />
      </Circle>

      {/* Minor sparkle layer — sparse, dim, drifts almost imperceptibly. */}
      <Group transform={driftShift} opacity={0.85}>
        {sparkles.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} color={brandColor.textPrimary} opacity={s.opacity} />
        ))}
      </Group>
    </Canvas>
  );
});
