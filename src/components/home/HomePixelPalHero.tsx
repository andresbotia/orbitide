import { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  ZoomIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { PixelPalFace } from '@/game/rendering/pixelPal/PixelPalFace';
import type { HomeLayout } from '@/game/rendering/homeGeometry';

interface HomePixelPalHeroProps {
  layout: HomeLayout;
  active: boolean;
  reducedMotion: boolean;
  /** 0 idle, ramps to 1 on PLAY press — the hero gives a small excited nod. */
  activation: SharedValue<number>;
}

/**
 * NORTH-STAR PHASE 2 — the Home hero moment: PIXEL ARCADIA's mascot standing
 * in front of the level-preview portal, not just decorative chrome around it.
 * A living idle loop (slow hover + a barely-there head tilt; blink comes free
 * from `PixelPalVisor`), an entrance on mount, and a small excited nod the
 * instant PLAY is pressed (driven by the same `activation` shared value
 * `HomeCenterpiece` already reacts to, so both respond to one press, not two
 * disconnected animations). Uses the shared 'white' Pal — the same body the
 * app icon wears — as Home's one ownable "hero" identity, distinct from the
 * 15 gameplay colours.
 */
export const HomePixelPalHero = memo(function HomePixelPalHero({ layout, active, reducedMotion, activation }: HomePixelPalHeroProps) {
  const { center, machineRadius: R } = layout;
  const size = Math.min(R * 0.85, 104);

  const hover = useSharedValue(0);
  const tilt = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(hover);
    cancelAnimation(tilt);
    if (!active || reducedMotion) { hover.set(0); tilt.set(0); return; }
    hover.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true));
    // A slow, barely-there tilt — deliberately not synced to the hover period,
    // so the two combine into something that reads as alive, not mechanical.
    tilt.set(withDelay(400, withRepeat(withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.sin) }), -1, true)));
    return () => { cancelAnimation(hover); cancelAnimation(tilt); };
  }, [active, reducedMotion, hover, tilt]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -hover.value * 5 - activation.value * 3 },
      { rotate: `${(tilt.value - 0.5) * 4 - activation.value * 6}deg` },
      { scale: 1 + activation.value * 0.06 },
    ],
  }));

  // Position: standing just above the portal window, overlapping its top
  // edge slightly (feet behind the rim) so it reads as "in front of," not
  // "floating near." Clamped so it can never climb into the wordmark's
  // space on the smallest supported band heights — `computeHomeLayout`'s
  // `center`/`machineRadius` shrink together, but the wordmark above this
  // container (`HomeScreen`'s `spacing.md`-anchored stack) does not.
  const left = center.x - size / 2;
  const top = Math.max(60, center.y - R - size * 0.62);

  return (
    <Animated.View
      pointerEvents="none"
      entering={reducedMotion ? undefined : ZoomIn.duration(520).delay(120).springify().damping(12).mass(0.7)}
      style={[styles.wrap, { left, top, width: size, height: size }, style]}
    >
      <PixelPalFace color="white" size={size} mood="happy" />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
});
