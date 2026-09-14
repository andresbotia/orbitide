import { memo, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { artBox, sceneFrame } from './sceneGeometry';

const SKY_SOURCE = require('../../../../assets/home-sky.png') as number;

interface SkyLayerProps {
  width: number;
  height: number;
}

/**
 * SKY — painted dusk sky and sun (assets/home-sky.png, opaque, 1254 x 1570).
 *
 * Registered with home-city-b.png: same size, same origin, composited directly
 * over this at 0,0. Both are laid out by `artBox` — full layer width at the
 * art's own aspect, bottom edge on the horizon. At that aspect "cover" crops
 * nothing, so the horizon lands exactly on the floor grid and the painted sun
 * on the grid's vanishing point (VANISH_X_RATIO) on every device height.
 *
 * ── SKIA SWAP POINT ───────────────────────────────────────────────────────
 * To switch back to the procedural Skia sky, replace the returned <View> with:
 *     <SkySkiaLayer width={width} height={height} />
 * imported from './SkySkiaLayer'. HomeEnvironment owns the transforms, so the
 * animation code is untouched.
 * ──────────────────────────────────────────────────────────────────────────
 */
export const SkyLayer = memo(function SkyLayer({ width, height }: SkyLayerProps) {
  const box = useMemo(() => artBox(sceneFrame(width, height)), [width, height]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={SKY_SOURCE}
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
