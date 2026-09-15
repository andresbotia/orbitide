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
import { homeAlpha, homeV2 } from '@/theme/homeV2';
import { typography } from '@/theme/spacing';

interface DiscoveryOverlayProps {
  name: string;
  source: RevealSource;
  levelId: number;
  worldTitle: string;
  tier: CelebrationTier;
  hasNext: boolean;
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
  name, source, levelId, worldTitle, tier, hasNext, progress, reducedMotion, onNext, onHome,
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
      <View style={styles.scrim} pointerEvents="none" />

      <View style={styles.panel}>
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
      </View>
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
    backgroundColor: 'rgba(0, 23, 66, 0.45)',
  },
  panel: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 20,
    backgroundColor: homeAlpha(homeV2.deepNavy, 0.96),
    borderTopWidth: 1,
    borderTopColor: homeAlpha(homeV2.cyan, 0.28),
  },
  panelEdge: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: homeAlpha(homeV2.cyan, 0.7),
  },
  titleWrap: { alignItems: 'center', gap: 6 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goldPip: {
    width: 5,
    height: 5,
    borderRadius: 1,
    backgroundColor: homeV2.yellow,
  },
  kicker: { ...typography.label, color: homeV2.cyan, fontSize: 10, letterSpacing: 4 },
  kickerFinale: { color: homeV2.yellow },
  name: {
    ...typography.title,
    color: homeV2.white,
    fontSize: 22,
    letterSpacing: 3,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  infoChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: homeAlpha(homeV2.cyan, 0.4),
    backgroundColor: homeV2.navy,
  },
  infoText: { color: homeAlpha(homeV2.white, 0.78), fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
  home: { color: homeAlpha(homeV2.white, 0.55), fontSize: 13, letterSpacing: 1, paddingTop: 2 },
});
