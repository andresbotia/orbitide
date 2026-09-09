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
import { revealTimeline, type RevealSource } from '@/game/rendering/revealGeometry';
import { arcade } from '@/theme/arcade';
import { palette } from '@/theme/colors';
import { typography } from '@/theme/spacing';

interface DiscoveryOverlayProps {
  name: string;
  source: RevealSource;
  hasNext: boolean;
  progress: SharedValue<number>;
  reducedMotion: boolean;
  onNext: () => void;
  onHome: () => void;
}

/**
 * The lower third of the Win / Discovery screen: the discovery name resolves in,
 * then NEXT — same tactile family as Home PLAY. NEXT is pressable well before the
 * decorative constellation tail finishes and never blocked by animation. No card.
 */
export function DiscoveryOverlay({
  name, source, hasNext, progress, reducedMotion, onNext, onHome,
}: DiscoveryOverlayProps) {
  const tl = revealTimeline(reducedMotion);
  const [nextReady, setNextReady] = useState(false);

  const markResolved = useCallback(() => {
    feedback.emit('discoveryResolve');
    feedback.emit('reward');
  }, []);

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
    [tl.nextInteractiveMs, tl.titleEndMs],
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

  const rewardStyle = useAnimatedStyle(() => {
    const e = progress.value * tl.tailMs;
    return { opacity: interpolate(e, [tl.titleEndMs, tl.titleEndMs + 240], [0, 0.7], 'clamp') };
  });

  const handleNext = useCallback(() => {
    feedback.emit('nextPress');
    onNext();
  }, [onNext]);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.scrim} pointerEvents="none" />

      <Animated.View style={[styles.titleWrap, titleStyle]} pointerEvents="none">
        <Text style={styles.kicker}>{source === 'authored' ? 'DISCOVERY' : 'STAR CHART'}</Text>
        <Text style={styles.name}>{name}</Text>
      </Animated.View>

      <Animated.View style={[styles.rewardChip, rewardStyle]} pointerEvents="none">
        <Text style={styles.rewardText}>◈ REWARD PENDING</Text>
      </Animated.View>

      <Animated.View style={nextStyle}>
        <PlayButton
          label={hasNext ? 'NEXT' : 'BACK TO HOME'}
          onPress={hasNext ? handleNext : onHome}
          onPressIn={() => feedback.emit('select')}
          disabled={!nextReady}
        />
      </Animated.View>

      <Pressable onPress={onHome} hitSlop={12} accessibilityRole="button">
        <Text style={styles.home}>Home</Text>
      </Pressable>
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
    paddingBottom: 28,
    paddingTop: 24,
    gap: 14,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4,6,14,0.82)',
  },
  titleWrap: { alignItems: 'center', gap: 4 },
  kicker: { ...typography.label, color: arcade.accent, fontSize: 10, letterSpacing: 4 },
  name: {
    ...typography.title,
    color: palette.textPrimary,
    fontSize: 22,
    letterSpacing: 3,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  rewardChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: arcade.metalLo,
    backgroundColor: arcade.metal,
  },
  rewardText: { color: arcade.metalEdge, fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  home: { color: arcade.metalEdge, fontSize: 13, letterSpacing: 1, paddingTop: 2 },
});
