import { StyleSheet, Text, View } from 'react-native';

import { remainingPixelCount } from '@/game/engine/pixels';
import type { GameState, LevelDifficulty } from '@/game/engine/types';
import { DifficultyGate } from '@/components/difficulty/DifficultyGate';
import { IconButton } from '@/components/IconButton';
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
      <IconButton glyph="⚙" onPress={onSettings} accessibilityLabel="Settings (coming soon)" />

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

      <IconButton glyph="↺" onPress={onRestart} accessibilityLabel="Restart level" />
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
