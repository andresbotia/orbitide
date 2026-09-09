import { StyleSheet, Text, View } from 'react-native';

import type { LevelDifficulty } from '@/game/engine/types';
import { difficultyMeta, MAX_DIFFICULTY_TIER } from '@/game/levels/difficulty';
import { accentColor, arcade } from '@/theme/arcade';
import { palette } from '@/theme/colors';
import { typography } from '@/theme/spacing';

interface LevelBadgeProps {
  levelId: number;
  difficulty: LevelDifficulty;
}

/**
 * LEVEL N + difficulty representation. The difficulty pips are the shared hook
 * the full Difficulty Gate intro will animate later; this is the clean
 * placeholder built on the final geometry, not a new system.
 */
export function LevelBadge({ levelId, difficulty }: LevelBadgeProps) {
  const meta = difficultyMeta(difficulty);
  const color = accentColor[meta.accent];

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>LEVEL</Text>
      <Text style={styles.number}>{levelId}</Text>
      <View style={styles.gate} accessibilityLabel={`Difficulty ${meta.label}`}>
        <View style={styles.pips}>
          {Array.from({ length: MAX_DIFFICULTY_TIER }, (_, i) => (
            <View
              key={i}
              style={[
                styles.pip,
                { backgroundColor: i < meta.tier ? color : arcade.metalLo },
                i < meta.tier && { shadowColor: color },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.diffLabel, { color }]}>{meta.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 2 },
  kicker: { ...typography.label, color: arcade.metalEdge, fontSize: 10 },
  number: { ...typography.numeric, color: palette.textPrimary, fontSize: 40, lineHeight: 44 },
  gate: { alignItems: 'center', gap: 4, marginTop: 2 },
  pips: { flexDirection: 'row', gap: 4 },
  pip: { width: 14, height: 4, borderRadius: 2 },
  diffLabel: { fontSize: 10, letterSpacing: 3, fontWeight: '700' },
});
