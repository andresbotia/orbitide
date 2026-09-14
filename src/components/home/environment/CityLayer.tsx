import { memo, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { NEON } from '@/theme/neon';

import { artBox, sceneFrame } from './sceneGeometry';

const CITY_SOURCE = require('../../../../assets/home-city-b.png') as number;

/** Dark strip below the skyline; see the footing note in the render. */
const FOOTING_HEIGHT = 16;

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
      {/* Footing under the skyline. The city tilts further than the sky, so
          without this the buildings would lift off the horizon and show the
          sky's bottom band beneath them. */}
      <View style={[styles.footing, { top: box.y + box.h }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  art: {
    position: 'absolute',
  },
  footing: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: FOOTING_HEIGHT,
    backgroundColor: NEON.inkDeep,
  },
});
