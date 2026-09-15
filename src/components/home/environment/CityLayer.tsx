import { memo, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { artBox, sceneFrame } from './sceneGeometry';

const CITY_SOURCE = require('../../../../assets/home-city-b.png') as number;

interface CityLayerProps {
  width: number;
  height: number;
}

/**
 * CITY — painted skyline and palms (assets/home-city-b.png, transparent,
 * 1254 x 1570).
 *
 * Registered with home-sky.png: same size, same origin, laid out by the same
 * `artBox`, so at rest it composites directly over the sky at 0,0 with its
 * bottom row on the horizon.
 *
 * ── SKIA SWAP POINT ───────────────────────────────────────────────────────
 * To switch back to the procedural Skia city, replace the returned <View> with:
 *     <CitySkiaLayer width={width} height={height} />
 * imported from './CitySkiaLayer'. HomeEnvironment owns the transforms, so the
 * animation code is untouched.
 * ──────────────────────────────────────────────────────────────────────────
 */
export const CityLayer = memo(function CityLayer({ width, height }: CityLayerProps) {
  const box = useMemo(() => artBox(sceneFrame(width, height)), [width, height]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={CITY_SOURCE}
        resizeMode="cover"
        style={[styles.art, { left: box.x, top: box.y, width: box.w, height: box.h }]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  art: {
    position: 'absolute',
  },
});
