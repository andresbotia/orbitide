import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { LevelDifficulty } from '@/game/engine/types';
import { homeAlpha, homeV2 } from '@/theme/homeV2';

interface HomeLevelCardProps {
  levelId: number;
  title: string;
  difficulty: LevelDifficulty;
  worldAccent: string;
  medallionSize: number;
}

const DIFFICULTY_LABEL: Record<LevelDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  'super-hard': 'Super Hard',
  extreme: 'Extreme',
};

const DIFFICULTY_DOT: Record<LevelDifficulty, string> = {
  easy: homeV2.cyan,
  medium: homeV2.yellow,
  hard: homeV2.red,
  'super-hard': homeV2.red,
  extreme: homeV2.purple,
};

/** Level medallion + title + compact difficulty. No board preview. */
export const HomeLevelCard = memo(function HomeLevelCard({
  levelId,
  title,
  difficulty,
  worldAccent,
  medallionSize,
}: HomeLevelCardProps) {
  const inner = medallionSize - 10;
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.medallion,
          {
            width: medallionSize,
            height: medallionSize,
            borderRadius: medallionSize / 2,
            borderColor: worldAccent,
          },
        ]}
        accessibilityLabel={`Level ${levelId}`}
      >
        <View
          style={[
            styles.medallionInner,
            {
              width: inner,
              height: inner,
              borderRadius: inner / 2,
            },
          ]}
        >
          <Text style={styles.number} numberOfLines={1}>
            {levelId}
          </Text>
        </View>
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
    backgroundColor: homeAlpha(homeV2.navy, 0.55),
  },
  medallionInner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: homeV2.navy,
  },
  number: {
    color: homeV2.white,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 32,
  },
  title: {
    color: homeV2.white,
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
    color: homeAlpha(homeV2.white, 0.7),
    fontSize: 13,
    fontWeight: '500',
  },
});
