import type { GameState } from '@/game/engine/types';
import { ORBIT_ENTRY_FRACTION } from '@/game/engine/orbit';

/**
 * Reusable responsive board geometry for the production Cosmic Arcade gameplay
 * shell. Pure math — no React, RN or Skia — so it is unit-testable and shared by
 * every renderer (rail, pixels, charge, projectile, launch choreography).
 *
 * The engine's orbit truth still begins at ORBIT_INSERTION (bottom of the ring).
 * LAUNCH_HUB is a *presentation-only* waypoint: the approved central launch
 * position a charge briefly seats on before it moves radially out to
 * ORBIT_INSERTION and enters the orbit. They are deliberately different points.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Density-driven rendering parameters. As the grid gets denser every value
 * shrinks: thinner bevels, tighter corners, smaller gutters, calmer glow and
 * smaller pop effects. The artwork footprint itself stays ~constant.
 */
export interface PixelAdaptive {
  /** Bevel / rim stroke width, in px. */
  bevel: number;
  /** Corner radius as a fraction of the cell. */
  cornerRadius: number;
  /** Gap between adjacent cells, in px. */
  gutter: number;
  /** Restrained inner-emissive strength, 0..1. */
  glow: number;
  /** Top-highlight opacity, 0..1. */
  highlight: number;
  /** Lower-shadow opacity, 0..1. */
  shadow: number;
  /** Extra scale added at the peak of a clear pop (0 = no overshoot). */
  popOvershoot: number;
}

/** Board densities the production renderer is tuned for. */
export const SUPPORTED_DENSITIES = [7, 9, 11, 13, 15, 17, 19, 21, 23, 24] as const;
/** Max density prepared for in the adaptive renderer. */
export const MAX_READY_DENSITY = 24;

const DENSITY_MIN = 7;

/**
 * Adaptive parameters for a `density x density` (max of cols/rows) board.
 * Linear interpolation between the 7x7 look and the 21x21 look, clamped.
 */
export function pixelAdaptive(density: number): PixelAdaptive {
  const d = Math.max(DENSITY_MIN, Math.min(MAX_READY_DENSITY, density));
  const t = (d - DENSITY_MIN) / (MAX_READY_DENSITY - DENSITY_MIN);
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    bevel: lerp(2.2, 0.5),
    cornerRadius: lerp(0.26, 0.08),
    gutter: lerp(2.2, 0.5),
    glow: lerp(0.5, 0.12),
    highlight: lerp(0.4, 0.14),
    shadow: lerp(0.36, 0.12),
    popOvershoot: lerp(0.35, 0.06),
  };
}

export interface BoardGeometry {
  size: number;
  cols: number;
  rows: number;
  /** max(cols, rows) — what the adaptive renderer keys off. */
  density: number;

  center: Point;

  /** Pixel-art cell edge length, in px. */
  cell: number;
  /** Bounding box of the pixel artwork, in board coordinates. */
  artwork: Rect;
  /** Alias of `artwork` top-left, kept for existing callers. */
  gridOrigin: Point;
  gridWidth: number;
  gridHeight: number;

  /** Centre of the circular orbit rail (== board centre). */
  orbitCenter: Point;
  /** Outer orbit-rail radius. */
  orbitRadius: number;
  /** Decorative inner guide radius. */
  innerGuideRadius: number;
  /** Legacy pair-of-circles shape used by the Skia rail + flight worklet. */
  orbit: { rx: number; ry: number }[];

  /**
   * Shared launch hub — the approved central launch position. Presentation
   * routes Tunnel -> LAUNCH_HUB -> ORBIT_INSERTION -> orbit and
   * Holding -> LAUNCH_HUB -> ORBIT_INSERTION -> orbit.
   */
  launchHub: Point;
  /** Engine-truth orbit entry: board centre + (0, +R), bottom of the ring. */
  orbitInsertion: Point;
  /** Legacy name for `orbitInsertion`, used by the flight worklet + tests. */
  insertion: Point;

  /** Radius of the rendered traveling-charge token. */
  chargeRadius: number;

