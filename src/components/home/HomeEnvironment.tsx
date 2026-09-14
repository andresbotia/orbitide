import { memo, useEffect, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const LOOP_SOURCE = require('../../../assets/reanimateloop.png') as number;
const LOOP_ASSET = Image.resolveAssetSource(LOOP_SOURCE);
const TILE = Math.max(LOOP_ASSET?.width ?? 1254, LOOP_ASSET?.height ?? 1254);
const CYCLE_MS = 25000;

interface HomeEnvironmentProps {
  width: number;
  height: number;
  active: boolean;
  reducedMotion: boolean;
}

/**
 * Seamless tiled Home background. One oversized repeating image, one linear
 * diagonal transform. Travel is exactly one tile so the loop restart is invisible.
 */
export const HomeEnvironment = memo(function HomeEnvironment({
  width,
  height,
  active,
  reducedMotion,
}: HomeEnvironmentProps) {
  const progress = useSharedValue(0);
  const layerW = width + TILE;
  const layerH = height + TILE;

  useEffect(() => {
    cancelAnimation(progress);
    if (!active || reducedMotion) {
      if (reducedMotion) progress.set(0);
      return;
    }
    progress.set(0);
    progress.set(
      withRepeat(withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [active, reducedMotion, progress]);

  const layerStyle = useAnimatedStyle(() => {
    const offset = progress.get() * -TILE;
    return { transform: [{ translateX: offset }, { translateY: offset }] };
  });

  const sizeStyle = useMemo(() => ({ width: layerW, height: layerH }), [layerW, layerH]);

  return (
    <View pointerEvents="none" style={styles.clip}>
      <Animated.Image
        source={LOOP_SOURCE}
        resizeMode="repeat"
        style={[styles.layer, sizeStyle, layerStyle]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  clip: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
