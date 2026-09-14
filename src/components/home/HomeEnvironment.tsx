import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CityLayer, FloorLayer, FxLayer, SkyLayer } from './environment';

interface HomeEnvironmentProps {
  width: number;
  height: number;
  /** Consumed by the motion pass: screen focused and app foregrounded. */
  active: boolean;
  /** Consumed by the motion pass: drop to a static scene when true. */
  reducedMotion: boolean;
}

/**
 * PIXEL ARCADIA HOME SCENE — neon skyline at dusk over a perspective grid.
 *
 * Four separately rendered layers, back to front: sky, city, floor, fx. Each
 * sits in its own full-bleed View so it can be transformed and faded on its
 * own; the layers themselves are static Skia pictures and never redraw for
 * motion.
 */
export const HomeEnvironment = memo(function HomeEnvironment({ width, height }: HomeEnvironmentProps) {
  return (
    <View pointerEvents="none" style={styles.clip}>
      <View style={StyleSheet.absoluteFill}>
        <SkyLayer width={width} height={height} />
      </View>
      <View style={StyleSheet.absoluteFill}>
        <CityLayer width={width} height={height} />
      </View>
      <View style={StyleSheet.absoluteFill}>
        <FloorLayer width={width} height={height} />
      </View>
      <View style={StyleSheet.absoluteFill}>
        <FxLayer width={width} height={height} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  clip: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
});
