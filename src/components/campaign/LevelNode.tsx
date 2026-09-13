import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { LevelSlotState } from '@/game/levels/campaignProgress';
import { material } from '@/theme/material';
import { radius } from '@/theme/spacing';

interface LevelNodeProps {
  levelId: number;
  /** Position within the world (1-based), shown instead of the raw campaign id. */
  positionInWorld: number;
  state: LevelSlotState;
  accent: string;
  size: number;
  /** The last level of a world (10/20/.../100) — presentation only, same gameplay. */
  isCapstone?: boolean;
  /** Level 100 specifically — the strongest treatment in the whole campaign. */
  isFinale?: boolean;
  onPress: () => void;
}

/**
 * One level-select node (UI-R5 restyle): a docking socket, lit
 * with the world's accent when current, filled + checked when complete,
 * dimmed and inert when locked. Capstones (every world's 10th level) get a
 * second outer ring + a small seal glyph; Level 100 uses warm Pixel Arcadia
 * energy instead of its world's own accent so it reads as the campaign
 * finale, not just another capstone. Mirrors the Tunnel/Holding hardware
 * bevel language so the whole campaign screen reads as one machine.
 */
export function LevelNode({ levelId, positionInWorld, state, accent, size, isCapstone, isFinale, onPress }: LevelNodeProps) {
  const locked = state === 'locked';
  const current = state === 'current';
  const complete = state === 'complete';
  const reducedMotion = useReducedMotion();
  const glowColor = isFinale ? material.energyWarm : accent;

  const breathe = useSharedValue(0.4);
  useEffect(() => {
    cancelAnimation(breathe);
    if (!current || reducedMotion) { breathe.set(0.4); return; }
    const duration = isCapstone ? 1500 : 2100;
    breathe.set(withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(breathe);
  }, [current, reducedMotion, isCapstone, breathe]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: current ? 0.3 + breathe.value * 0.5 : 0 }));

  const a11yLabel = locked
    ? `Level ${positionInWorld}, locked`
    : current
      ? `Level ${positionInWorld}, current level${isFinale ? ', campaign finale' : isCapstone ? ', capstone' : ''}`
      : `Level ${positionInWorld}, complete. Tap to replay.`;

  return (
    <View style={{ width: size, height: size }}>
      {isCapstone ? (
        <View
          pointerEvents="none"
          style={[
            styles.capstoneRing,
            { borderColor: locked ? material.outline : glowColor, opacity: locked ? 0.3 : isFinale ? 0.55 : 0.4 },
          ]}
        />
      ) : null}
      {current ? <Animated.View pointerEvents="none" style={[styles.currentGlow, { borderColor: glowColor }, ringStyle]} /> : null}

      <Pressable
        onPress={onPress}
        disabled={locked}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={{ disabled: locked, selected: current }}
        hitSlop={4}
        style={({ pressed }) => [
          styles.node,
          { width: size, height: size, borderRadius: isCapstone ? radius.lg : radius.md },
          locked && styles.locked,
          current && { borderColor: glowColor, backgroundColor: material.raisedSurface },
          complete && { backgroundColor: `${accent}26` },
          isFinale && !locked && styles.finale,
          pressed && !locked && styles.pressed,
        ]}
      >
        {isCapstone ? (
          <View style={[styles.seal, { borderColor: locked ? material.textSecondary : glowColor }]} />
        ) : null}
        <Text
          style={[
            styles.number,
            isCapstone && styles.numberCapstone,
            current && { color: glowColor },
            locked && styles.numberLocked,
          ]}
        >
          {positionInWorld}
        </Text>
        {complete ? <Text style={[styles.check, { color: accent }]}>✓</Text> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  node: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderTopColor: material.bevelHighlight,
    borderLeftColor: material.bevelHighlight,
    borderRightColor: material.bevelShadow,
    borderBottomColor: material.bevelShadow,
    backgroundColor: material.structuralSurface,
  },
  finale: {
    shadowColor: material.energyWarm,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  locked: { opacity: 0.4 },
  pressed: { transform: [{ translateY: 1 }, { scale: 0.96 }] },
  capstoneRing: {
    position: 'absolute',
    top: -5, left: -5, right: -5, bottom: -5,
    borderRadius: radius.lg + 5,
    borderWidth: 1.5,
  },
  currentGlow: {
    position: 'absolute',
    top: -8, left: -8, right: -8, bottom: -8,
    borderRadius: 999,
    borderWidth: 2,
  },
  seal: {
    position: 'absolute',
    top: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  number: { fontSize: 17, fontWeight: '700', color: material.textSecondary },
  numberCapstone: { fontSize: 20, fontWeight: '800' },
  numberLocked: { color: material.textSecondary },
  check: { position: 'absolute', bottom: 3, fontSize: 10, fontWeight: '800' },
});
