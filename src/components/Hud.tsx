import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { remainingPixelCount } from '@/game/engine/pixels';
import type { GameState, LevelDifficulty } from '@/game/engine/types';
import { GAMEPLAY } from '@/theme/gameplayLayout';
import { NEON, neonAlpha } from '@/theme/neon';

interface HudProps {
  state: GameState;
  title?: string;
  difficulty?: LevelDifficulty;
  onRestart: () => void;
  onHome: () => void;
  /** Placeholder for M2's settings screen — presentation-only in M2A. */
  onSettings?: () => void;
}

const BTN = GAMEPLAY.hudButton;
const HIT = GAMEPLAY.hudButtonHit;

/**
 * Compact arcade HUD strip: level medallion, progress, Home + Restart.
 * Level name and difficulty stay on Home — they are not repeated here.
 * Memoized to prevent rerenders from unrelated board/deck changes.
 */
export const Hud = memo(function Hud({
  state, onRestart, onHome,
}: HudProps) {
  const remaining = remainingPixelCount(state);
  const total = state.pixels.length;
  const cleared = total - remaining;
  const progress = total === 0 ? 0 : cleared / total;
  const slop = Math.max(0, Math.ceil((HIT - BTN) / 2));

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

      <ProgressBar progress={progress} cleared={cleared} total={total} />

      <View style={styles.actions}>
        <Pressable
          onPress={onHome}
          accessibilityRole="button"
          accessibilityLabel="Home"
          hitSlop={slop}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        >
          <HouseGlyph />
        </Pressable>
        <Pressable
          onPress={onRestart}
          accessibilityRole="button"
          accessibilityLabel="Restart level"
          hitSlop={slop}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        >
          <Text style={styles.restartGlyph}>↺</Text>
        </Pressable>
      </View>
    </View>
  );
});

/** Memoized progress bar — only rerenders when cleared/total actually change. */
const ProgressBar = memo(function ProgressBar({ progress, cleared, total }: {
  progress: number; cleared: number; total: number;
}) {
  const width = useSharedValue(progress * 100);
  useEffect(() => {
    width.set(withTiming(progress * 100, { duration: 220, easing: Easing.out(Easing.quad) }));
  }, [progress, width]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View style={styles.progressBlock}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
        {progress >= 0.97 ? <View pointerEvents="none" style={styles.goldTip} /> : null}
      </View>
      <Text style={styles.progressNum}>{cleared}/{total}</Text>
    </View>
  );
});

function HouseGlyph() {
  return (
    <View style={styles.house} accessibilityElementsHidden>
      <View style={styles.houseRoof} />
      <View style={styles.houseBody} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: GAMEPLAY.hudHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
    backgroundColor: NEON.inkDeep,
  },
  medallion: {
    width: GAMEPLAY.hudMedallion,
    height: GAMEPLAY.hudMedallion,
    borderRadius: GAMEPLAY.hudMedallion / 2,
    backgroundColor: NEON.surface,
    borderWidth: 2,
    borderColor: NEON.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionNum: {
    color: NEON.cyanPale,
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  progressBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  track: {
    flex: 1,
    height: GAMEPLAY.hudProgressHeight,
    borderRadius: GAMEPLAY.hudProgressHeight / 2,
    backgroundColor: NEON.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: neonAlpha(NEON.cyan, 0.18),
  },
  fill: {
    height: '100%',
    borderRadius: GAMEPLAY.hudProgressHeight / 2,
    backgroundColor: NEON.cyan,
  },
  progressNum: {
    color: neonAlpha(NEON.cyanPale, 0.7),
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 42,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btn: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    backgroundColor: NEON.surface,
    borderWidth: 1.5,
    borderColor: neonAlpha(NEON.cyan, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldTip: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: NEON.gold,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.94 }],
    borderColor: NEON.cyan,
    backgroundColor: neonAlpha(NEON.cyan, 0.12),
  },
  restartGlyph: { color: neonAlpha(NEON.cyanPale, 0.85), fontSize: 18, fontWeight: '700' },
  house: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  houseRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: neonAlpha(NEON.cyanPale, 0.88),
    marginBottom: -1,
  },
  houseBody: {
    width: 10,
    height: 7,
    backgroundColor: neonAlpha(NEON.cyanPale, 0.88),
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
  },
});
