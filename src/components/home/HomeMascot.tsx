import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { PixelPalFace } from '@/game/rendering/pixelPal/PixelPalFace';

interface HomeMascotProps {
  size: number;
  /** App foregrounded and Home focused — the bob stops otherwise. */
  active: boolean;
  reducedMotion: boolean;
}

/** v2 "What animates": Home mascot 2pt idle bob, 3s period, and nothing else. */
const BOB_PT = 2;
const BOB_PERIOD_MS = 3000;

/** Podium footprint on the 128pt reference mascot. */
const PODIUM_W = 160;
const PODIUM_H = 30;

/** Total footprint for a given mascot size (the podium hangs below the feet). */
export function mascotMetrics(size: number): { width: number; height: number } {
  const scale = size / 128;
  return { width: Math.max(size, PODIUM_W * scale), height: size + PODIUM_H * scale * 0.5 };
}

/**
 * M7A — the white Pixel Pal standing on a soft glass podium ring. The only
 * ambient motion on Home is this 2pt bob; Reduce Motion (or an inactive
 * screen) holds it still. No blink loop, no charm beats, no pulse.
 */
export const HomeMascot = memo(function HomeMascot({ size, active, reducedMotion }: HomeMascotProps) {
  const scale = size / 128;
  const podiumW = PODIUM_W * scale;
  const podiumH = PODIUM_H * scale;
  const { width, height } = mascotMetrics(size);

  const bob = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(bob);
    bob.set(0);
    if (!active || reducedMotion) return;
    bob.set(withRepeat(withTiming(1, { duration: BOB_PERIOD_MS / 2, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(bob);
  }, [active, reducedMotion, bob]);
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -bob.value * BOB_PT }] }));

  return (
    <View
      style={{ width, height, alignItems: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.podiumShadow,
          {
            width: podiumW * 0.875,
            height: podiumH * 0.87,
            borderRadius: podiumW,
            top: size - podiumH * 0.3,
          },
        ]}
      />
      <View
        style={[
          styles.podium,
          {
            width: podiumW,
            height: podiumH,
            borderRadius: podiumW,
            top: size - podiumH * 0.5,
          },
        ]}
      />
      <Animated.View style={bobStyle}>
        <PixelPalFace color="white" size={size} mood="happy" animate={false} />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  podiumShadow: {
    position: 'absolute',
    backgroundColor: 'rgba(20,50,140,0.28)',
  },
  podium: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
