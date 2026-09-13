import { StyleSheet, Text, View } from 'react-native';

import type { LevelDifficulty } from '@/game/engine/types';
import { DifficultyGate } from '@/components/difficulty/DifficultyGate';
import { material } from '@/theme/material';
import { typography } from '@/theme/spacing';

interface LevelBadgeProps {
  levelId: number;
  difficulty: LevelDifficulty;
  /** Current world identity — omitted only if campaign data is somehow missing. */
  worldDisplayIndex?: number;
  worldTitle?: string;
  /** `worldSkin(themeId).accent` — environment hint on the eyebrow only. */
  worldAccent?: string;
}

/**
 * WORLD N / TITLE eyebrow (UI-R2 addition — real current-campaign data, no
 * hardcoded example values) + LEVEL N + the production compact Difficulty
 * Gate. Readable but secondary to the centerpiece and PLAY — Home hierarchy
 * is unchanged.
 */
export function LevelBadge({ levelId, difficulty, worldDisplayIndex, worldTitle, worldAccent }: LevelBadgeProps) {
  return (
    <View style={styles.wrap}>
      {worldTitle ? (
        <Text style={[styles.world, worldAccent ? { color: worldAccent } : null]} numberOfLines={1}>
          WORLD {String(worldDisplayIndex ?? '').padStart(2, '0')} · {worldTitle.toUpperCase()}
        </Text>
      ) : null}
      <View style={styles.levelRow}>
        <Text style={styles.kicker}>LEVEL</Text>
        <Text style={styles.number}>{levelId}</Text>
      </View>
      <DifficultyGate difficulty={difficulty} variant="badge" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 3 },
  world: { ...typography.metadata, color: material.textSecondary, letterSpacing: 2, marginBottom: 2 },
  levelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  kicker: { ...typography.label, color: material.textSecondary, fontSize: 10 },
  number: { ...typography.numeric, color: material.textPrimary, fontSize: 40, lineHeight: 44 },
});
