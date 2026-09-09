import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { OrbColor } from '@/game/engine/types';
import {
  markContrast,
  markDetail,
  simplifiedMark,
  type MarkPart,
} from '@/theme/colorAssist';

interface ColorAssistMarkProps {
  color: OrbColor;
  /** Box edge length in px. */
  size: number;
  /** Board density — drives the simplification fallback. */
  density?: number;
  /** Slightly translucent, for an "etched into the material" look on charges. */
  etched?: boolean;
}

/**
 * Renders the unique non-colour mark for a gameplay colour, from the pure
 * `colorAssist` model. Pure RN views (no SVG/Skia) so the identical mark renders
 * on a board pixel, an orbiting charge, a tunnel front and a Holding charge.
 */
export const ColorAssistMark = memo(function ColorAssistMark({
  color, size, density = 7, etched = false,
}: ColorAssistMarkProps) {
  const detail = markDetail(density);
  const { parts, minStroke } = simplifiedMark(color, detail);
  const contrast = markContrast(color);
  const stroke = Math.max(1, size * Math.max(minStroke, 0.09));
  const baseOpacity = etched ? 0.7 : 1;
  // Drop the halo pass at the densest boards — the heavier minimal stroke keeps
  // it readable and this halves the view count per mark.
  const halo = detail === 'minimal' ? null : contrast.halo;

  const layer = (fill: string, scale: number, opacity: number, key: string) => (
    <View key={key} style={[styles.center, { opacity }]}>
      {parts.map((part, i) => (
        <Part key={i} part={part} size={size} stroke={stroke} color={fill} scale={scale} />
      ))}
    </View>
  );

  return (
    <View style={[styles.box, { width: size, height: size }]} pointerEvents="none">
      {halo ? layer(halo, 1.2, 0.85 * baseOpacity, 'halo') : null}
      {layer(contrast.fill, 1, baseOpacity, 'fill')}
    </View>
  );
});

function Part({ part, size, stroke, color, scale }: {
  part: MarkPart; size: number; stroke: number; color: string; scale: number;
}) {
  const s = size * scale;
  switch (part.p) {
    case 'dot': {
      const d = s * 0.34 * (part.scale ?? 1);
      return <View style={[styles.abs, { width: d, height: d, borderRadius: d, backgroundColor: color }]} />;
    }
    case 'ring': {
      const d = s * 0.66 * (part.scale ?? 1);
      return <View style={[styles.abs, { width: d, height: d, borderRadius: d, borderWidth: stroke, borderColor: color }]} />;
    }
    case 'bar': {
      const len = s * (part.len ?? 0.62);
      const [ox, oy] = part.offset ?? [0, 0];
      return (
        <View
          style={[
            styles.abs,
            {
              width: len,
              height: stroke,
              borderRadius: stroke / 2,
              backgroundColor: color,
              transform: [
                { translateX: ox * s },
                { translateY: oy * s },
                { rotate: `${part.angle}deg` },
              ],
            },
          ]}
        />
      );
    }
    case 'tri': {
      const w = s * 0.3;
      const h = s * 0.52;
      const up = part.dir === 'up';
      if (part.fill) {
        return (
          <View
            style={[
              styles.abs,
              {
                width: 0,
                height: 0,
                borderLeftWidth: w,
                borderRightWidth: w,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderBottomWidth: up ? h : 0,
                borderTopWidth: up ? 0 : h,
                borderBottomColor: up ? color : 'transparent',
                borderTopColor: up ? 'transparent' : color,
                transform: [{ translateY: up ? -h * 0.12 : h * 0.12 }],
              },
            ]}
          />
        );
      }
      // Outline triangle — three bars along the edges.
      const apex: [number, number] = up ? [0, -0.3] : [0, 0.3];
      const bl: [number, number] = up ? [-0.3, 0.26] : [-0.3, -0.26];
      const br: [number, number] = up ? [0.3, 0.26] : [0.3, -0.26];
      const edge = (a: [number, number], b: [number, number], k: string) => {
        const mx = ((a[0] + b[0]) / 2) * s;
        const my = ((a[1] + b[1]) / 2) * s;
        const len = Math.hypot((b[0] - a[0]) * s, (b[1] - a[1]) * s);
        const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
        return (
          <View
            key={k}
            style={[styles.abs, {
              width: len, height: stroke, borderRadius: stroke / 2, backgroundColor: color,
              transform: [{ translateX: mx }, { translateY: my }, { rotate: `${ang}deg` }],
            }]}
          />
        );
      };
      return <>{edge(apex, bl, 'l')}{edge(apex, br, 'r')}{edge(bl, br, 'b')}</>;
    }
    case 'sq': {
      const d = s * 0.46;
      return (
        <View
          style={[
            styles.abs,
            {
              width: d,
              height: d,
              borderRadius: 2,
              backgroundColor: part.fill ? color : 'transparent',
              borderWidth: part.fill ? 0 : stroke,
              borderColor: color,
              transform: [{ rotate: `${part.angle}deg` }],
            },
          ]}
        />
      );
    }
    case 'arc': {
      const w = s * 0.62;
      const h = s * 0.36;
      const down = part.dir === 'down';
      return (
        <View
          style={[
            styles.abs,
            {
              width: w,
              height: h,
              borderColor: color,
              borderBottomWidth: down ? 0 : stroke,
              borderTopWidth: down ? stroke : 0,
              borderBottomLeftRadius: down ? 0 : w,
              borderBottomRightRadius: down ? 0 : w,
              borderTopLeftRadius: down ? w : 0,
              borderTopRightRadius: down ? w : 0,
            },
          ]}
        />
      );
    }
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
});
