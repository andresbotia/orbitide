import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ambientMotion, ambientParticleCount, type AmbientIntensity } from '@/theme/ambientMotion';
import type { AmbientTreatmentId } from '@/theme/worldSkins';

interface AmbientLayerProps {
  ambientId: AmbientTreatmentId;
  accent: string;
  secondaryAccent: string;
  intensity: AmbientIntensity;
  active: boolean;
  reducedMotion: boolean;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * PIXEL ARCADIA WORLD AMBIENCE (UI-R7) — the one shared, reusable ambient
 * renderer every screen uses (World Level Select = high, World Select cards
 * = low, Gameplay = low). Reads `theme/ambientMotion.ts`'s small declarative
 * registry (four motion kinds, no per-world bespoke logic) and
 * `worldSkin`'s accent/secondaryAccent — never a `themeId === '...'` branch
 * in a screen. Plain `Animated.View`s (no extra Skia canvas), bounded
 * particle counts, paused whenever `active` is false.
 */
export const AmbientLayer = memo(function AmbientLayer({
  ambientId, accent, secondaryAccent, intensity, active, reducedMotion,
}: AmbientLayerProps) {
  const spec = ambientMotion(ambientId);
  const count = ambientParticleCount(intensity, ambientId);

  const particles = useMemo(() => {
    const next = rng(hashId(ambientId) + count * 7);
    return Array.from({ length: count }, (_, i) => ({
      x: next(),
      y: next(),
      size: spec.shape === 'line' ? 1.5 + next() * 1 : 3 + next() * 4,
      length: spec.shape === 'line' ? 14 + next() * 16 : 0,
      color: i % 2 === 0 ? accent : secondaryAccent,
      opacity: 0.18 + next() * 0.24,
      phase: next(),
      period: Math.round(spec.periodMs * (0.75 + next() * 0.6)),
    }));
  }, [ambientId, count, spec.shape, spec.periodMs, accent, secondaryAccent]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <AmbientParticle key={i} spec={p} kind={spec.kind} shape={spec.shape} active={active} reducedMotion={reducedMotion} />
      ))}
    </View>
  );
});

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h >>> 0;
}

function AmbientParticle({ spec, kind, shape, active, reducedMotion }: {
  spec: { x: number; y: number; size: number; length: number; color: string; opacity: number; phase: number; period: number };
  kind: 'driftUp' | 'driftSide' | 'twinkle' | 'sway';
  shape: 'dot' | 'square' | 'line';
  active: boolean;
  reducedMotion: boolean;
}) {
  const t = useSharedValue(reducedMotion ? 0.5 : spec.phase);

  useEffect(() => {
    cancelAnimation(t);
    if (!active || reducedMotion) { t.set(0.5); return; }
    t.set(withRepeat(withTiming(1, { duration: spec.period, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(t);
  }, [active, reducedMotion, spec.period, t]);

  const style = useAnimatedStyle(() => {
    const v = t.value;
    if (reducedMotion) {
      // Static thematic presence — no travel, no rotation, still on-theme.
      return { opacity: spec.opacity * 0.7 };
    }
    if (kind === 'driftUp') {
      const rise = interpolate(v, [0, 1], [8, -8]);
      const fade = interpolate(v, [0, 0.5, 1], [0, spec.opacity, 0]);
      return { opacity: fade, transform: [{ translateY: rise }] };
    }
    if (kind === 'driftSide') {
      const shift = interpolate(v, [0, 1], [-10, 10]);
      return { opacity: spec.opacity, transform: [{ translateX: shift }] };
    }
    if (kind === 'sway') {
      const shift = interpolate(v, [0, 1], [-4, 4]);
      const rotate = interpolate(v, [0, 1], [-6, 6]);
      return { opacity: spec.opacity, transform: [{ translateX: shift }, { rotate: `${rotate}deg` }] };
    }
    // twinkle
    const twinkleOpacity = interpolate(v, [0, 1], [spec.opacity * 0.35, spec.opacity]);
    return { opacity: twinkleOpacity };
  });

  const isLine = shape === 'line';
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${spec.x * 100}%`,
          top: `${spec.y * 100}%`,
          width: isLine ? spec.length : spec.size,
          height: isLine ? 2 : spec.size,
          borderRadius: shape === 'square' ? 1 : spec.size,
          backgroundColor: spec.color,
        },
        style,
      ]}
    />
  );
}
