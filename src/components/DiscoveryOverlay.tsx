import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { PlayButton } from '@/components/PlayButton';
import { feedback } from '@/game/feedback';
import { revealTimeline, type CelebrationTier, type RevealSource } from '@/game/rendering/revealGeometry';
import { GP, GP_DISPLAY_FONT, GP_TYPE, gpAlpha } from '@/theme/gameplayUi';

interface DiscoveryOverlayProps {
  name: string;
  source: RevealSource;
  levelId: number;
  worldTitle: string;
  tier: CelebrationTier;
  hasNext: boolean;
  earnedCoins?: number;
  progress: SharedValue<number>;
  reducedMotion: boolean;
  onNext: () => void;
  onHome: () => void;
}

/**
 * The lower third of the Win / Discovery screen (UI-R6 — Pixel Arcadia
 * "restoration" language, Cosmic Arcade's "star chart" removed). The
 * discovery name resolves in, a real world/level line replaces the old fake
 * "REWARD PENDING" placeholder, then NEXT — same tactile family as Home
 * PLAY, with the idle-glow treatment reserved for capstones/finale. NEXT is
 * pressable well before the decorative tail finishes and never blocked by
 * animation, at any tier. No card.
 */
export function DiscoveryOverlay({
  name, source, levelId, worldTitle, tier, hasNext, earnedCoins, progress, reducedMotion, onNext, onHome,
}: DiscoveryOverlayProps) {
  const tl = revealTimeline(reducedMotion, tier);
  const [nextReady, setNextReady] = useState(false);

  const markResolved = useCallback(() => {
    // Capstone/finale reuse the existing heavier bloom (`capstoneWin`, reserved
    // for exactly this in UI-R1) rather than a new haptic event.
    feedback.emit(tier === 'normal' ? 'discoveryResolve' : 'capstoneWin');
    feedback.emit('reward');
  }, [tier]);

  useAnimatedReaction(
    () => progress.value * tl.tailMs,
    (elapsed, prev) => {
      if (elapsed >= tl.nextInteractiveMs && (prev === null || prev < tl.nextInteractiveMs)) {
        runOnJS(setNextReady)(true);
      }
      if (elapsed >= tl.titleEndMs && (prev === null || prev < tl.titleEndMs)) {
        runOnJS(markResolved)();
      }
    },
    [tl.nextInteractiveMs, tl.titleEndMs, markResolved],
  );

  // The panel rises into the space the controls just left, once the artwork
  // has been restored — never over the picture.
  const panelStyle = useAnimatedStyle(() => {
    const e = progress.value * tl.tailMs;
    const p = interpolate(e, [tl.settleMs - 80, tl.settleMs + 220], [0, 1], 'clamp');
    return { opacity: p, transform: [{ translateY: reducedMotion ? 0 : (1 - p) * 24 }] };
  });

  const titleStyle = useAnimatedStyle(() => {
    const e = progress.value * tl.tailMs;
    const p = interpolate(e, [tl.titleMs, tl.titleEndMs], [0, 1], 'clamp');
    return { opacity: p, transform: [{ translateY: (1 - p) * 10 }] };
  });

  const nextStyle = useAnimatedStyle(() => {
    const e = progress.value * tl.tailMs;
    return { opacity: interpolate(e, [tl.nextVisibleMs, tl.nextVisibleMs + 200], [0, 1], 'clamp') };
  });

  const infoStyle = useAnimatedStyle(() => {
    const e = progress.value * tl.tailMs;
    return { opacity: interpolate(e, [tl.titleEndMs, tl.titleEndMs + 240], [0, 0.85], 'clamp') };
  });

  const handleNext = useCallback(() => {
    feedback.emit('nextPress');
    onNext();
  }, [onNext]);

  const kicker = tier === 'finale' ? 'CAMPAIGN FINALE'
    : tier === 'capstone' ? 'WORLD COMPLETE'
      : source === 'authored' ? 'DISCOVERY' : 'RESTORED';

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[styles.scrim, panelStyle]} pointerEvents="none" />

      <Animated.View style={[styles.panel, panelStyle]}>
        <View pointerEvents="none" style={styles.panelEdge} />
        <Animated.View style={[styles.titleWrap, titleStyle]} pointerEvents="none">
          <View style={styles.kickerRow}>
            <View style={styles.goldPip} />
            <Text style={[styles.kicker, tier === 'finale' && styles.kickerFinale]}>{kicker}</Text>
            <View style={styles.goldPip} />
          </View>
          <Text style={styles.name}>{name}</Text>
        </Animated.View>

        <Animated.View style={[styles.infoChip, infoStyle]} pointerEvents="none">
          <Text style={styles.infoText}>{worldTitle.toUpperCase()} · LEVEL {levelId}</Text>
        </Animated.View>

        {earnedCoins && earnedCoins > 0 ? (
          <Animated.View style={[styles.rewardChip, infoStyle]} pointerEvents="none">
            <View style={styles.goldPip} />
            <Text style={styles.rewardText}>FIRST CLEAR · +{earnedCoins} COINS</Text>
          </Animated.View>
        ) : null}

        <Animated.View style={nextStyle}>
          <PlayButton
            label={hasNext ? 'NEXT' : 'BACK TO HOME'}
            onPress={hasNext ? handleNext : onHome}
            onPressIn={() => feedback.emit('select')}
            disabled={!nextReady}
            idleGlow={nextReady && tier !== 'normal'}
          />
        </Animated.View>

        <Pressable onPress={onHome} hitSlop={12} accessibilityRole="button">
          <Text style={styles.home}>Home</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: 20,
    paddingTop: 12,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: gpAlpha(GP.canvas, 0.5),
  },
  panel: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 20,
    backgroundColor: gpAlpha(GP.canvas, 0.96),
    borderTopWidth: 1,
    borderTopColor: GP.hairline,
  },
  panelEdge: {
    position: 'absolute',
    top: -1,
    left: 24,
    right: 24,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: GP.gold,
    opacity: 0.8,
  },
  titleWrap: { alignItems: 'center', gap: 6 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goldPip: {
    width: 5,
    height: 5,
    borderRadius: 1,
    backgroundColor: GP.gold,
  },
  kicker: { ...GP_TYPE.label, color: GP.cyan, letterSpacing: 4 },
  kickerFinale: { color: GP.gold },
  name: {
    color: GP.text,
    fontFamily: GP_DISPLAY_FONT,
    fontSize: 22,
    letterSpacing: 2,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  infoChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: GP.hairlineStrong,
    backgroundColor: GP.panel,
  },
  infoText: { ...GP_TYPE.label, color: GP.textSecondary, letterSpacing: 1.5 },
  rewardChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: GP.gold,
    backgroundColor: GP.wellDeep,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rewardText: {
    ...GP_TYPE.label,
    color: GP.gold,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
  },
  home: { ...GP_TYPE.body, color: GP.textMuted, fontSize: 13, letterSpacing: 1, paddingTop: 2 },
});
