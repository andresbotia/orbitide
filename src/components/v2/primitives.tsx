import { Canvas, LinearGradient as SkLinearGradient, Path, vec } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { LevelDifficulty } from '@/game/engine/types';
import {
  AV, AV_TYPE, DIFFICULTY_LABEL, DIFFICULTY_PIP_COLOR, DIFFICULTY_PIPS, PIXEL_STEP_POLYGON,
} from '@/theme/arcadiaV2';

/**
 * M7A — shared v2 chrome primitives. All static: depth comes from solid lips
 * and soft lifts, never from glow or animation. Press feedback belongs to the
 * owning control.
 */

/** Gold coin medallion: rounded square, gold gradient, 2pt inner lip, glint. */
export const CoinMedallion = memo(function CoinMedallion({ size = 28 }: { size?: number }) {
  const radius = Math.round(size * 0.32);
  const glint = Math.round(size * 0.36);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <LinearGradient
        colors={[AV.goldLight, AV.gold]}
        style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
      >
        <View style={[styles.innerLip, { backgroundColor: AV.goldLip }]} />
      </LinearGradient>
      <View style={[styles.center, StyleSheet.absoluteFill]}>
        <View style={{ width: glint, height: glint, borderRadius: 2, backgroundColor: AV.goldGlint, marginTop: -1 }} />
      </View>
    </View>
  );
});

/** 4-pip difficulty meter + label. Colour is never the only signal: the label names it. */
export const DifficultyMeter = memo(function DifficultyMeter({
  difficulty,
  pipWidth = 14,
  pipHeight = 7,
  gap = 3,
  labelStyle,
  vertical = false,
  clipLabel = false,
}: {
  difficulty: LevelDifficulty;
  pipWidth?: number;
  pipHeight?: number;
  gap?: number;
  labelStyle?: StyleProp<TextStyle>;
  vertical?: boolean;
  /**
   * Never ellipsize the label. For content-sized hosts, where any shortfall is
   * sub-point pixel rounding — which `tail` turns into "Ea…" — not a real
   * lack of room.
   */
  clipLabel?: boolean;
}) {
  const filled = DIFFICULTY_PIPS[difficulty];
  const color = DIFFICULTY_PIP_COLOR[difficulty];
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Difficulty: ${DIFFICULTY_LABEL[difficulty]}`}
      style={vertical ? styles.meterColumn : styles.meterRow}
    >
      <View style={[styles.pips, { gap }]}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              width: pipWidth,
              height: pipHeight,
              borderRadius: 2,
              backgroundColor: i < filled ? color : 'rgba(23,48,110,0.16)',
            }}
          />
        ))}
      </View>
      <Text
        style={[styles.meterLabel, labelStyle]}
        numberOfLines={1}
        ellipsizeMode={clipLabel ? 'clip' : 'tail'}
      >
        {DIFFICULTY_LABEL[difficulty]}
      </Text>
    </View>
  );
});

/**
 * A raised surface: a solid lip block sitting `lip` pt below the face, plus an
 * optional soft lift. Static; a pressable owner animates its own press.
 */
export function LipSurface({
  width,
  height,
  radius,
  lip,
  lipColor,
  colors,
  locations,
  lift,
  style,
  faceStyle,
  children,
}: {
  width?: number;
  height: number;
  radius: number;
  lip: number;
  lipColor: string;
  colors: readonly [string, string, ...string[]];
  locations?: readonly [number, number, ...number[]];
  lift?: ViewStyle;
  style?: StyleProp<ViewStyle>;
  faceStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  return (
    <View style={[{ width, height: height + lip }, lift, style]}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: lip, height, borderRadius: radius, backgroundColor: lipColor }} />
      <LinearGradient
        colors={colors}
        locations={locations}
        style={[{ height, borderRadius: radius, overflow: 'hidden' }, faceStyle]}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

function stepPath(w: number, h: number, dy = 0): string {
  return PIXEL_STEP_POLYGON.map(([fx, fy], i) => `${i === 0 ? 'M' : 'L'} ${(fx * w).toFixed(2)} ${(fy * h + dy).toFixed(2)}`).join(' ') + ' Z';
}

export type BadgeTone = 'blue' | 'coral' | 'violet';

const BADGE_FACE: Record<BadgeTone, readonly [string, string, string]> = {
  blue: [AV.badgeTop, AV.badgeMid, AV.badgeBottom],
  coral: [AV.coral, '#EC4A70', AV.coralDeep],
  violet: [AV.purple, '#7352EE', AV.purpleDeep],
};
const BADGE_LIP: Record<BadgeTone, string> = {
  blue: AV.badgeLip,
  coral: '#A8264B',
  violet: '#3D2A99',
};

/**
 * Pixel-stepped square (6% steps) — the v2 signature shape. Face gradient with
 * a solid lip below and a 4pt gloss bar near the top. Static Skia.
 */
export const PixelStepBadge = memo(function PixelStepBadge({
  width,
  height,
  lip = 6,
  tone = 'blue',
  children,
}: {
  width: number;
  height: number;
  lip?: number;
  tone?: BadgeTone;
  children?: ReactNode;
}) {
  const face = BADGE_FACE[tone];
  return (
    <View style={[{ width, height: height + lip }, styles.badgeLift]}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path path={stepPath(width, height, lip)} color={BADGE_LIP[tone]} />
        <Path path={stepPath(width, height)}>
          <SkLinearGradient start={vec(0, 0)} end={vec(0, height)} colors={[...face]} positions={[0, 0.55, 1]} />
        </Path>
      </Canvas>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: width * 0.12, right: width * 0.12, top: 6, height: 4, backgroundColor: 'rgba(255,255,255,0.35)' }}
      />
      <View style={[styles.center, { position: 'absolute', left: 0, top: 0, width, height }]}>{children}</View>
    </View>
  );
});

/** Small caption in the Pixelify face (LEVEL, section tags). */
export function PixelCaption({ children, color = AV.iconSoft, size = 11 }: { children: string; color?: string; size?: number }) {
  return <Text style={[AV_TYPE.pixelCaption, { color, fontSize: size }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  innerLip: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2 },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meterColumn: { flexDirection: 'column', alignItems: 'flex-start', gap: 5 },
  pips: { flexDirection: 'row' },
  meterLabel: { ...AV_TYPE.value, fontSize: 13, color: AV.ink },
  badgeLift: {
    shadowColor: '#2349BE',
    shadowOpacity: 0.4,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 10 },
  },
});
