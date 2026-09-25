import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AvPlayTriangle } from '@/components/v2/AvIcon';
import { feedback } from '@/game/feedback';
import { AV, AV_TYPE } from '@/theme/arcadiaV2';

interface HomePlayButtonProps {
  onPress: () => void;
  disabled?: boolean;
  width: number;
  height: number;
}

const PRESS_MS = 90;
/** Slimmer than the shared `AV_DEPTH.ctaLip` (6) so the CTA reads less toy-like. */
const LIP = 5;
/** Pressed: face seats 3pt into its lip, leaving 2pt showing. */
const PRESS_TRAVEL = 3;
/** Rounded but clearly not a pill at 58–66pt tall. */
const RADIUS = 18;
/** Label tracking; the label's trailing tracking is cancelled so the row centres. */
const TRACKING = 2;
const ARROW_W = 17;
const FACE = [AV.goldLight, AV.gold, AV.goldDeep] as const;
const FACE_STOPS = [0, 0.55, 1] as const;

/**
 * M7A — v2 gold PLAY CTA: radius 18, 5pt solid lip #D98500, a hairline top
 * light (no gloss pill), Rubik 900 label in amber ink with a matching play
 * arrow. The one amber CTA and the only Play action on Home. Press is the
 * only motion — no idle sweep, no glow loop.
 */
export const HomePlayButton = memo(function HomePlayButton({
  onPress,
  disabled = false,
  width,
  height,
}: HomePlayButtonProps) {
  const reducedMotion = useReducedMotion();
  const press = useSharedValue(0);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    press.set(withTiming(1, { duration: PRESS_MS, easing: Easing.out(Easing.cubic) }));
    feedback.emit('select');
  }, [disabled, press]);

  const handlePressOut = useCallback(() => {
    press.set(
      reducedMotion
        ? withTiming(0, { duration: PRESS_MS })
        : withSpring(0, { damping: 16, stiffness: 300 }),
    );
  }, [press, reducedMotion]);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: press.get() * PRESS_TRAVEL }],
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
      style={disabled ? styles.disabled : null}
    >
      <View style={[styles.lift, { width, height: height + LIP }]}>
        <View style={[styles.lip, { top: LIP, height }]} />
        <Animated.View style={[{ height }, faceStyle]}>
          <LinearGradient colors={FACE} locations={FACE_STOPS} style={[styles.face, { height }]}>
            <View style={styles.topLight} />
            <View style={styles.labelRow}>
              <Text style={styles.label}>PLAY</Text>
              <AvPlayTriangle width={ARROW_W} />
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  lift: {
    shadowColor: AV.goldLip,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 10 },
  },
  lip: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: RADIUS,
    backgroundColor: AV.goldLip,
  },
  face: {
    borderRadius: RADIUS,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topLight: {
    position: 'absolute',
    top: 0,
    left: RADIUS / 2,
    right: RADIUS / 2,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  label: {
    ...AV_TYPE.cta,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: TRACKING,
    marginRight: -TRACKING,
    includeFontPadding: false,
    textAlignVertical: 'center',
    color: AV.goldInk,
  },
  disabled: { opacity: 0.55 },
});
