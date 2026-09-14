import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { LevelDifficulty } from '@/game/engine/types';
import { NEON, neonAlpha } from '@/theme/neon';

interface HomeLevelCardProps {
  levelId: number;
  title: string;
  difficulty: LevelDifficulty;
  medallionSize: number;
}

const DIFFICULTY_LABEL: Record<LevelDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  'super-hard': 'Super Hard',
  extreme: 'Extreme',
};

/**
 * Difficulty dot. NEON has no purple, so the top three tiers share magenta and
 * the label beside the dot carries the distinction (colour is never the only
 * signal).
 */
const DIFFICULTY_DOT: Record<LevelDifficulty, string> = {
  easy: NEON.cyan,
  medium: NEON.gold,
  hard: NEON.magenta,
  'super-hard': NEON.magenta,
  extreme: NEON.magenta,
};

/**
 * Medallion fill, specified directly by the design: a lifted navy with no NEON
 * token. Kept as one named constant rather than widening the palette.
 */
const MEDALLION_FILL = 'rgba(7,32,56,0.85)';

/** Level medallion + title + compact difficulty. No board preview. */
export const HomeLevelCard = memo(function HomeLevelCard({
  levelId,
  title,
  difficulty,
  medallionSize,
}: HomeLevelCardProps) {
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.medallion,
          { width: medallionSize, height: medallionSize, borderRadius: medallionSize / 2 },
        ]}
        accessibilityLabel={`Level ${levelId}`}
      >
        <Text style={styles.number} numberOfLines={1}>
          {levelId}
        </Text>
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <View
        style={styles.diffRow}
        accessibilityLabel={`Difficulty: ${DIFFICULTY_LABEL[difficulty]}`}
      >
        <View style={[styles.dot, { backgroundColor: DIFFICULTY_DOT[difficulty] }]} />
        <Text style={styles.diff}>{DIFFICULTY_LABEL[difficulty]}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 6,
  },
  medallion: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: NEON.cyan,
    backgroundColor: MEDALLION_FILL,
  },
  number: {
    color: NEON.cyanPale,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 32,
  },
  title: {
    color: NEON.cyanPale,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
    maxWidth: 280,
    textAlign: 'center',
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  diff: {
    color: neonAlpha(NEON.cyanPale, 0.7),
    fontSize: 13,
    fontWeight: '500',
  },
});
