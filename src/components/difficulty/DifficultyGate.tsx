import { Blur, Canvas, Group, Path, RoundedRect, vec } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { LevelDifficulty } from '@/game/engine/types';
import {
  difficultyA11yLabel,
  gateGeometry,
  gateIntroTimeline,
  gatePrimitives,
  type GateAccent,
} from '@/game/levels/difficulty';
import { material } from '@/theme/material';

export type GateVariant = 'hud' | 'badge' | 'intro';

/** UI-R8 — migrated off `theme/arcade.ts`'s `accentColor`; same three tiers. */
const GATE_ACCENT: Record<GateAccent, string> = {
  accent: material.accentCyan,
  warn: material.warning,
  danger: material.danger,
};

interface DifficultyGateProps {
  difficulty: LevelDifficulty;
  variant?: GateVariant;
  /** Show the text label alongside the machined icon. */
  showLabel?: boolean;
  /** Play the restrained mount settle (intro variant). */
  animateIn?: boolean;
}

const ICON: Record<GateVariant, number> = { hud: 18, badge: 30, intro: 88 };
const LABEL_SIZE: Record<GateVariant, number> = { hud: 9, badge: 10, intro: 13 };

/**
 * The production Difficulty Gate — a machined frame whose geometry (frame shape,
 * mounting-block count, segmentation, outer guard, fracture) encodes the tier
 * before any colour does. One shared model (`gateGeometry` / `gatePrimitives`)
 * drives all three variants.
 */
export const DifficultyGate = memo(function DifficultyGate({
  difficulty,
  variant = 'badge',
  showLabel = variant !== 'hud',
  animateIn = false,
}: DifficultyGateProps) {
  const g = gateGeometry(difficulty);
  const size = ICON[variant];
  const prim = useMemo(() => gatePrimitives(difficulty, size), [difficulty, size]);
  const color = GATE_ACCENT[g.accent];

  const settle = useSharedValue(animateIn ? 0 : 1);
  useEffect(() => {
    if (!animateIn) return;
    cancelAnimation(settle);
    settle.set(0);
    settle.set(withTiming(1, {
      duration: gateIntroTimeline(difficulty).duration,
      easing: Easing.out(Easing.cubic),
    }));
    return () => cancelAnimation(settle);
  }, [animateIn, difficulty, settle]);

  const canvasTransform = useDerivedValue(() => [{ scale: 0.86 + settle.value * 0.14 }]);
  const canvasOpacity = useDerivedValue(() => 0.2 + settle.value * 0.8);

  const row = variant === 'badge' ? styles.badgeCol : styles.row;

  return (
    <View
      style={row}
      accessibilityRole="image"
      accessibilityLabel={difficultyA11yLabel(difficulty)}
    >
      <Canvas style={{ width: size, height: size }}>
        <Group origin={vec(size / 2, size / 2)} transform={canvasTransform} opacity={canvasOpacity}>
          {/* Inset glow. */}
          <Group opacity={0.4}>
            <Blur blur={2} />
            <Path path={prim.frame.path} style="stroke" strokeWidth={prim.strokeWidth * 2.3} color={color} />
          </Group>

          {prim.outerGuard ? (
            <Path path={prim.outerGuard.path} style="stroke" strokeWidth={prim.strokeWidth * 0.7} color={material.textSecondary} opacity={0.85} />
          ) : null}

          {/* Machined frame: structural body + a thin energy inlay. */}
          <Path path={prim.frame.path} style="stroke" strokeWidth={prim.strokeWidth} color={material.bevelHighlight} />
          <Path path={prim.frame.path} style="stroke" strokeWidth={Math.max(0.75, prim.strokeWidth * 0.4)} color={color} opacity={0.9} />

          {prim.segmentTicks.map((tick, i) => (
            <Path key={i} path={tick} style="stroke" strokeWidth={prim.strokeWidth * 0.8} color={material.bevelShadow} strokeCap="round" />
          ))}

          {prim.blocks.map((b, i) => (
            <Group key={i} origin={vec(b.x, b.y)} transform={[{ rotate: b.rot }]}>
              <RoundedRect x={b.x - b.w / 2} y={b.y - b.h / 2} width={b.w} height={b.h} r={1.5} color={material.raisedSurface} />
              <RoundedRect x={b.x - b.w / 2} y={b.y - b.h / 2} width={b.w} height={Math.max(1, b.h * 0.32)} r={1} color={color} opacity={0.85} />
            </Group>
          ))}

          {prim.fracture ? (
            <Group>
              <Blur blur={0.8} />
              <Path path={prim.fracture} style="stroke" strokeWidth={prim.strokeWidth * 0.95} color={color} strokeCap="round" />
            </Group>
          ) : null}
        </Group>
      </Canvas>

      {showLabel ? (
        <Text style={[styles.label, { fontSize: LABEL_SIZE[variant], color }]} numberOfLines={1}>
          {g.label}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeCol: { alignItems: 'center', gap: 3 },
  label: { letterSpacing: 2, fontWeight: '800', color: material.textSecondary },
});
