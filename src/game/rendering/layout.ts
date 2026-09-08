import type { GameState } from '@/game/engine/types';
import { ORBIT_ENTRY_FRACTION } from '@/game/engine/orbit';

export interface Point {
  x: number;
  y: number;
}

export interface BoardLayout {
  size: number;
  center: Point;
  /** Pixel-art cell edge length. */
  cell: number;
  /** Top-left of the pixel-art grid, in board coordinates. */
  gridOrigin: Point;
  gridWidth: number;
  gridHeight: number;
  /** Radii of the two circular orbital guides. */
  orbit: { rx: number; ry: number }[];
  /** One canonical insertion point for every tunnel and held charge. */
  insertion: Point;
  /** Radius used for the traveling charge token. */
  chargeRadius: number;
}


/** Geometry for a square board rendering a `cols x rows` picture. */
export function computeBoardLayout(
  size: number,
  cols: number,
  rows: number,
): BoardLayout {
  const center = { x: size / 2, y: size / 2 };
  const maxGrid = size * 0.58;
  const cell = Math.max(
    6,
    Math.floor(Math.min(maxGrid / Math.max(1, cols), maxGrid / Math.max(1, rows))),
  );
  const gridWidth = cell * cols;
  const gridHeight = cell * rows;
  const gridOrigin = {
    x: center.x - gridWidth / 2,
    y: center.y - gridHeight / 2,
  };

  const chargeRadius = Math.min(size * 0.045, Math.max(7, cell * 0.55));
  const outer = Math.min(size * 0.45, size / 2 - chargeRadius - 2);
  const inner = Math.max(
    Math.hypot(gridWidth, gridHeight) / 2 + cell * 0.9,
    outer * 0.7,
  );
  const orbit = [
    { rx: outer, ry: outer },
    { rx: inner, ry: inner },
  ];

  const angle = ORBIT_ENTRY_FRACTION * Math.PI * 2 - Math.PI / 2;
  const insertion = { x: center.x + Math.cos(angle) * outer, y: center.y + Math.sin(angle) * outer };

  return {
    size,
    center,
    cell,
    gridOrigin,
    gridWidth,
    gridHeight,
    orbit,
    insertion,
    chargeRadius,
  };
}

/** Board-space centre of pixel-art cell (x, y). */
export function cellCenter(layout: BoardLayout, x: number, y: number): Point {
  return {
    x: layout.gridOrigin.x + x * layout.cell + layout.cell / 2,
    y: layout.gridOrigin.y + y * layout.cell + layout.cell / 2,
  };
}

/** Point on the outer orbit at a given angle (radians). */
export function orbitPoint(layout: BoardLayout, angle: number): Point {
  return {
    x: layout.center.x + Math.cos(angle) * layout.orbit[0]!.rx,
    y: layout.center.y + Math.sin(angle) * layout.orbit[0]!.ry,
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
