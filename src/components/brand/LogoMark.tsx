import { memo } from 'react';
import { View, type ViewStyle } from 'react-native';

import { brandColor } from '@/theme/brand';
import { ARCH_BLOCKS, MARK_VIEWBOX, type UnitRect } from './geometry';
import { PixelCore } from './PixelCore';

export type LogoMarkVariant = 'full' | 'mono-light' | 'mono-dark';

interface LogoMarkProps {
  /** Rendered edge length in px. Minimum 20 (full) / 16 (mono). */
  size: number;
  variant?: LogoMarkVariant;
  /** Override the ink for a monochrome variant (e.g. the muted empty-state arch). */
  ink?: string;
  /**
   * Optional warm glow layer behind the mark. Never part of the mark itself —
   * the logo must stay recognisable with `glow={false}` (the default).
   */
  glow?: boolean;
  /** Omit the pixel core → an "unlit portal" (empty/error states). */
  unlit?: boolean;
  /**
   * Accessible name. Omit / pass `null` to hide the mark from screen readers
   * (decorative use next to the live wordmark).
   */
  accessibilityLabel?: string | null;
  style?: ViewStyle;
}

const INK: Record<Exclude<LogoMarkVariant, 'full'>, string> = {
  'mono-light': '#120E2A',
  'mono-dark': brandColor.textPrimary,
};

/**
 * The Pixel Arcadia logo mark — the reduced, rebuilt-as-geometry portal glyph
 * (5-block arch + plus-shaped pixel core). Not a crop of the raster app icon.
 * Rendered from plain Views: the project has no react-native-svg and the mark
 * is a handful of rectangles, so this stays dependency-free and cheap to mount.
 *
 * Below ~24px the core arms are dropped automatically; below 20px prefer a
 * monochrome variant.
 */
export const LogoMark = memo(function LogoMark({
  size,
  variant = 'full',
  ink,
  glow = false,
  unlit = false,
  accessibilityLabel,
  style,
}: LogoMarkProps) {
  const u = size / MARK_VIEWBOX;
  const mono = variant !== 'full';
  const monoInk = mono ? (ink ?? INK[variant]) : undefined;
  const blockColor = monoInk ?? brandColor.indigo;
  const highlight = mono ? null : '#8FA8FF';
  const showArms = size >= 24;

  const block = (r: UnitRect, key: string) => (
    <View
      key={key}
      style={{
        position: 'absolute',
        left: r.x * u,
        top: r.y * u,
        width: r.w * u,
        height: r.h * u,
        borderRadius: r.r * u,
        backgroundColor: blockColor,
        overflow: 'hidden',
        transform: r.rot ? [{ rotate: `${r.rot}deg` }] : undefined,
      }}
    >
      {highlight ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: '46%',
            backgroundColor: highlight,
            opacity: 0.55,
          }}
        />
      ) : null}
    </View>
  );

  const a11y =
    accessibilityLabel === null
      ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const }
      : accessibilityLabel
        ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
        : {};

  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none" {...a11y}>
      {glow ? (
        <View
          style={{
            position: 'absolute',
            left: -size * 0.28,
            top: -size * 0.28,
            width: size * 1.56,
            height: size * 1.56,
            borderRadius: size * 0.78,
            backgroundColor: brandColor.glow,
            opacity: 0.14,
          }}
        />
      ) : null}
      {ARCH_BLOCKS.map((r, i) => block(r, `blk-${i}`))}
      {unlit ? null : (
        <PixelCore
          size={size}
          variant={mono ? 'mono' : 'warm'}
          ink={monoInk}
          arms={showArms}
          style={{ position: 'absolute', left: 0, top: 0 }}
        />
      )}
    </View>
  );
});
