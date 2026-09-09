import { memo } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { brandGradient, type BrandGradientToken } from '@/theme/brand';

interface BrandGradientViewProps {
  /** One of the four approved gradients. Radial tokens fall back to a top→bottom sweep. */
  token: BrandGradientToken;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}

/** CSS-ish angle (0 = up, 180 = down) → expo-linear-gradient start/end. */
function angleToVector(angle: number): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const rad = ((angle - 90) * Math.PI) / 180;
  const x = Math.cos(rad);
  const y = Math.sin(rad);
  return {
    start: { x: 0.5 - x / 2, y: 0.5 - y / 2 },
    end: { x: 0.5 + x / 2, y: 0.5 + y / 2 },
  };
}

/**
 * Centralised renderer for the four approved brand gradients. This is the only
 * place gradient stops are turned into pixels; every brand surface that needs a
 * gradient goes through here so no fifth gradient can quietly appear.
 */
export const BrandGradientView = memo(function BrandGradientView({
  token,
  style,
  children,
  pointerEvents,
}: BrandGradientViewProps) {
  const g = brandGradient[token];
  const colors = g.stops.map((s) => s.color) as [string, string, ...string[]];
  const locations = g.stops.map((s) => s.at) as [number, number, ...number[]];
  const { start, end } = angleToVector(g.kind === 'linear' ? (g.angle ?? 180) : 180);

  return (
    <LinearGradient
      colors={colors}
      locations={locations}
      start={start}
      end={end}
      style={style}
      pointerEvents={pointerEvents}
    >
      {children}
    </LinearGradient>
  );
});
