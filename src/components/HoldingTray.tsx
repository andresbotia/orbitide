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
import { useEffect } from 'react';

import type { Orb } from '@/game/engine/types';
import { orbColors, orbGlow, palette } from '@/theme/colors';
import { radius, spacing, typography } from '@/theme/spacing';

interface HoldingTrayProps {
  holding: Orb[];
  capacity: number;
  /** Tray is full and the level is lost — flash the slots. */
  overflow: boolean;
}

export function HoldingTray({ holding, capacity, overflow }: HoldingTrayProps) {
  const shake = useSharedValue(0);

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
      <Text style={styles.label}>HOLDING</Text>
      <Animated.View style={[styles.row, shakeStyle]}>
        {slots.map((orb, index) => (
          <View
            key={orb?.id ?? `empty-${index}`}
            style={[
              styles.slot,
              overflow && styles.slotOverflow,
            ]}
          >
            {orb ? (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(180)}
                layout={LinearTransition.duration(200)}
                style={[
                  styles.orb,
                  {
                    backgroundColor: orbColors[orb.color],
                    borderColor: orbGlow[orb.color],
                  },
                ]}
              />
            ) : null}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const SLOT = 40;

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm },
  label: {
    ...typography.label,
    color: palette.textFaint,
  },
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
    borderColor: palette.danger,
    backgroundColor: 'rgba(255,92,122,0.16)',
  },
  orb: {
    width: SLOT - 12,
    height: SLOT - 12,
    borderRadius: (SLOT - 12) / 2,
    borderWidth: 1.5,
  },
});
