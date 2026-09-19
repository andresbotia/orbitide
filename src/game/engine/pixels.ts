import { clockwiseGap, ORBIT_ENTRY_FRACTION } from './orbit';
import type { GameState, OrbColor, Pixel } from './types';

/**
 * Pixel geometry helpers: reachability (the exposure rule) and the deterministic
 * clockwise clear order. Pure functions, no state mutation.
 */

/** Picture centre in cell coordinates (used for the clockwise ordering). */
export function pictureCenter(state: Pick<GameState, 'width' | 'height'>): {
  cx: number;
  cy: number;
} {
  return { cx: (state.width - 1) / 2, cy: (state.height - 1) / 2 };
}

/**
 * Exterior-connected empty space, as a flat bitmap over the grid plus a
 * one-cell moat: index `(y + 1) * (width + 2) + (x + 1)` is `1` when that cell
 * is empty (no uncleared pixel) and reachable from outside through other empty
 * cells.
 *
 * A bitmap rather than a `Set<string>`: the old representation allocated ~900
 * strings per board shape and, cached, grew the heap by ~35 MB per completed
 * 28x28 level. A `Uint8Array` of the same board is 900 bytes, and the
 * neighbour test becomes index arithmetic instead of string hashing.
 */
export interface ExteriorMask {
  readonly cells: Uint8Array;
  readonly stride: number;
}

/** Occupancy pass: mark every uncleared pixel solid. This doubles as the flood
 *  fill's starting state, so the board is never walked twice. */
function solidCells(state: GameState): ExteriorMask {
  const stride = state.width + 2;
  const rows = state.height + 2;
  const cells = new Uint8Array(stride * rows);
  // 2 = solid (an uncleared pixel), 1 = exterior-connected empty, 0 = unvisited.
  for (const p of state.pixels) {
    if (!p.cleared) cells[(p.y + 1) * stride + (p.x + 1)] = 2;
  }
  return { cells, stride };
}

/** Flood the exterior into a prepared solid mask, in place. */
function floodExterior(mask: ExteriorMask): ExteriorMask {
  const { cells, stride } = mask;
  const stack: number[] = [];
  const consider = (index: number) => {
    if (cells[index] !== 0) return;
    cells[index] = 1;
    stack.push(index);
  };

  // Seed the moat ring (the outermost row/column of the padded grid).
  const lastRow = cells.length - stride;
  for (let x = 0; x < stride; x += 1) {
    consider(x);
    consider(lastRow + x);
  }
  for (let index = 0; index < cells.length; index += stride) {
    consider(index);
    consider(index + stride - 1);
  }

  while (stack.length > 0) {
    const index = stack.pop() as number;
    const col = index % stride;
    if (col > 0) consider(index - 1);
    if (col < stride - 1) consider(index + 1);
    if (index >= stride) consider(index - stride);
    if (index + stride < cells.length) consider(index + stride);
  }

  return mask;
}

/**
 * Exact cache key for a prepared solid mask: the occupancy grid packed 15 cells
 * to a character. The exterior fill depends only on the padded grid width and
 * the set of solid cells, so this encodes its inputs completely and cannot
 * collide.
 *
 * A 28x28 board keys as ~62 characters instead of the ~5 KB coordinate list the
 * previous key built, which is what made the cache expensive to retain.
 */
function maskKey(mask: ExteriorMask): string {
  const { cells, stride } = mask;
  let key = `${stride}:`;
  let bits = 0;
  let filled = 0;
  for (let i = 0; i < cells.length; i += 1) {
    bits = (bits << 1) | (cells[i] === 2 ? 1 : 0);
    if (++filled === 15) {
      key += String.fromCharCode(bits);
      bits = 0;
      filled = 0;
    }
  }
  if (filled > 0) key += String.fromCharCode(bits);
  return key;
}

/**
 * The exterior flood fill dominates the cost of every exposure query, and the
 * solver hits the same board shapes thousands of times. Memoize the mask by
 * grid size + solid-cell occupancy (colours and pixel identity are irrelevant
 * to reachability); the cheap per-pixel test still runs against the caller's
 * own live pixel objects.
 */
const EXTERIOR_CACHE = new Map<string, ExteriorMask>();
/**
 * Bounded. Normal play reaches each board shape exactly once, so every entry it
 * writes is dead weight; only the solver, which revisits shapes, ever reads one
 * back. At ~1 KB per entry this budget costs a few MB at worst, where the
 * previous 250,000-entry limit grew the heap by ~35 MB per completed 28x28
 * level and never gave it back.
 */
const EXTERIOR_CACHE_LIMIT = 20_000;
/** Evicted in one batch on overflow — oldest first, so solver locality survives. */
const EXTERIOR_CACHE_EVICT = 4_000;
const EXTERIOR_WEAK_CACHE = new WeakMap<readonly Pixel[], ExteriorMask>();
const REACHABLE_WEAK_CACHE = new WeakMap<readonly Pixel[], Pixel[]>();

function cachedExteriorCells(state: GameState): ExteriorMask {
  const weakHit = EXTERIOR_WEAK_CACHE.get(state.pixels);
  if (weakHit) return weakHit;

  const prepared = solidCells(state);
  const key = maskKey(prepared);
  const cached = EXTERIOR_CACHE.get(key);
  if (cached) {
    EXTERIOR_WEAK_CACHE.set(state.pixels, cached);
    return cached;
  }
  const result = floodExterior(prepared);
  if (EXTERIOR_CACHE.size >= EXTERIOR_CACHE_LIMIT) {
    let dropped = 0;
    for (const stale of EXTERIOR_CACHE.keys()) {
      EXTERIOR_CACHE.delete(stale);
      if (++dropped >= EXTERIOR_CACHE_EVICT) break;
    }
  }
  EXTERIOR_CACHE.set(key, result);
  EXTERIOR_WEAK_CACHE.set(state.pixels, result);
  return result;
}

