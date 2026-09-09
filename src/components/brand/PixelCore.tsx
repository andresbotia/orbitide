import { memo } from 'react';
import { View, type ViewStyle } from 'react-native';

import { brandColor } from '@/theme/brand';
import { CORE_ARMS, CORE_CENTER, CORE_RAMP, MARK_VIEWBOX, type UnitRect } from './geometry';

interface PixelCoreProps {
  /** Rendered edge length in px (the core occupies the full box). */
  size: number;
  /**
   * `warm`  — the emissive brand core (white→amber ramp).
   * `mono`  — a single flat ink (used inside a monochrome mark).
   */
  variant?: 'warm' | 'mono';
  /** Flat ink for the `mono` variant. */
  ink?: string;
  /** Drop the four arms below ~24px where they stop reading (§ Logo mark). */
  arms?: boolean;
  style?: ViewStyle;
}

/**
 * The plus-shaped pixel core — a hard-edged pixel sun, never a circle. Built
 * from plain Views (the project renders gameplay with Skia, not react-native-svg,
 * and the simplified brand mark is a handful of rectangles). The warm variant
 * approximates `brandGradient.core` with concentric hard pixels: glow, if any,
 * is layered by the caller and never part of the core itself.
 */
export const PixelCore = memo(function PixelCore({
  size,
  variant = 'warm',
  ink = brandColor.textPrimary,
  arms = true,
  style,
}: PixelCoreProps) {
  const u = size / MARK_VIEWBOX;
  const rect = (r: UnitRect, key: string, color: string, extra?: ViewStyle) => (
    <View
      key={key}
      style={{
        position: 'absolute',
        left: r.x * u,
        top: r.y * u,
        width: r.w * u,
        height: r.h * u,
        borderRadius: r.r * u,
        backgroundColor: color,
        ...extra,
      }}
    />
  );

  if (variant === 'mono') {
    return (
      <View style={[{ width: size, height: size }, style]} pointerEvents="none">
        {arms ? CORE_ARMS.map((a, i) => rect(a, `arm-${i}`, ink)) : null}
        {rect(CORE_CENTER, 'center', ink)}
      </View>
    );
  }

  // Warm variant: base amber pixel, then two tighter inner pixels for the ramp,
  // then a white centre pip — all hard-edged, matching CORE_RAMP.
  const c = CORE_CENTER;
  const inset = (k: number): UnitRect => ({
    x: c.x + (c.w * k) / 2,
    y: c.y + (c.h * k) / 2,
    w: c.w * (1 - k),
    h: c.h * (1 - k),
    r: Math.max(0, c.r * (1 - k)),
  });

  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      {arms ? CORE_ARMS.map((a, i) => rect(a, `arm-${i}`, CORE_RAMP[3])) : null}
      {rect(c, 'ramp-0', CORE_RAMP[3])}
      {rect(inset(0.18), 'ramp-1', CORE_RAMP[2])}
      {rect(inset(0.44), 'ramp-2', CORE_RAMP[1])}
      {rect(inset(0.68), 'ramp-3', CORE_RAMP[0])}
    </View>
  );
});
