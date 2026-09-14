import { Pressable, StyleSheet, Text, View } from 'react-native';

import { remainingPixelCount } from '@/game/engine/pixels';
import type { GameState, LevelDifficulty } from '@/game/engine/types';
import { homeAlpha, homeV2 } from '@/theme/homeV2';

interface HudProps {
  state: GameState;
  title?: string;
  difficulty?: LevelDifficulty;
  onRestart: () => void;
  /** Placeholder for M2's settings screen — presentation-only in M2A. */
  onSettings?: () => void;
}

/**
 * Compact gameplay header: level medallion, progress, restart.
 * Level name and difficulty stay on Home — they are not repeated here.
 */
export function Hud({
  state, onRestart,
}: HudProps) {
  const remaining = remainingPixelCount(state);
  const total = state.pixels.length;
  const cleared = total - remaining;
  const progress = total === 0 ? 0 : cleared / total;

  return (
    <View style={styles.container}>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={`Level ${state.levelId}`}
        style={styles.medallion}
      >
        <Text style={styles.medallionNum}>{state.levelId}</Text>
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={styles.progressNum}>{cleared}/{total}</Text>
      </View>

      <Pressable
        onPress={onRestart}
        accessibilityRole="button"
        accessibilityLabel="Restart level"
        hitSlop={10}
        style={({ pressed }) => [styles.restart, pressed && styles.restartPressed]}
      >
        <Text style={styles.restartGlyph}>↺</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  medallion: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: homeV2.navy,
    borderWidth: 1.5,
    borderColor: homeAlpha(homeV2.cyan, 0.55),
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionNum: {
    color: homeV2.white,
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  progressBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: homeV2.navy,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: homeV2.cyan },
  progressNum: {
    color: homeAlpha(homeV2.white, 0.7),
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 44,
    textAlign: 'right',
  },
  restart: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restartPressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  restartGlyph: { color: homeAlpha(homeV2.white, 0.55), fontSize: 20, fontWeight: '700' },
});