/**
 * Render-path memo, keyed only by `state.pixels` identity and collected with it.
 * The presentation layer builds a fresh pixels array per presented clear; each
 * one used to be written into the long-lived shape cache above (~1.2 MB per 10
 * level plays, never released, until the 20k cap). Rendering needs no shape
 * reuse, so it keeps its own weak memo and never writes that cache.
 */
const RENDER_MASK_WEAK_CACHE = new WeakMap<readonly Pixel[], ExteriorMask>();

/**
 * The same exterior mask as {@link exteriorMask}, for renderers: reuses any
 * mask already computed for this exact pixels array, otherwise floods without
 * touching the engine's long-lived shape cache. Gameplay semantics unchanged.
 */
export function renderExteriorMask(state: GameState): ExteriorMask {
  const engineHit = EXTERIOR_WEAK_CACHE.get(state.pixels);
  if (engineHit) return engineHit;
  const hit = RENDER_MASK_WEAK_CACHE.get(state.pixels);
  if (hit) return hit;
  const mask = floodExterior(solidCells(state));
  RENDER_MASK_WEAK_CACHE.set(state.pixels, mask);
  return mask;
}

/** Whether the cell at grid coordinates `x, y` is exterior-connected empty space. */
function isExterior(mask: ExteriorMask, x: number, y: number): boolean {
  const index = (y + 1) * mask.stride + (x + 1);
  return index >= 0 && index < mask.cells.length && mask.cells[index] === 1;
}

/**
 * The exterior mask for a board, memoized per `state.pixels` identity.
 * Exposed so the renderer can ask "is this pixel exposed?" per cell without
 * materialising an intermediate array or `Set` of ids on every clear.
 */
export function exteriorMask(state: GameState): ExteriorMask {
  return cachedExteriorCells(state);
}

/** Whether an uncleared pixel is currently reachable, given a prepared mask. */
export function isPixelReachable(mask: ExteriorMask, pixel: Pick<Pixel, 'x' | 'y'>): boolean {
  return (
    isExterior(mask, pixel.x, pixel.y - 1)
    || isExterior(mask, pixel.x + 1, pixel.y)
    || isExterior(mask, pixel.x, pixel.y + 1)
    || isExterior(mask, pixel.x - 1, pixel.y)
  );
}

/**
 * Whether an uncleared pixel is currently reachable: at least one orthogonal
 * neighbour is exterior-connected empty space (off-grid counts as exterior).
 */
export function reachablePixels(state: GameState): Pixel[] {
  const cached = REACHABLE_WEAK_CACHE.get(state.pixels);
  if (cached) return cached;
  const mask = cachedExteriorCells(state);
  const result = state.pixels.filter((p) => !p.cleared && isPixelReachable(mask, p));
  REACHABLE_WEAK_CACHE.set(state.pixels, result);
  return result;
}

/**
 * Clockwise orbital ordering key, starting from the charge's entry (default: bottom-centre). Lower sorts first.
 * Ties on angle are broken by larger radius first (outer pixels clear first),
 * then by pixel id for total determinism.
 */
export function clearOrder(
  state: Pick<GameState, 'width' | 'height'>,
  entryFraction = ORBIT_ENTRY_FRACTION,
): (a: Pixel, b: Pixel) => number {
  const keyOf = clearKeyer(state, entryFraction);
  return (a, b) => compareClearKeys(a, keyOf(a), b, keyOf(b));
}

/**
 * The first of `pixels` in {@link clearOrder}, in one pass with one key per
 * pixel — the same answer as sorting and taking `[0]`. `clearOrder` is a strict
 * total order on distinct grid pixels (distinct lattice directions differ in
 * angle by far more than its 1e-9 tolerance, collinear pixels by radius), so
 * the minimum is unique.
 */
export function firstInClearOrder(
  state: Pick<GameState, 'width' | 'height'>,
  pixels: readonly Pixel[],
  entryFraction = ORBIT_ENTRY_FRACTION,
): Pixel | undefined {
  const keyOf = clearKeyer(state, entryFraction);
  let first: Pixel | undefined;
  let firstKey: ClearKey | undefined;
  for (const p of pixels) {
    const key = keyOf(p);
    if (first === undefined || compareClearKeys(p, key, first, firstKey!) < 0) {
      first = p;
      firstKey = key;
    }
  }
  return first;
}

interface ClearKey { gap: number; radiusSq: number }

function clearKeyer(state: Pick<GameState, 'width' | 'height'>, entryFraction: number): (p: Pixel) => ClearKey {
  const { cx, cy } = pictureCenter(state);
  return (p) => ({
    gap: clockwiseGap(entryFraction, pixelEncounterFraction(state, p, entryFraction)),
    radiusSq: (p.x - cx) ** 2 + (p.y - cy) ** 2,
  });
}

function compareClearKeys(a: Pixel, ka: ClearKey, b: Pixel, kb: ClearKey): number {
  if (Math.abs(ka.gap - kb.gap) > 1e-9) return ka.gap - kb.gap;
  if (Math.abs(ka.radiusSq - kb.radiusSq) > 1e-9) return kb.radiusSq - ka.radiusSq;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
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
 * order. This is a current-exposure query; a pass rechecks exposure after each clear.
 */
export function reachableTargets(state: GameState, color: OrbColor, entryFraction = ORBIT_ENTRY_FRACTION): Pixel[] {
  return reachablePixels(state)
    .filter((p) => p.color === color)
    .sort(clearOrder(state, entryFraction));
}

export function remainingPixelCount(state: GameState): number {
  let n = 0;
  for (const p of state.pixels) if (!p.cleared) n += 1;
  return n;
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
