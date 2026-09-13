import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { FEEL } from '@/game/presentation/constants';
import type { OrbColor } from '@/game/engine/types';
import { pixelMaterial } from '@/theme/arcade';
import type { PixelAdaptive } from './boardGeometry';

interface PixelProps {
  color: OrbColor;
  cx: number;
  cy: number;
  cell: number;
  reachable: boolean;
  adaptive: PixelAdaptive;
  /**
   * 0..1 — how much a modifier compromises the base cube's presence
   * (locked desaturation, hidden concealment). Presentation only.
   */
  modifierDim?: number;
  clock: SharedValue<number>;
  clearAt?: number;
}

/**
 * Production base pixel: a dimensional extruded body with consistent top-left
 * lighting — top highlight, lower/right shadow via a bevel, a restrained inner
 * emissive rim when the pixel is reachable. All depth cues scale down as the
 * board gets denser (see `PixelAdaptive`). A clean overlay layer is reserved for
 * a future Color Assist mark.
 */
export const Pixel = memo(function Pixel({
  color, cx, cy, cell, reachable, adaptive, modifierDim = 0, clock, clearAt,
}: PixelProps) {
  const gutter = adaptive.gutter;
  const size = Math.max(4, cell - gutter);
  const material = pixelMaterial(color);
  const bevel = Math.min(adaptive.bevel, size * 0.22);
  const cornerRadius = Math.max(1.5, cell * adaptive.cornerRadius);
  const rest = (reachable ? 1 : 0.62) * (1 - modifierDim * 0.55);

  const popOvershoot = adaptive.popOvershoot;
  // UI-R9 — a very fast brightness peak on clear, folded into this SAME
  // worklet/View rather than a second `useAnimatedStyle`/overlay layer: a
  // board can carry 700+ `Pixel` instances, and only the ones actively
  // clearing (this branch) ever pay the extra `interpolateColor` cost — the
  // idle branch below is untouched and exactly as cheap as before.
  const animated = useAnimatedStyle(() => {
    if (clearAt === undefined) {
      return { opacity: rest, transform: [{ scale: 1 }] };
    }
    const p = Math.max(0, Math.min(1, (clock.value - clearAt) / FEEL.PIXEL_POP_DURATION));
    const overshoot = p < 0.35
      ? 1 + popOvershoot * (p / 0.35)
      : (1 + popOvershoot) * Math.max(0, 1 - (p - 0.35) / 0.65);
    const flash = p < 0.22 ? 1 - p / 0.22 : 0;
    return {
      opacity: rest * (1 - p),
      backgroundColor: flash > 0 ? interpolateColor(flash, [0, 1], [material.base, '#FFFFFF']) : material.base,
      transform: [{ scale: p === 0 ? 1 : overshoot }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          left: cx - size / 2,
          top: cy - size / 2,
          borderRadius: cornerRadius,
          backgroundColor: material.base,
          borderWidth: bevel,
          borderTopColor: material.top,
          borderLeftColor: material.top,
          borderRightColor: material.bottom,
          borderBottomColor: material.bottom,
        },
        animated,
      ]}
    >
      {/* Top highlight — directional light from the upper-left. */}
      <View
        style={[
          styles.highlight,
          {
            height: size * 0.42,
            borderTopLeftRadius: cornerRadius,
            borderTopRightRadius: cornerRadius,
            backgroundColor: material.top,
            opacity: adaptive.highlight,
          },
        ]}
      />
      {/* Lower shadow pool. */}
      <View
        style={[
          styles.shade,
          {
            height: size * 0.32,
            borderBottomLeftRadius: cornerRadius,
            borderBottomRightRadius: cornerRadius,
            backgroundColor: material.bottom,
            opacity: adaptive.shadow,
          },
        ]}
      />
      {/* Restrained inner emissive rim when reachable. */}
      {reachable ? (
        <View
          style={[
            styles.rim,
            {
              borderRadius: Math.max(1, cornerRadius - 1),
              borderColor: material.rim,
              borderWidth: Math.max(1, bevel * 0.8),
              opacity: (0.35 + adaptive.glow * 0.5) * (1 - modifierDim),
            },
          ]}
        />
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  highlight: { position: 'absolute', top: 0, left: 0, right: 0 },
  shade: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  rim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
