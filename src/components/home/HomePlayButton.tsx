import { memo, useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { feedback } from '@/game/feedback';
import { NEON, neonAlpha } from '@/theme/neon';

interface HomePlayButtonProps {
  onPress: () => void;
  disabled?: boolean;
  capHeight: number;
}

const CAP_WIDTH = 236;
const PRESS_MS = 90;
const SWEEP_MS = 700;
const SWEEP_GAP_MS = 4500;
/** How far the bezel shows below the cap at rest. */
const BEZEL_DROP = 8;
/** Cap travel on press: seats into the bezel, leaving a 2px lip. */
const PRESS_TRAVEL = 6;
/**
 * Bezel colour, specified by the design. Darker than NEON.goldDeep so the cap
 * reads as raised; local because NEON exports exactly its eight tokens.
 */
const BEZEL = '#B8860B';

/**
 * Physical arcade PLAY button: gold cap over a darker bezel, 6pt press that
 * seats the cap, specular sweep. Never labelled CONTINUE. The only major glow
 * on Home.
 */
export const HomePlayButton = memo(function HomePlayButton({
  onPress,
  disabled = false,
  capHeight,
}: HomePlayButtonProps) {
  const reducedMotion = useReducedMotion();
  const press = useSharedValue(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(sweep);
    sweep.set(0);
    if (disabled || reducedMotion) return;
    sweep.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
          withDelay(SWEEP_GAP_MS - SWEEP_MS, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(sweep);
  }, [disabled, reducedMotion, sweep]);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    press.set(withTiming(1, { duration: PRESS_MS, easing: Easing.out(Easing.cubic) }));
    feedback.emit('select');
  }, [disabled, press]);

  const handlePressOut = useCallback(() => {
    press.set(
      reducedMotion
        ? withTiming(0, { duration: PRESS_MS })
        : withSpring(0, { damping: 14, stiffness: 260 }),
    );
  }, [press, reducedMotion]);

  const capStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: press.get() * PRESS_TRAVEL }],
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    opacity: disabled ? 0 : 0.55,
    transform: [{ translateX: -CAP_WIDTH * 0.6 + sweep.get() * CAP_WIDTH * 1.4 }, { rotate: '18deg' }],
  }));

  const radius = capHeight / 2;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={8}
      pressRetentionOffset={16}
      accessibilityRole="button"
      accessibilityLabel="Play"
      accessibilityState={{ disabled }}
    >
      <View style={[styles.glow, disabled && styles.glowOff, { height: capHeight + BEZEL_DROP }]}>
        <View
          style={[
            styles.bezel,
            { top: BEZEL_DROP, height: capHeight, borderRadius: radius },
            disabled && styles.bezelDisabled,
          ]}
        />
        <Animated.View
          style={[
            styles.cap,
            { height: capHeight, borderRadius: radius },
            disabled && styles.capDisabled,
            capStyle,
          ]}
        >
          <View style={styles.capSheen} />
          {disabled ? null : <Animated.View pointerEvents="none" style={[styles.sweep, sweepStyle]} />}
          <View style={styles.labelRow}>
            <Text style={[styles.label, disabled && styles.labelDisabled]}>PLAY</Text>
            {/* U+FE0E forces text presentation so iOS never swaps in the emoji. */}
            <Text style={[styles.glyph, disabled && styles.labelDisabled]}>{'▶︎'}</Text>
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  glow: {
    width: CAP_WIDTH,
    shadowColor: NEON.gold,
    shadowOpacity: 0.65,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  glowOff: {
    shadowOpacity: 0,
  },
  bezel: {
    position: 'absolute',
    left: 0,
    width: CAP_WIDTH,
    backgroundColor: BEZEL,
  },
  bezelDisabled: {
    opacity: 0.45,
  },
  cap: {
    width: CAP_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NEON.gold,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: neonAlpha(NEON.cyanPale, 0.35),
  },
  capDisabled: {
    backgroundColor: neonAlpha(NEON.gold, 0.45),
  },
  capSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: neonAlpha(NEON.cyanPale, 0.14),
  },
  sweep: {
    position: 'absolute',
    width: 46,
    height: '160%',
    backgroundColor: neonAlpha(NEON.cyanPale, 0.55),
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    color: NEON.ink,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 3,
  },
  glyph: {
    color: NEON.ink,
    fontSize: 18,
  },
  labelDisabled: {
    color: neonAlpha(NEON.ink, 0.45),
  },
});
