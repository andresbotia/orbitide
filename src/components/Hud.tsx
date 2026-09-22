import { memo, useEffect, type ReactNode } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';

import { flash, usePressDepth } from '@/components/gameplay/motionKit';
import { HomeGlyph, RestartGlyph } from '@/components/gameplay/glyphs';
import { GAMEPLAY } from '@/theme/gameplayLayout';
import { GP, GP_DISPLAY_FONT, GP_RADIUS, GP_TYPE } from '@/theme/gameplayUi';

interface HudProps {
  levelId: number;
  /** Presented cleared pixels / total — the only values the HUD re-renders on. */
  cleared: number;
  total: number;
  coins?: number;
  onRestart: () => void;
  onHome: () => void;
}

const BTN = GAMEPLAY.hudButton;
const TRACK_BORDER = 1;
const HIT = GAMEPLAY.hudButtonHit;
const TRACK_H = 8;

/**
 * Compact arcade status bar: level chip, coin chip, board progress, Home + Restart.
 * ACTIVE/HOLDING pressure lives in the deck's status strip, directly above the
 * controls that change it. Only `ProgressBar` re-renders per presented clear;
 * the chip and buttons are memoized on stable props.
 */
export const Hud = memo(function Hud({ levelId, cleared, total, coins, onRestart, onHome }: HudProps) {
  const progress = total === 0 ? 0 : cleared / total;
  return (
    <View style={styles.container}>
      <LevelChip levelId={levelId} />
      {coins !== undefined ? <CoinChip coins={coins} /> : null}
      <ProgressBar progress={progress} />
      <View style={styles.actions}>
        <HudButton onPress={onHome} accessibilityLabel="Home"><HomeGlyph /></HudButton>
        <HudButton onPress={onRestart} accessibilityLabel="Restart level"><RestartGlyph /></HudButton>
      </View>
    </View>
  );
});

const CoinChip = memo(function CoinChip({ coins }: { coins: number }) {
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={`${coins} coins`} style={styles.coinChip}>
      <View style={styles.coinPip} />
      <Text style={styles.coinNum}>{coins}</Text>
    </View>
  );
});

const LevelChip = memo(function LevelChip({ levelId }: { levelId: number }) {
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={`Level ${levelId}`} style={styles.chip}>
      <Text style={styles.chipLabel}>LV</Text>
      <Text style={styles.chipNum}>{levelId}</Text>
    </View>
  );
});

const HudButton = memo(function HudButton({ onPress, accessibilityLabel, children }: {
  onPress: () => void; accessibilityLabel: string; children: ReactNode;
}) {
  const { depth, pressIn, pressOut } = usePressDepth();
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - depth.value * 0.08 }],
    borderColor: interpolateColor(depth.value, [0, 1], [GP.hairlineStrong, GP.cyan]),
    backgroundColor: interpolateColor(depth.value, [0, 1], [GP.panel, GP.well]),
  }));
  const slop = Math.max(0, Math.ceil((HIT - BTN) / 2));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={slop}
    >
      <Animated.View style={[styles.btn, style]}>{children}</Animated.View>
    </Pressable>
  );
});

/**
 * Board progress. Compositor-only: a full-width fill slid left by
 * (1 - progress), clipped by the track (animating `width` re-ran layout on
 * every clear). Each advance flashes the leading edge; completion turns the
 * fill gold — the HUD's half of the win beat.
 */
const ProgressBar = memo(function ProgressBar({ progress }: { progress: number }) {
  const reducedMotion = useReducedMotion();
  const fill = useSharedValue(progress);
  const trackW = useSharedValue(0);
  const edge = useSharedValue(0);
  const done = useSharedValue(progress >= 1 ? 1 : 0);
  useEffect(() => {
    fill.set(withTiming(progress, { duration: reducedMotion ? 0 : 220, easing: Easing.out(Easing.quad) }));
    if (progress > 0 && !reducedMotion) flash(edge, 40, 240);
    done.set(withTiming(progress >= 1 ? 1 : 0, { duration: progress >= 1 ? 320 : 0 }));
  }, [progress, reducedMotion, fill, edge, done]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: trackW.value > 0 ? 1 : 0,
    backgroundColor: interpolateColor(done.value, [0, 1], [GP.cyan, GP.gold]),
    transform: [{ translateX: (fill.value - 1) * trackW.value }],
  }));
  const edgeStyle = useAnimatedStyle(() => ({ opacity: 0.55 + edge.value * 0.45 }));
  const onTrackLayout = (e: LayoutChangeEvent) => trackW.set(Math.max(0, e.nativeEvent.layout.width - TRACK_BORDER * 2));
  const pct = Math.floor(progress * 100);

  return (
    <View style={styles.progressBlock} accessible accessibilityRole="progressbar" accessibilityLabel={`Board ${pct} percent cleared`}>
      <View style={styles.track} onLayout={onTrackLayout}>
        <Animated.View style={[styles.fill, fillStyle]}>
          <Animated.View style={[styles.fillEdge, edgeStyle]} />
        </Animated.View>
      </View>
      <Text style={[styles.pct, progress >= 1 && styles.pctDone]}>{pct}%</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: GAMEPLAY.hudHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
    backgroundColor: GP.canvas,
  },
  chip: {
    height: 30,
    minWidth: 52,
    paddingHorizontal: 8,
    borderRadius: GP_RADIUS.control,
    backgroundColor: GP.panel,
    borderWidth: 1,
    borderColor: GP.hairlineStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  chipLabel: { ...GP_TYPE.label, fontSize: 9, color: GP.gold, marginTop: 1 },
  chipNum: {
    color: GP.text,
    fontFamily: GP_DISPLAY_FONT,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  coinChip: {
    height: 30,
    minWidth: 48,
    paddingHorizontal: 7,
    borderRadius: GP_RADIUS.control,
    backgroundColor: GP.panel,
    borderWidth: 1,
    borderColor: GP.hairlineStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  coinPip: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: GP.gold,
    transform: [{ rotate: '45deg' }],
  },
  coinNum: {
    color: GP.text,
    fontFamily: GP_DISPLAY_FONT,
    fontSize: 14,
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
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: GP.wellDeep,
    overflow: 'hidden',
    borderWidth: TRACK_BORDER,
    borderColor: GP.hairline,
  },
  fill: {
    width: '100%',
    height: '100%',
    borderRadius: TRACK_H / 2,
  },
  fillEdge: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  pct: {
    ...GP_TYPE.numeral,
    fontSize: 12,
    color: GP.textSecondary,
    minWidth: 38,
    textAlign: 'right',
  },
  pctDone: { color: GP.gold },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    width: BTN,
    height: BTN,
    borderRadius: GP_RADIUS.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
