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
import { homeAlpha, homeV2 } from '@/theme/homeV2';

interface HomePlayButtonProps {
  onPress: () => void;
  disabled?: boolean;
  capHeight: number;
}

const CAP_WIDTH = 236;
const PRESS_MS = 90;
const SWEEP_MS = 700;
const SWEEP_GAP_MS = 4500;

/**
 * Physical arcade PLAY button: yellow cap, dark skirt, 4pt press, specular
 * sweep. Never labelled CONTINUE. The only major glow on Home.
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
    transform: [{ translateY: press.get() * 4 }],
  }));

  const skirtStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: press.get() * 2 },
      { scaleY: 1 - press.get() * 0.22 },
    ],
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    opacity: disabled ? 0 : 0.55,
    transform: [{ translateX: -CAP_WIDTH * 0.6 + sweep.get() * CAP_WIDTH * 1.4 }, { rotate: '18deg' }],
  }));

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
      <View style={[styles.glow, disabled && styles.glowOff, { height: capHeight + 18 }]}>
        <Animated.View style={[styles.skirt, { height: capHeight * 0.42 }, skirtStyle]} />
        <Animated.View
          style={[
            styles.cap,
            { height: capHeight, borderRadius: capHeight / 2 },
            disabled && styles.capDisabled,
            capStyle,
          ]}
        >
          <View style={styles.capSheen} />
          {disabled ? null : <Animated.View pointerEvents="none" style={[styles.sweep, sweepStyle]} />}
          <Text style={[styles.label, disabled && styles.labelDisabled]}>PLAY</Text>
        </Animated.View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  glow: {
    width: CAP_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-start',
    shadowColor: homeV2.yellow,
    shadowOpacity: 0.65,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  glowOff: {
    shadowOpacity: 0,
    elevation: 0,
  },
  skirt: {
    position: 'absolute',
    bottom: 2,
    width: CAP_WIDTH - 8,
    borderRadius: 18,
    backgroundColor: homeV2.playSkirt,
  },
  cap: {
    width: CAP_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: homeV2.yellow,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: homeAlpha(homeV2.white, 0.35),
  },
  capDisabled: {
    backgroundColor: homeAlpha(homeV2.yellow, 0.45),
  },
  capSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: homeAlpha(homeV2.white, 0.22),
  },
  sweep: {
    position: 'absolute',
    width: 46,
    height: '160%',
    backgroundColor: homeAlpha(homeV2.white, 0.55),
  },
  label: {
    color: homeV2.navy,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 3,
  },
  labelDisabled: {
    color: homeAlpha(homeV2.navy, 0.45),
  },
});
