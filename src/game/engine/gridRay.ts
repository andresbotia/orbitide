/**
 * Cell-space DDA (Amanatides–Woo). Pure; no screen pixels, no React.
 *
 * Tie convention:
 * - Origin exactly on a vertical grid line with dx < 0 starts in the cell
 *   being entered (cellX = round(x) - 1); otherwise cellX = floor(x).
 *   Same for y / dy.
 * - When the ray passes exactly through a grid corner (tMaxX == tMaxY),
 *   step X first, then Y on the next iteration: origin cell → horizontal
 *   neighbour → diagonal. The vertical neighbour is not visited. The
 *   diagonal is not taken in a single step.
 */

export interface RayOrigin {
  x: number;
  y: number;
}

export interface RayDir {
  x: number;
  y: number;
}

export interface GridCell {
  x: number;
  y: number;
}

const ON_LINE = 1e-10;

function onGridLine(n: number): boolean {
  return Math.abs(n - Math.round(n)) < ON_LINE;
}

function exitedBoard(
  cellX: number,
  cellY: number,
  stepX: number,
  stepY: number,
  width: number,
  height: number,
): boolean {
  if (stepX > 0 && cellX >= width && (stepY === 0 || cellY < 0 || cellY >= height)) return true;
  if (stepX < 0 && cellX < 0 && (stepY === 0 || cellY < 0 || cellY >= height)) return true;
  if (stepY > 0 && cellY >= height && (stepX === 0 || cellX < 0 || cellX >= width)) return true;
  if (stepY < 0 && cellY < 0 && (stepX === 0 || cellX < 0 || cellX >= width)) return true;
  if (cellX < -2 || cellY < -2 || cellX > width + 1 || cellY > height + 1) return true;
  return false;
}

/**
 * First in-bounds occupied cell along `dir` from `origin`, or `null` if the
 * ray leaves the board without hitting one. `occupied` is true for an
 * uncleared pixel at that cell.
 */
export function firstOccupiedOnRay(
  origin: RayOrigin,
  dir: RayDir,
  width: number,
  height: number,
  occupied: (x: number, y: number) => boolean,
): GridCell | null {
  const len = Math.hypot(dir.x, dir.y);
  if (!(len > 1e-12) || width <= 0 || height <= 0) return null;
  const dx = dir.x / len;
  const dy = dir.y / len;

  let cellX = Math.floor(origin.x + 1e-14);
  let cellY = Math.floor(origin.y + 1e-14);
  if (onGridLine(origin.x) && dx < 0) cellX = Math.round(origin.x) - 1;
  if (onGridLine(origin.y) && dy < 0) cellY = Math.round(origin.y) - 1;

  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Number.POSITIVE_INFINITY;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : Number.POSITIVE_INFINITY;

  let tMaxX = Number.POSITIVE_INFINITY;
  if (stepX > 0) tMaxX = (cellX + 1 - origin.x) / dx;
  else if (stepX < 0) tMaxX = (cellX - origin.x) / dx;

  let tMaxY = Number.POSITIVE_INFINITY;
  if (stepY > 0) tMaxY = (cellY + 1 - origin.y) / dy;
  else if (stepY < 0) tMaxY = (cellY - origin.y) / dy;

  const limit = (width + height + 8) * 2;
  for (let i = 0; i < limit; i += 1) {
    if (cellX >= 0 && cellY >= 0 && cellX < width && cellY < height) {
      if (occupied(cellX, cellY)) return { x: cellX, y: cellY };
    } else if (exitedBoard(cellX, cellY, stepX, stepY, width, height)) {
      return null;
    }

    if (tMaxX <= tMaxY) {
      cellX += stepX;
      tMaxX += tDeltaX;
    } else {
      cellY += stepY;
      tMaxY += tDeltaY;
    }
  }
  return null;
}
