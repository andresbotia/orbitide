import { clockwiseGap } from './orbit';
import type { GameState, OrbColor, Pixel } from './types';

/**
 * Pixel geometry helpers: reachability (the exposure rule) and the deterministic
 * clockwise clear order. Pure functions, no state mutation.
 */

const ORTHO: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

function key(x: number, y: number): string {
  return `${x},${y}`;
}

/** Picture centre in cell coordinates (used for the clockwise ordering). */
export function pictureCenter(state: Pick<GameState, 'width' | 'height'>): {
  cx: number;
  cy: number;
} {
  return { cx: (state.width - 1) / 2, cy: (state.height - 1) / 2 };
}

/**
 * The set of exterior-connected empty cells, flood-filled from a one-cell moat
 * around the grid. A cell string `"x,y"` is in the set when it is empty (no
 * uncleared pixel) and reachable from outside through other empty cells.
 */
function exteriorCells(state: GameState): Set<string> {
  const solid = new Set<string>();
  for (const p of state.pixels) {
    if (!p.cleared) solid.add(key(p.x, p.y));
  }

  const minX = -1;
  const minY = -1;
  const maxX = state.width;
  const maxY = state.height;

  const exterior = new Set<string>();
  const stack: [number, number][] = [];

  const consider = (x: number, y: number) => {
    if (x < minX || x > maxX || y < minY || y > maxY) return;
    const k = key(x, y);
    if (exterior.has(k) || solid.has(k)) return;
    exterior.add(k);
    stack.push([x, y]);
  };

  // Seed the moat ring.
  for (let x = minX; x <= maxX; x += 1) {
    consider(x, minY);
    consider(x, maxY);
  }
  for (let y = minY; y <= maxY; y += 1) {
    consider(minX, y);
    consider(maxX, y);
  }

  while (stack.length > 0) {
    const [x, y] = stack.pop() as [number, number];
    for (const [dx, dy] of ORTHO) consider(x + dx, y + dy);
  }

  return exterior;
}

/**
 * Whether an uncleared pixel is currently reachable: at least one orthogonal
 * neighbour is exterior-connected empty space (off-grid counts as exterior).
 */
export function reachablePixels(state: GameState): Pixel[] {
  const exterior = exteriorCells(state);
  return state.pixels.filter((p) => {
    if (p.cleared) return false;
    return ORTHO.some(([dx, dy]) => exterior.has(key(p.x + dx, p.y + dy)));
  });
}

/**
 * Clockwise orbital ordering key, starting from the charge's entry (default: 12 o'clock). Lower sorts first.
 * Ties on angle are broken by larger radius first (outer pixels clear first),
 * then by pixel id for total determinism.
 */
export function clearOrder(
  state: Pick<GameState, 'width' | 'height'>,
  entryFraction = 0,
): (a: Pixel, b: Pixel) => number {
  const { cx, cy } = pictureCenter(state);
  const angleOf = (p: Pixel) => clockwiseGap(entryFraction, pixelEncounterFraction(state, p, entryFraction));
  const radiusSq = (p: Pixel) => (p.x - cx) ** 2 + (p.y - cy) ** 2;

  return (a, b) => {
    const da = angleOf(a);
    const db = angleOf(b);
    if (Math.abs(da - db) > 1e-9) return da - db;
    const ra = radiusSq(a);
    const rb = radiusSq(b);
    if (Math.abs(ra - rb) > 1e-9) return rb - ra;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}

/**
 * Clockwise angular position of a pixel around the picture centre, as a
 * fraction in [0, 1): 0 is the 12 o'clock direction, increasing clockwise.
 * This is the same angle the deterministic clear order sorts by, exposed so the
 * presentation layer can place each pixel on the orbital track.
 */
export function pixelAngleFraction(
  state: Pick<GameState, 'width' | 'height'>,
  pixel: Pick<Pixel, 'x' | 'y'>,
): number {
  const { cx, cy } = pictureCenter(state);
  const twoPi = Math.PI * 2;
  const a = Math.atan2(pixel.y - cy, pixel.x - cx) + Math.PI / 2;
  return (((a % twoPi) + twoPi) % twoPi) / twoPi;
}

/**
 * Reachable pixels of a given color, already sorted in the deterministic clear
 * order. This is exactly the list a charge of that color would eat into.
 */
export function reachableTargets(state: GameState, color: OrbColor, entryFraction = 0): Pixel[] {
  return reachablePixels(state)
    .filter((p) => p.color === color)
    .sort(clearOrder(state, entryFraction));
}

export function remainingPixelCount(state: GameState): number {
  let n = 0;
  for (const p of state.pixels) if (!p.cleared) n += 1;
  return n;
}

export interface ChargePassResult {
  /** Ids of pixels cleared by this pass, in the order they were cleared. */
  clearedPixelIds: string[];
}

/**
 * Run one charge pass against the board: clear up to `capacity` reachable
 * pixels of `color`, in the deterministic clear order. **Mutates** `state.pixels`
 * (sets `cleared`), so callers pass a working copy. Returns the cleared ids.
 */
export function applyChargePass(
  state: GameState,
  color: OrbColor,
  capacity: number,
  entryFraction = 0,
): ChargePassResult {
  if (capacity <= 0) return { clearedPixelIds: [] };
  const targets = reachableTargets(state, color, entryFraction).slice(0, capacity);
  const targetIds = new Set(targets.map((p) => p.id));
  if (targetIds.size === 0) return { clearedPixelIds: [] };

  for (const pixel of state.pixels) {
    if (targetIds.has(pixel.id)) pixel.cleared = true;
  }
  return { clearedPixelIds: targets.map((p) => p.id) };
}

/** Nearest point on a circular orbit; a centre pixel is equally near at entry. */
export function pixelEncounterFraction(
  state: Pick<GameState, 'width' | 'height'>,
  pixel: Pick<Pixel, 'x' | 'y'>,
  entryFraction: number,
): number {
  const { cx, cy } = pictureCenter(state);
  return pixel.x === cx && pixel.y === cy ? entryFraction : pixelAngleFraction(state, pixel);
}
