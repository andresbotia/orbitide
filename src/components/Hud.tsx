import { Pressable, StyleSheet, Text, View } from 'react-native';

import { remainingPixelCount } from '@/game/engine/pixels';
import type { GameState, LevelDifficulty } from '@/game/engine/types';
import { GAMEPLAY } from '@/theme/gameplayLayout';
import { homeAlpha, homeV2 } from '@/theme/homeV2';

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
 */
export function Hud({
  state, onRestart, onHome,
}: HudProps) {
  const remaining = remainingPixelCount(state);
  const total = state.pixels.length;
  const cleared = total - remaining;
  const progress = total === 0 ? 0 : cleared / total;
  const slop = Math.max(0, Math.ceil((HIT - BTN) / 2));

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.litEdge} />

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
          {progress >= 0.97 ? <View pointerEvents="none" style={styles.goldTip} /> : null}
        </View>
        <Text style={styles.progressNum}>{cleared}/{total}</Text>
      </View>

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
}

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
    paddingHorizontal: 12,
    gap: 10,
    backgroundColor: homeAlpha(homeV2.deepNavy, 0.94),
  },
  litEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: homeAlpha(homeV2.cyan, 0.45),
  },
  medallion: {
    width: GAMEPLAY.hudMedallion,
    height: GAMEPLAY.hudMedallion,
    borderRadius: 10,
    backgroundColor: homeV2.navy,
    borderWidth: 1.5,
    borderColor: homeV2.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionNum: {
    color: homeV2.white,
    fontSize: 16,
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
    height: GAMEPLAY.hudProgressHeight,
    borderRadius: GAMEPLAY.hudProgressHeight / 2,
    backgroundColor: homeV2.navy,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: homeAlpha(homeV2.cyan, 0.22),
  },
  fill: {
    height: '100%',
    borderRadius: GAMEPLAY.hudProgressHeight / 2,
    backgroundColor: homeV2.cyan,
  },
  progressNum: {
    color: homeAlpha(homeV2.white, 0.78),
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 48,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    width: BTN,
    height: BTN,
    borderRadius: 11,
    backgroundColor: homeV2.navy,
    borderWidth: 1.5,
    borderColor: homeAlpha(homeV2.cyan, 0.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldTip: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: homeV2.yellow,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.94 }],
    borderColor: homeV2.cyan,
    backgroundColor: homeAlpha(homeV2.cyan, 0.12),
  },
  restartGlyph: { color: homeAlpha(homeV2.white, 0.85), fontSize: 20, fontWeight: '700' },
  house: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  houseRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: homeAlpha(homeV2.white, 0.88),
    marginBottom: -1,
  },
  houseBody: {
    width: 11,
    height: 8,
    backgroundColor: homeAlpha(homeV2.white, 0.88),
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
  },
});
