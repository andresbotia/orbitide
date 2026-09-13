import { StyleSheet, Text, View } from 'react-native';

import { remainingPixelCount } from '@/game/engine/pixels';
import type { GameState, LevelDifficulty } from '@/game/engine/types';
import { DifficultyGate } from '@/components/difficulty/DifficultyGate';
import { IconButton } from '@/components/IconButton';
import { material } from '@/theme/material';
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
 * Pixel Arcadia product chrome, restrained; the Gate rides the existing
 * progress line so HUD height does not grow.
 *
 * UI-R9 functional-UI cleanup: `onSettings` has never been supplied by
 * `GameScreen` — there's no production settings screen behind this gear.
 * Rather than show a dead, decoration-only control, it's hidden entirely
 * (a same-size spacer keeps Restart from shifting and the level title
 * centered). Passing `onSettings` in the future brings it back unchanged.
 */
export function Hud({ state, title, difficulty, onRestart, onSettings }: HudProps) {
  const remaining = remainingPixelCount(state);
  const total = state.pixels.length;
  const cleared = total - remaining;
  const progress = total === 0 ? 0 : cleared / total;

  return (
    <View style={styles.container}>
      {onSettings ? (
        <IconButton glyph="⚙" onPress={onSettings} accessibilityLabel="Settings" />
      ) : (
        <View style={styles.spacer} />
      )}

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
  spacer: { width: 40, height: 40 },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    gap: 12,
  },
  center: { flex: 1, alignItems: 'center', gap: 5 },
  eyebrow: { ...typography.label, color: material.textSecondary, fontSize: 11 },
  track: {
    width: '72%',
    height: 4,
    borderRadius: 2,
    backgroundColor: material.recessedSurface,
    overflow: 'hidden',
  },
  fill: { height: 4, borderRadius: 2, backgroundColor: material.accentCyan },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 18 },
  sub: { fontSize: 10, color: material.textSecondary, letterSpacing: 1 },
});
