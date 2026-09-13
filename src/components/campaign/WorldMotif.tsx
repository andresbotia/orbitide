import { memo, useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import type { AmbientTreatmentId } from '@/theme/worldSkins';

interface WorldMotifProps {
  ambientId: AmbientTreatmentId;
  accent: string;
  secondaryAccent: string;
  /** Locked worlds show the same identity, muted. */
  muted?: boolean;
  style?: ViewStyle;
}

interface Shape {
  x: number; y: number; w: number; h: number;
  r?: number;
  rotate?: number;
  tone?: 'accent' | 'secondary';
  opacity?: number;
}

/** Tiny deterministic PRNG so a motif's scatter is stable across renders. */
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
 * A world's static visual identity (UI-R5) — legible in a single still frame,
 * built from ONE shared shape vocabulary (small rects/pills) rather than ten
 * bespoke systems. The larger ambient-motion pass (particles,
 * parallax) is UI-R7; this is deliberately restrained: a compact scatter
 * recolored by `theme/worldSkins.ts`'s per-world accent/secondaryAccent.
 */
export const WorldMotif = memo(function WorldMotif({ ambientId, accent, secondaryAccent, muted, style }: WorldMotifProps) {
  const shapes = useMemo(() => buildShapes(ambientId), [ambientId]);
  const opacityScale = muted ? 0.4 : 1;

  return (
    <View style={[styles.root, style]} pointerEvents="none">
      {shapes.map((s, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${s.x * 100}%`,
            top: `${s.y * 100}%`,
            width: `${s.w * 100}%`,
            height: `${s.h * 100}%`,
            borderRadius: (s.r ?? 0) * 100,
            backgroundColor: s.tone === 'secondary' ? secondaryAccent : accent,
            opacity: (s.opacity ?? 1) * opacityScale,
            transform: s.rotate ? [{ rotate: `${s.rotate}deg` }] : undefined,
          }}
        />
      ))}
    </View>
  );
});

/**
 * Coordinates are fractions of the motif's own box (0..1), so one component
 * scales to any card size. Each pattern uses 4-8 shapes, never more.
 */
function buildShapes(id: AmbientTreatmentId): Shape[] {
  switch (id) {
    case 'warmDawn': // First Light — concentric glow arcs low in frame
      return [
        { x: 0.1, y: 0.55, w: 0.8, h: 0.8, r: 0.5, tone: 'accent', opacity: 0.14 },
        { x: 0.25, y: 0.65, w: 0.5, h: 0.5, r: 0.5, tone: 'accent', opacity: 0.22 },
        { x: 0.38, y: 0.72, w: 0.24, h: 0.24, r: 0.5, tone: 'secondary', opacity: 0.5 },
      ];
    case 'foliage': // Wild Garden — clustered leaf-like ellipses
      return [
        { x: 0.06, y: 0.5, w: 0.22, h: 0.4, r: 0.5, tone: 'accent', rotate: -18, opacity: 0.55 },
        { x: 0.2, y: 0.3, w: 0.2, h: 0.36, r: 0.5, tone: 'accent', rotate: 12, opacity: 0.5 },
        { x: 0.68, y: 0.42, w: 0.24, h: 0.42, r: 0.5, tone: 'secondary', rotate: -10, opacity: 0.45 },
        { x: 0.82, y: 0.2, w: 0.16, h: 0.3, r: 0.5, tone: 'accent', rotate: 22, opacity: 0.4 },
      ];
    case 'neonSignage': // Neon Nights — vertical light-strip lines
      return [
        { x: 0.12, y: 0.1, w: 0.05, h: 0.8, tone: 'accent', opacity: 0.6 },
        { x: 0.3, y: 0.25, w: 0.05, h: 0.65, tone: 'secondary', opacity: 0.5 },
        { x: 0.6, y: 0.05, w: 0.05, h: 0.9, tone: 'accent', opacity: 0.4 },
        { x: 0.78, y: 0.3, w: 0.05, h: 0.6, tone: 'secondary', opacity: 0.6 },
      ];
    case 'gearsSteam': // Mechanical City — gear rings + spoke
      return [
        { x: 0.08, y: 0.35, w: 0.42, h: 0.42, r: 0.5, tone: 'accent', opacity: 0.28 },
        { x: 0.18, y: 0.45, w: 0.22, h: 0.22, r: 0.5, tone: 'secondary', opacity: 0.4 },
        { x: 0.55, y: 0.15, w: 0.3, h: 0.3, r: 0.5, tone: 'accent', opacity: 0.2 },
        { x: 0.63, y: 0.23, w: 0.14, h: 0.14, r: 0.5, tone: 'secondary', opacity: 0.35 },
      ];
    case 'starfield': // Cosmic Frontier — scatter + one "planet"
      return buildScatter(0x5c05f1e, 6).concat([
        { x: 0.62, y: 0.2, w: 0.34, h: 0.34, r: 0.5, tone: 'accent', opacity: 0.3 },
      ]);
    case 'skylineDrift': // World Landmarks — stepped skyline silhouette
      return [
        { x: 0.02, y: 0.55, w: 0.16, h: 0.45, tone: 'accent', opacity: 0.35 },
        { x: 0.2, y: 0.35, w: 0.16, h: 0.65, tone: 'accent', opacity: 0.45 },
        { x: 0.38, y: 0.6, w: 0.14, h: 0.4, tone: 'secondary', opacity: 0.35 },
        { x: 0.56, y: 0.25, w: 0.16, h: 0.75, tone: 'accent', opacity: 0.4 },
        { x: 0.75, y: 0.5, w: 0.16, h: 0.5, tone: 'secondary', opacity: 0.3 },
      ];
    case 'currents': // Ocean Depths — waves + bubbles
      return [
        { x: 0, y: 0.65, w: 1, h: 0.06, r: 0.03, tone: 'accent', opacity: 0.3 },
        { x: 0, y: 0.8, w: 1, h: 0.05, r: 0.03, tone: 'secondary', opacity: 0.24 },
        { x: 0.15, y: 0.15, w: 0.1, h: 0.1, r: 0.5, tone: 'accent', opacity: 0.4 },
        { x: 0.35, y: 0.3, w: 0.06, h: 0.06, r: 0.5, tone: 'secondary', opacity: 0.45 },
        { x: 0.65, y: 0.1, w: 0.08, h: 0.08, r: 0.5, tone: 'accent', opacity: 0.35 },
      ];
    case 'arcaneParticles': // Mythic Realm — sparkle diamonds
      return [
        { x: 0.1, y: 0.2, w: 0.12, h: 0.12, tone: 'accent', rotate: 45, opacity: 0.5 },
        { x: 0.3, y: 0.55, w: 0.08, h: 0.08, tone: 'secondary', rotate: 45, opacity: 0.55 },
        { x: 0.55, y: 0.15, w: 0.1, h: 0.1, tone: 'accent', rotate: 45, opacity: 0.4 },
        { x: 0.72, y: 0.45, w: 0.14, h: 0.14, tone: 'secondary', rotate: 45, opacity: 0.45 },
        { x: 0.4, y: 0.72, w: 0.07, h: 0.07, tone: 'accent', rotate: 45, opacity: 0.5 },
      ];
    case 'duskAsh': { // Prehistoric Titans — jagged silhouette + speckle
      const silhouette: Shape[] = [
        { x: 0.05, y: 0.5, w: 0.3, h: 0.5, tone: 'accent', rotate: -6, opacity: 0.32 },
        { x: 0.3, y: 0.35, w: 0.24, h: 0.65, tone: 'secondary', rotate: 4, opacity: 0.3 },
        { x: 0.58, y: 0.55, w: 0.28, h: 0.45, tone: 'accent', rotate: -3, opacity: 0.28 },
      ];
      return silhouette.concat(buildScatter(0x0a54ae5, 4, 0.35));
    }
    case 'galleryDust': { // Masterpiece Gallery — frame + dust motes
      const frame: Shape[] = [
        { x: 0.14, y: 0.14, w: 0.72, h: 0.72, r: 0.06, tone: 'accent', opacity: 0.22 },
        { x: 0.24, y: 0.24, w: 0.52, h: 0.52, r: 0.04, tone: 'secondary', opacity: 0.3 },
      ];
      return frame.concat(buildScatter(0x51de17a, 4, 0.3));
    }
    default:
      return [];
  }
}

function buildScatter(seed: number, count: number, opacity = 0.4): Shape[] {
  const next = rng(seed);
  return Array.from({ length: count }, (): Shape => ({
    x: next() * 0.9,
    y: next() * 0.85,
    w: 0.04 + next() * 0.03,
    h: 0.04 + next() * 0.03,
    r: 0.5,
    tone: next() > 0.5 ? 'secondary' : 'accent',
    opacity,
  }));
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
});
