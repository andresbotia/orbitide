import { StyleSheet, Text, View } from 'react-native';

import type { LevelDifficulty } from '@/game/engine/types';
import { DifficultyGate } from '@/components/difficulty/DifficultyGate';
import { arcade } from '@/theme/arcade';
import { palette } from '@/theme/colors';
import { typography } from '@/theme/spacing';

interface LevelBadgeProps {
  levelId: number;
  difficulty: LevelDifficulty;
}

/**
 * LEVEL N + the production compact Difficulty Gate. Readable but secondary to
 * the centerpiece and PLAY — Home hierarchy is unchanged.
 */
export function LevelBadge({ levelId, difficulty }: LevelBadgeProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>LEVEL</Text>
      <Text style={styles.number}>{levelId}</Text>
      <DifficultyGate difficulty={difficulty} variant="badge" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 3 },
  kicker: { ...typography.label, color: arcade.metalEdge, fontSize: 10 },
  number: { ...typography.numeric, color: palette.textPrimary, fontSize: 40, lineHeight: 44 },
});
