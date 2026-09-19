import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';

import { PixelPalFace } from '@/game/rendering/pixelPal/PixelPalFace';
import { GP, GP_DISPLAY_FONT, GP_TYPE, gpAlpha } from '@/theme/gameplayUi';

/** TUNABLE — how long the card takes to fade out once gameplay is ready. */
const FADE_MS = 200;
/** TUNABLE — content entrance (rise + fade) on the already-opaque field. */
const ENTER_MS = 160;
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
 * The card shown between Home (or the previous level's NEXT) and gameplay.
 *
 * It exists because `GameScreen` cannot render its board until layout has
 * resolved `boardBox`, so the first committed frame is the HUD and control deck
 * over an empty board area. The navy field is opaque from the first frame —
 * the board can never be seen assembling — and lifts only when the board has
 * actually painted. Only the content animates in (rise + fade, inside the
 * minimum on-screen time), so the intro never adds a wait.
 *
 * Deliberately cheap: plain views and text, UI-thread opacity/transform only,
 * no Skia canvas, no blur, no particles.
 */
export const LevelIntro = memo(function LevelIntro({
  levelId, title, ready, reducedMotion, onDone,
}: LevelIntroProps) {
  const fade = useSharedValue(1);
  const enter = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (!reducedMotion) enter.set(withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) }));
  }, [enter, reducedMotion]);

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

  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - enter.value) * 8 - (1 - fade.value) * 6 }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]} pointerEvents="none">
      <Animated.View style={[styles.card, cardStyle]}>
        <Text style={styles.eyebrow}>LEVEL {levelId}</Text>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <View style={styles.rule} />
        <PixelPalFace color="cyan" size={44} mood="focused" animate={false} />
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: {
    backgroundColor: GP.canvas,
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
    ...GP_TYPE.label,
    fontSize: 13,
    color: GP.gold,
    letterSpacing: 3,
  },
  title: {
    color: GP.text,
    fontFamily: GP_DISPLAY_FONT,
    fontSize: 28,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  rule: {
    width: 56,
    height: 2,
    borderRadius: 1,
    marginTop: 2,
    marginBottom: 6,
    backgroundColor: gpAlpha(GP.cyan, 0.55),
  },
});
