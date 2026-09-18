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
  clock?: SharedValue<number>;
  clearAt?: number;
}

/**
 * Production base pixel. Idle cubes are plain Views — a board can carry
 * 700+ cells, and Animated worklets on every idle cube were the hot-path
 * cost during multi-Pal firing. Only cubes currently popping pay for
 * `useAnimatedStyle`.
 */
export const Pixel = memo(function Pixel(props: PixelProps) {
  if (props.clearAt === undefined || props.clock === undefined) {
    return <StaticPixel {...props} />;
  }
  return <ClearingPixel {...props} clock={props.clock} clearAt={props.clearAt} />;
}, (prev, next) => (
  prev.color === next.color &&
  prev.cx === next.cx &&
  prev.cy === next.cy &&
  prev.cell === next.cell &&
  prev.reachable === next.reachable &&
  prev.modifierDim === next.modifierDim &&
  prev.adaptive === next.adaptive &&
  prev.clock === next.clock &&
  prev.clearAt === next.clearAt
));

function pixelLayout(props: PixelProps) {
  const { color, cell, reachable, adaptive, modifierDim = 0 } = props;
  const gutter = adaptive.gutter;
  const size = Math.max(4, cell - gutter);
  const material = pixelMaterial(color);
  const bevel = Math.min(adaptive.bevel, size * 0.22);
  const cornerRadius = Math.max(1.5, cell * adaptive.cornerRadius);
  const rest = (reachable ? 1 : 0.62) * (1 - modifierDim * 0.55);
  return { size, material, bevel, cornerRadius, rest, adaptive, reachable, modifierDim };
}

function PixelChrome({
  size, material, bevel, cornerRadius, adaptive, reachable, modifierDim = 0,
}: ReturnType<typeof pixelLayout>) {
  return (
    <>
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
    </>
  );
}

const StaticPixel = memo(function StaticPixel(props: PixelProps) {
  const chrome = pixelLayout(props);
  const { size, material, bevel, cornerRadius, rest } = chrome;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          left: props.cx - size / 2,
          top: props.cy - size / 2,
          borderRadius: cornerRadius,
          backgroundColor: material.base,
          borderWidth: bevel,
          borderTopColor: material.top,
          borderLeftColor: material.top,
          borderRightColor: material.bottom,
          borderBottomColor: material.bottom,
          opacity: rest,
        },
      ]}
    >
      <PixelChrome {...chrome} />
    </View>
  );
});

const ClearingPixel = memo(function ClearingPixel({
  cx, cy, clock, clearAt, ...rest
}: PixelProps & { clock: SharedValue<number>; clearAt: number }) {
  const chrome = pixelLayout({ cx, cy, clock, clearAt, ...rest });
  const { size, material, bevel, cornerRadius, rest: restOpacity, adaptive } = chrome;
  const popOvershoot = adaptive.popOvershoot;

  const animated = useAnimatedStyle(() => {
    const elapsed = clock.value - clearAt;
    if (elapsed < 0) {
      return { opacity: restOpacity, transform: [{ scale: 1 }] };
    }
    const p = Math.max(0, Math.min(1, elapsed / FEEL.PIXEL_POP_DURATION));
    const overshoot = p < 0.35
      ? 1 + popOvershoot * (p / 0.35)
      : (1 + popOvershoot) * Math.max(0, 1 - (p - 0.35) / 0.65);
    const flash = p < 0.22 ? 1 - p / 0.22 : 0;
    return {
      opacity: restOpacity * (1 - p),
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
      <PixelChrome {...chrome} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  highlight: { position: 'absolute', top: 0, left: 0, right: 0 },
  shade: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  rim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
