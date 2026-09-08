import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { Charge } from '@/game/engine/types';
import type { TrayCue } from '@/hooks/useGameSession';
import { orbColors, orbGlow, palette } from '@/theme/colors';
import { radius, spacing, typography } from '@/theme/spacing';

interface HoldingTrayProps {
  holding: Charge[];
  capacity: number;
  /** Tray is full and the level is lost — flash the slots. */
  overflow: boolean;
  /** Latest land/lift cue from the presentation player. */
  cue: TrayCue;
}

export function HoldingTray({ holding, capacity, overflow, cue }: HoldingTrayProps) {
  const shake = useSharedValue(0);
  const nearFull = holding.length >= capacity - 1 && !overflow;

  useEffect(() => {
    if (overflow) {
      shake.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 90 }),
          withTiming(-1, { duration: 90 }),
          withTiming(0, { duration: 90 }),
        ),
        2,
        false,
      );
    } else {
      shake.value = 0;
    }
  }, [overflow, shake]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value * 4 }],
  }));

  const slots = Array.from({ length: capacity }, (_, i) => holding[i] ?? null);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, nearFull && styles.labelWarn]}>
        HOLDING {holding.length}/{capacity}
      </Text>
      <Animated.View style={[styles.row, shakeStyle]}>
        {slots.map((charge, index) => (
          <Slot
            key={charge?.id ?? `empty-${index}`}
            charge={charge}
            index={index}
            overflow={overflow}
            cue={cue}
          />
        ))}
      </Animated.View>
    </View>
  );
}

function Slot({
  charge,
  index,
  overflow,
  cue,
}: {
  charge: Charge | null;
  index: number;
  overflow: boolean;
  cue: TrayCue;
}) {
  const react = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (cue.signal === 0 || cue.index !== index) return;
    if (cue.kind === 'land') {
      react.value = withSequence(
        withTiming(1, { duration: 90 }),
        withTiming(0, { duration: 220 }),
      );
    } else {
      glow.value = withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(0, { duration: 260 }),
      );
    }
  }, [cue, index, react, glow]);

  const slotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + react.value * 0.12 }],
    borderColor:
      glow.value > 0
        ? palette.coreGlow
        : overflow
          ? palette.danger
          : palette.surfaceBorder,
  }));

  return (
    <Animated.View
      style={[styles.slot, overflow && styles.slotOverflow, slotStyle]}
    >
      {charge ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(160)}
          layout={LinearTransition.duration(200)}
          style={[
            styles.charge,
            {
              backgroundColor: orbColors[charge.color],
              borderColor: orbGlow[charge.color],
            },
          ]}
        >
          <Text style={styles.capacity}>{charge.capacity}</Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const SLOT = 44;

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm },
  label: { ...typography.label, color: palette.textFaint },
  labelWarn: { color: palette.warning },
  row: { flexDirection: 'row', gap: spacing.md },
  slot: {
    width: SLOT,
    height: SLOT,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotOverflow: {
    backgroundColor: 'rgba(255,92,122,0.16)',
  },
  charge: {
    width: SLOT - 10,
    height: SLOT - 10,
    borderRadius: (SLOT - 10) / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capacity: { color: '#05060A', fontSize: 15, fontWeight: '800' },
});
