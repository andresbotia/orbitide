import { memo, useEffect } from 'react';
import { type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { brandMotion } from '@/theme/brand';
import { PixelCore } from './PixelCore';

interface CorePulseProps {
  size?: number;
  /** Optional soft warm glow behind the core. */
  glow?: boolean;
  style?: ViewStyle;
}

/**
 * The pixel-core breathing pulse — the single approved loading motif. Pure
 * token-driven (no asset dependency) so it can render before anything downloads.
 * Under reduce-motion it holds as a static core at full opacity.
 */
export const CorePulse = memo(function CorePulse({ size = 24, glow = false, style }: CorePulseProps) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      t.set(1);
      return;
    }
    t.set(
      withRepeat(
        withTiming(1, { duration: brandMotion.corePulse.durationMs, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(t);
  }, [reduced, t]);

  const animated = useAnimatedStyle(() => ({
    opacity: 0.55 + t.value * 0.45,
    transform: [{ scale: 1 + t.value * 0.045 }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, style, animated]}>
      {glow ? (
        <Animated.View
          style={{
            position: 'absolute',
            left: -size * 0.5,
            top: -size * 0.5,
            width: size * 2,
            height: size * 2,
            borderRadius: size,
            backgroundColor: '#FFB24D',
            opacity: 0.16,
          }}
        />
      ) : null}
      <PixelCore size={size} />
    </Animated.View>
  );
});
