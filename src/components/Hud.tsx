import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getActiveColor, getRemainingCount } from '@/game/engine/selectors';
import type { GameState } from '@/game/engine/types';
import { orbColors, orbLabel, palette } from '@/theme/colors';
import { radius, spacing, typography } from '@/theme/spacing';

interface HudProps {
  state: GameState;
  onRestart: () => void;
}

export function Hud({ state, onRestart }: HudProps) {
  const activeColor = getActiveColor(state);
  const remaining = getRemainingCount(state);
  const targetsLeft = state.targets.length - state.activeTargetIndex;

  return (
    <View style={styles.container}>
      <View style={styles.side}>
        <Text style={styles.label}>LEVEL</Text>
        <Text style={styles.value}>{state.levelId}</Text>
      </View>

      <View style={styles.center}>
        <Text style={styles.label}>CORE NEEDS</Text>
        <View style={styles.coreRow}>
          {activeColor ? (
            <View
              style={[styles.swatch, { backgroundColor: orbColors[activeColor] }]}
            />
          ) : null}
          <Text style={styles.coreText}>
            {activeColor ? orbLabel[activeColor] : 'ALIGNED'}
          </Text>
          {activeColor ? (
            <Text style={styles.count}>×{remaining}</Text>
          ) : null}
        </View>
        <Text style={styles.sub}>
          {targetsLeft > 0 ? `${targetsLeft} target${targetsLeft > 1 ? 's' : ''} left` : 'sequence complete'}
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
  side: { width: 56, alignItems: 'flex-start' },
  center: { flex: 1, alignItems: 'center', gap: 2 },
  label: { ...typography.label, color: palette.textFaint, fontSize: 11 },
  value: { ...typography.title, color: palette.textPrimary },
  coreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 16, height: 16, borderRadius: 8 },
  coreText: {
    ...typography.body,
    color: palette.textPrimary,
    letterSpacing: 2,
    fontWeight: '700',
  },
  count: { ...typography.body, color: palette.textSecondary, fontWeight: '700' },
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
