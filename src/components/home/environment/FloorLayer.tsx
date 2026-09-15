import { Canvas, Group, LinearGradient, Path, Rect, vec } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { NEON, neonAlpha } from '@/theme/neon';

import {
  GRID_COLUMNS,
  gridColumnBase,
  gridRowOffsets,
  sceneFrame,
  type SceneFrame,
} from './sceneGeometry';

interface FloorLayerProps {
  width: number;
  height: number;
}

/**
 * Row thickness at the near edge. Thickness is proportional to distance from
 * the horizon, so scaling the layer by GRID_RATIO maps each row exactly onto the
 * next row's thickness and the loop stays seamless.
 */
const NEAR_ROW_PX = 3;
const MIN_ROW_PX = 0.4;
/** Row opacity at the near edge, falling with depth to ~0 at the horizon. */
const NEAR_ROW_ALPHA = 0.9;
const ROW_FALLOFF = 1.1;
/** Half-width of a column where it meets the near edge; columns taper to a point at the vanishing point. */
const NEAR_COLUMN_HALF_PX = 1.6;

/**
 * FLOOR — a true perspective grid converging on the sun.
 *
 * Value structure reads as a receding plane: rows and columns are thickest and
 * brightest at the viewer's edge and fade to near-zero at the horizon. Rows sit
 * on a pure geometric series from the horizon (see GRID_RATIO), so the motion
 * pass loops the floor by scaling this layer about the vanishing point instead
 * of translating it — the only way the lines accelerate toward the viewer.
 *
 * Transparent everywhere but the lines, so two floor copies can cross-fade
 * without doubling a base fill.
 *
 * ── PNG SWAP POINT ────────────────────────────────────────────────────────
 * To replace this layer with a pre-rendered raster, swap the whole <Canvas>
 * below for:
 *     <Image source={require('../../../../assets/home/floor.png')}
 *            resizeMode="cover" style={StyleSheet.absoluteFill} />
 * The raster must keep the horizon at HORIZON_RATIO, the vanishing point at
 * VANISH_X_RATIO, and its rows on the same GRID_RATIO series, or the scale loop
 * will visibly jump.
 * ──────────────────────────────────────────────────────────────────────────
 */
export const FloorLayer = memo(function FloorLayer({ width, height }: FloorLayerProps) {
  const frame = useMemo(() => sceneFrame(width, height), [width, height]);
  const rows = useMemo(() => floorRows(frame), [frame]);
  const columns = useMemo(() => columnWedgesPath(frame), [frame]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path path={columns}>
        <LinearGradient
          start={vec(0, frame.horizon)}
          end={vec(0, height)}
          colors={[
            neonAlpha(NEON.cyan, 0),
            neonAlpha(NEON.cyan, 0.06),
            neonAlpha(NEON.cyan, 0.5),
            neonAlpha(NEON.cyan, 0.8),
          ]}
          positions={[0, 0.25, 0.7, 1]}
        />
      </Path>
      <Group>
        {rows.map((row, i) => (
          <Rect
            key={`row-${i}`}
            x={-width * 0.5}
            y={row.y - row.h / 2}
            width={width * 2}
            height={row.h}
            color={neonAlpha(NEON.cyan, row.alpha)}
          />
        ))}
      </Group>
    </Canvas>
  );
});

/** Each row's thickness and opacity from its normalised depth t (1 = near edge, → 0 at horizon). */
function floorRows(frame: SceneFrame) {
  return gridRowOffsets(frame).map((y) => {
    const t = (y - frame.horizon) / frame.floorHeight;
    return {
      y,
      h: Math.max(MIN_ROW_PX, NEAR_ROW_PX * t),
      alpha: NEAR_ROW_ALPHA * Math.pow(t, ROW_FALLOFF),
    };
  });
}

/** Converging columns as thin wedges: a point at the vanishing point, widest at the near edge. */
function columnWedgesPath(frame: SceneFrame): string {
  const n = (v: number) => v.toFixed(1);
  const parts: string[] = [];
  for (let i = 0; i < GRID_COLUMNS; i += 1) {
    const base = gridColumnBase(frame, i);
    parts.push(
      `M ${n(frame.vanishX)} ${n(frame.horizon)} ` +
        `L ${n(base - NEAR_COLUMN_HALF_PX)} ${n(frame.height)} ` +
        `L ${n(base + NEAR_COLUMN_HALF_PX)} ${n(frame.height)} Z`,
    );
  }
  return parts.join(' ');
}
