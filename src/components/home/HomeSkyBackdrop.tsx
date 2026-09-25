import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AV } from '@/theme/arcadiaV2';

/** Reference frame the v2 Home was drawn on. */
const REF_W = 390;
const REF_H = 844;

const SKY = [AV.skyTop, AV.skyMid, AV.horizon, AV.floorGlow] as const;
const SKY_STOPS = [0, 0.38, 0.62, 1] as const;

/** [left, top, size] on the reference frame. */
const STARS: readonly (readonly [number, number, number])[] = [
  [40, 70, 3], [300, 104, 2], [70, 210, 2], [340, 230, 3], [22, 300, 2], [360, 160, 2], [250, 250, 2],
];

/** [left, width, height] on the reference frame; bottoms sit on the horizon. */
const SKYLINE: readonly (readonly [number, number, number])[] = [
  [0, 44, 40], [40, 30, 64], [70, 36, 50], [106, 22, 80], [128, 30, 46],
  [232, 30, 52], [262, 22, 86], [284, 34, 58], [318, 26, 72], [344, 46, 44],
];

/**
 * M7A — v2 Home sky: open blue sky to a pale-cyan horizon, a few static
 * stars. Fully static — no loops, no parallax. The skyline is a separate
 * piece (`HomeSkyline`) so the screen can stand it on the mascot's horizon.
 */
export const HomeSkyBackdrop = memo(function HomeSkyBackdrop({ width, height }: { width: number; height: number }) {
  const sx = width / REF_W;
  const sy = height / REF_H;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={SKY} locations={SKY_STOPS} style={StyleSheet.absoluteFill} />
      {STARS.map(([l, t, s]) => (
        <View
          key={`${l}-${t}`}
          style={[styles.star, { left: l * sx, top: t * sy, width: s, height: s }]}
        />
      ))}
    </View>
  );
});

/**
 * Soft translucent skyline + horizon hairline. Anchored to the bottom of its
 * parent and spanning the full screen width. Static.
 */
export const HomeSkyline = memo(function HomeSkyline({ width }: { width: number }) {
  const sx = width / REF_W;
  return (
    <View pointerEvents="none" style={styles.skyline}>
      {SKYLINE.map(([l, w, h], i) => (
        <View
          key={l}
          style={[
            styles.building,
            {
              left: l * sx,
              width: w * sx,
              height: h,
              backgroundColor: i % 2 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.15)',
            },
          ]}
        />
      ))}
      <View style={styles.horizon} />
    </View>
  );
});

const styles = StyleSheet.create({
  star: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.7)' },
  skyline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 92 },
  building: {
    position: 'absolute',
    bottom: 2,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  horizon: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
});
