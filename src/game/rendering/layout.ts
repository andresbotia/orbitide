/**
 * Back-compat surface. The reusable responsive board geometry now lives in
 * `boardGeometry.ts`; this file keeps the historical `BoardLayout` /
 * `computeBoardLayout` names that existing renderers and tests import.
 */
export {
  computeBoardGeometry,
  computeBoardGeometry as computeBoardLayout,
  cellCenter,
  orbitPoint,
  pixelAdaptive,
  SUPPORTED_DENSITIES,
  MAX_READY_DENSITY,
} from './boardGeometry';
export type {
  BoardGeometry,
  BoardGeometry as BoardLayout,
  Point,
  Rect,
  PixelAdaptive,
  PositionedPixel,
} from './boardGeometry';
