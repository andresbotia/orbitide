import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';

import { PixelPalFace } from '@/game/rendering/pixelPal/PixelPalFace';
import { NEON, neonAlpha } from '@/theme/neon';

/** TUNABLE — how long the card takes to fade out once gameplay is ready. */
const FADE_MS = 200;
/**
 * TUNABLE — the shortest time the card is allowed to be on screen. This is a
 * flicker guard, not a wait: readiness is what dismisses the card, and on a
 * fast mount this is the only thing the player waits for.
 */
export const LEVEL_INTRO_MIN_MS = 180;

interface LevelIntroProps {
  levelId: number;
  title: string;
  /** Gameplay is mounted, measured, and has painted its first full frame. */
  ready: boolean;
  reducedMotion: boolean;
  /** Called once the card has finished fading out and can be unmounted. */
  onDone: () => void;
}

/**
 * The card shown between Home and gameplay.
 *
 * It exists because `GameScreen` cannot render its board until layout has
 * resolved `boardBox`, so the first committed frame is the HUD and control deck
 * over an empty board area — the deck visibly landing ~a second before the
 * board. Rather than animate that away, the card covers the mount entirely and
 * lifts only when the board has actually painted.
 *
 * Deliberately cheap: plain views and text, one opacity/scale animation driven
 * on the UI thread, no Skia canvas, no blur, no particles. The Pal is the same
 * component the deck already renders, with its blink worklet off.
 */
export const LevelIntro = memo(function LevelIntro({
  levelId, title, ready, reducedMotion, onDone,
}: LevelIntroProps) {
  const fade = useSharedValue(1);

  useEffect(() => {
    if (!ready) return;
    // `ready` cannot flip before the minimum, so this timer is the whole of the
    // flicker guard; there is no fixed delay anywhere else in the path.
    fade.set(withTiming(0, {
      duration: reducedMotion ? 90 : FADE_MS,
      easing: Easing.out(Easing.quad),
    }, (finished) => {
      if (finished) runOnJS(onDone)();
    }));
  }, [ready, reducedMotion, fade, onDone]);

  const style = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: reducedMotion ? 1 : 1 + (1 - fade.value) * 0.04 }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, style]} pointerEvents="none">
      <View style={styles.card}>
        <Text style={styles.eyebrow}>LEVEL {levelId}</Text>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <View style={styles.rule} />
        <PixelPalFace color="cyan" size={44} mood="focused" animate={false} />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: {
    backgroundColor: NEON.inkDeep,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  eyebrow: {
    color: NEON.gold,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
  },
  title: {
    color: NEON.cyanPale,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  rule: {
    width: 56,
    height: 2,
    borderRadius: 1,
    marginTop: 2,
    marginBottom: 6,
    backgroundColor: neonAlpha(NEON.cyan, 0.55),
  },
});