  /** Board-relative hint for where the Holding row sits (below the rail). */
  holdingAnchor: Point;
  /** Board-relative hint for the tunnel region (further below Holding). */
  tunnelRegion: Rect;

  adaptive: PixelAdaptive;
}

/**
 * Artwork target footprint as a fraction of board size. Held ~constant across
 * densities so the picture does not shrink just because the grid got finer.
 */
const FOOTPRINT = 0.56;
const MIN_CELL = 4;

/** Geometry for a square board rendering a `cols x rows` picture. */
export function computeBoardGeometry(
  size: number,
  cols: number,
  rows: number,
): BoardGeometry {
  const center: Point = { x: size / 2, y: size / 2 };
  const density = Math.max(1, Math.max(cols, rows));

  const maxGrid = size * FOOTPRINT;
  const cell = Math.max(
    MIN_CELL,
    Math.floor(Math.min(maxGrid / Math.max(1, cols), maxGrid / Math.max(1, rows))),
  );
  const gridWidth = cell * cols;
  const gridHeight = cell * rows;
  const gridOrigin: Point = {
    x: center.x - gridWidth / 2,
    y: center.y - gridHeight / 2,
  };
  const artwork: Rect = { x: gridOrigin.x, y: gridOrigin.y, width: gridWidth, height: gridHeight };

  const chargeRadius = Math.min(size * 0.045, Math.max(7, cell * 0.55));

  // Outer rail: as large as fits, but always outside the artwork corner with
  // clearance for the token and its capacity label.
  const outer = Math.min(size * 0.45, size / 2 - chargeRadius - 2);
  const innerGuide = Math.min(
    outer - 2,
    Math.max(
      Math.hypot(gridWidth, gridHeight) / 2 + cell * 0.9,
      outer * 0.7,
    ),
  );
  const orbit = [
    { rx: outer, ry: outer },
    { rx: innerGuide, ry: innerGuide },
  ];

  const angle = ORBIT_ENTRY_FRACTION * Math.PI * 2 - Math.PI / 2;
  const orbitInsertion: Point = {
    x: center.x + Math.cos(angle) * outer,
    y: center.y + Math.sin(angle) * outer,
  };

  // The hub is the central launch seat. Kept at the exact centre for M2A; a
  // small vertical bias is available here if design wants the seat lower.
  const launchHub: Point = { x: center.x, y: center.y };

  const holdingAnchor: Point = { x: center.x, y: size + chargeRadius * 2 };
  const tunnelRegion: Rect = {
    x: 0,
    y: size + chargeRadius * 4,
    width: size,
    height: chargeRadius * 6,
  };

  return {
    size,
    cols,
    rows,
    density,
    center,
    cell,
    artwork,
    gridOrigin,
    gridWidth,
    gridHeight,
    orbitCenter: center,
    orbitRadius: outer,
    innerGuideRadius: innerGuide,
    orbit,
    launchHub,
    orbitInsertion,
    insertion: orbitInsertion,
    chargeRadius,
    holdingAnchor,
    tunnelRegion,
    adaptive: pixelAdaptive(density),
  };
}

/** Board-space centre of pixel-art cell (x, y). */
export function cellCenter(geo: Pick<BoardGeometry, 'gridOrigin' | 'cell'>, x: number, y: number): Point {
  return {
    x: geo.gridOrigin.x + x * geo.cell + geo.cell / 2,
    y: geo.gridOrigin.y + y * geo.cell + geo.cell / 2,
  };
}

/** Point on the outer orbit at a given angle (radians). */
export function orbitPoint(geo: Pick<BoardGeometry, 'center' | 'orbit'>, angle: number): Point {
  return {
    x: geo.center.x + Math.cos(angle) * geo.orbit[0]!.rx,
    y: geo.center.y + Math.sin(angle) * geo.orbit[0]!.ry,
  };
}

export interface PositionedPixel {
  id: string;
  color: GameState['pixels'][number]['color'];
  x: number;
  y: number;
  center: Point;
  reachable: boolean;
}
