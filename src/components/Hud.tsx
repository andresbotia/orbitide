import { Pressable, StyleSheet, Text, View } from 'react-native';

import { remainingPixelCount } from '@/game/engine/pixels';
import type { GameState } from '@/game/engine/types';
import { palette } from '@/theme/colors';
import { radius, spacing, typography } from '@/theme/spacing';

interface HudProps {
  state: GameState;
  title: string;
  onRestart: () => void;
}

export function Hud({ state, title, onRestart }: HudProps) {
  const remaining = remainingPixelCount(state);
  const total = state.pixels.length;
  const cleared = total - remaining;

  return (
    <View style={styles.container}>
      <View style={styles.side}>
        <Text style={styles.label}>LEVEL</Text>
        <Text style={styles.value}>{state.levelId}</Text>
      </View>

      <View style={styles.center}>
        <Text style={styles.objective}>CLEAR THE PICTURE</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>
          {cleared}/{total} pixels
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.restart, pressed && styles.restartPressed]}
        onPress={onRestart}
        accessibilityRole="button"
        accessibilityLabel="Restart level"
        hitSlop={10}
      >
        <Text style={styles.restartText}>↺</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  side: { width: 52, alignItems: 'flex-start' },
  center: { flex: 1, alignItems: 'center', gap: 1 },
  label: { ...typography.label, color: palette.textFaint, fontSize: 11 },
  value: { ...typography.title, color: palette.textPrimary },
  objective: { ...typography.label, color: palette.coreGlow, fontSize: 11 },
  title: {
    ...typography.body,
    color: palette.textPrimary,
    letterSpacing: 2,
    fontWeight: '700',
  },
  sub: { fontSize: 11, color: palette.textFaint, letterSpacing: 1 },
  restart: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restartPressed: { opacity: 0.6 },
  restartText: { color: palette.textSecondary, fontSize: 18, marginTop: -2 },
});
