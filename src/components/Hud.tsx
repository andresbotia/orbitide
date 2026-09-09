import { Pressable, StyleSheet, Text, View } from 'react-native';

import { remainingPixelCount } from '@/game/engine/pixels';
import type { GameState, LevelDifficulty } from '@/game/engine/types';
import { DifficultyGate } from '@/components/difficulty/DifficultyGate';
import { arcade } from '@/theme/arcade';
import { palette } from '@/theme/colors';
import { typography } from '@/theme/spacing';

interface HudProps {
  state: GameState;
  title: string;
  difficulty: LevelDifficulty;
  onRestart: () => void;
  /** Placeholder for M2's settings screen — presentation-only in M2A. */
  onSettings?: () => void;
}

/**
 * Top HUD: settings / level identity + Difficulty Gate + progress / restart.
 * Painted-metal chips, restrained; the Gate rides the existing progress line so
 * HUD height does not grow. Coin balance stays deferred to the economy pass.
 */
export function Hud({ state, title, difficulty, onRestart, onSettings }: HudProps) {
  const remaining = remainingPixelCount(state);
  const total = state.pixels.length;
  const cleared = total - remaining;
  const progress = total === 0 ? 0 : cleared / total;

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        onPress={onSettings}
        disabled={!onSettings}
        accessibilityRole="button"
        accessibilityLabel="Settings (coming soon)"
        hitSlop={10}
      >
        <Text style={styles.icon}>⚙</Text>
      </Pressable>

      <View style={styles.center}>
        <Text style={styles.eyebrow}>
          LEVEL {state.levelId} · {title.toUpperCase()}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <View style={styles.subRow}>
          <DifficultyGate difficulty={difficulty} variant="hud" showLabel />
          <Text style={styles.sub}>· {cleared}/{total}</Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        onPress={onRestart}
        accessibilityRole="button"
        accessibilityLabel="Restart level"
        hitSlop={10}
      >
        <Text style={styles.icon}>↺</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderTopColor: arcade.metalHi,
    borderLeftColor: arcade.metalHi,
    borderRightColor: arcade.metalLo,
    borderBottomColor: arcade.metalLo,
    backgroundColor: arcade.metal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6, transform: [{ scale: 0.96 }] },
  icon: { color: palette.textSecondary, fontSize: 18 },
  center: { flex: 1, alignItems: 'center', gap: 5 },
  eyebrow: { ...typography.label, color: palette.textSecondary, fontSize: 11 },
  track: {
    width: '72%',
    height: 4,
    borderRadius: 2,
    backgroundColor: arcade.socket,
    overflow: 'hidden',
  },
  fill: { height: 4, borderRadius: 2, backgroundColor: arcade.accent },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 18 },
  sub: { fontSize: 10, color: arcade.metalEdge, letterSpacing: 1 },
});
