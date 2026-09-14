import { Canvas, LinearGradient, Path, vec } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { NEON, neonAlpha } from '@/theme/neon';

import { gridColumnsPath, gridRowsPath, sceneFrame } from './sceneGeometry';

interface FloorLayerProps {
  width: number;
  height: number;
}

/**
 * FLOOR — a true perspective grid converging on the sun.
 *
 * Rows sit on a pure geometric series from the horizon (see GRID_RATIO), so the
 * motion pass loops the floor by scaling this whole layer about the vanishing
 * point instead of translating it — the only way the lines accelerate toward
 * the viewer. Lines fade to nothing at the horizon, which sells distance and
 * hides the sub-pixel rows.
 *
 * Transparent everywhere but the lines; the dark floor itself is painted by
 * SkyLayer, so two floor copies can cross-fade without doubling a base fill.
 *
 * ── PNG SWAP POINT ────────────────────────────────────────────────────────
 * To replace this layer with a pre-rendered raster, swap the whole <Canvas>
 * below for:
 *     <Image source={require('../../../../assets/home/floor.png')}
 *            resizeMode="cover" style={StyleSheet.absoluteFill} />
 * The raster must keep the horizon at HORIZON_RATIO and its rows on the same
 * GRID_RATIO series, or the scale loop will visibly jump.
 * ──────────────────────────────────────────────────────────────────────────
 */
export const FloorLayer = memo(function FloorLayer({ width, height }: FloorLayerProps) {
  const frame = useMemo(() => sceneFrame(width, height), [width, height]);
  const rows = useMemo(() => gridRowsPath(frame), [frame]);
  const columns = useMemo(() => gridColumnsPath(frame), [frame]);
  const start = vec(0, frame.horizon);
  const end = vec(0, height);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path path={columns} style="stroke" strokeWidth={1.25}>
        <LinearGradient
          start={start}
          end={end}
          colors={[neonAlpha(NEON.cyan, 0), neonAlpha(NEON.cyan, 0.3), neonAlpha(NEON.cyan, 0.7)]}
          positions={[0, 0.3, 1]}
        />
      </Path>
      <Path path={rows} style="stroke" strokeWidth={1.5}>
        <LinearGradient
          start={start}
          end={end}
          colors={[neonAlpha(NEON.cyan, 0), neonAlpha(NEON.cyan, 0.4), NEON.cyan]}
          positions={[0, 0.3, 1]}
        />
      </Path>
    </Canvas>
  );
});
