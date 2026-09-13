/**
 * Core V2 directional targeting. Attack origin and inward direction come from
 * the rounded-rectangle perimeter in cell space. One shot per attack-line bin
 * per pass. First occupied cell blocks everything behind it.
 *
 * Geometry progress 0 is top-center; pass progress 0 is bottom-center:
 *   geometryProgress = normalize(0.5 + passProgress)
 */
import {
  createRoundedPerimeterGeometry,
  normalizePerimeterProgress,
  ROUNDED_PERIMETER_BOTTOM_CENTER_PROGRESS,
  type RoundedPerimeterBounds,
  type RoundedPerimeterGeometry,
} from '@/game/geometry/roundedPerimeter';
import { firstOccupiedOnRay, occupiedCellsOnRay } from './gridRay';
import { isLinkedPrimed } from './linked';
import type { GameState, OrbColor, Pixel } from './types';

export interface AttackBin {
  id: string;
  /** Pass progress in `[0, 1)` from bottom-center insertion. */
  passProgress: number;
}

export interface DirectionalPick {
  pixelId: string;
  progress: number;
  binId: string;
}

const BIN_CACHE = new Map<string, AttackBin[]>();
const GEOM_CACHE = new Map<string, RoundedPerimeterGeometry>();

/** One-cell moat around the artwork so rays start outside the grid. */
const PAD = 1;

export function targetingPerimeterBounds(width: number, height: number): RoundedPerimeterBounds {
  const bw = width + PAD * 2;
  const bh = height + PAD * 2;
  const radius = Math.min(1, Math.min(width, height) / 4);
  return { x: -PAD, y: -PAD, width: bw, height: bh, radius };
}

function cacheKey(width: number, height: number): string {
  return `${width}x${height}`;
}

export function targetingPerimeter(width: number, height: number): RoundedPerimeterGeometry {
  const key = cacheKey(width, height);
  const cached = GEOM_CACHE.get(key);
  if (cached) return cached;
  const geom = createRoundedPerimeterGeometry(targetingPerimeterBounds(width, height));
  GEOM_CACHE.set(key, geom);
  return geom;
}

/**
 * Ordered attack-line bins, clockwise from bottom-center (pass progress 0).
 *
 * Straight edges: one bin per board column (top/bottom) or row (left/right),
 * fired from the cell-center on that edge.
 * Corners: `round(arcLength)` equal-arc bins, fired from each sub-arc midpoint.
 */
export function listAttackBins(width: number, height: number): AttackBin[] {
  const key = cacheKey(width, height);
  const cached = BIN_CACHE.get(key);
  if (cached) return cached;

  const geom = targetingPerimeter(width, height);
  const { x, y, width: W, height: H, radius: R } = geom.bounds;
  const Lh = Math.max(0, W - 2 * R);
  const Lv = Math.max(0, H - 2 * R);
  const arc = R > 0 ? (Math.PI * R) / 2 : 0;
  const total = geom.length;
  const bins: AttackBin[] = [];
  if (total <= 0 || width <= 0 || height <= 0) {
    BIN_CACHE.set(key, bins);
    return bins;
  }

  const halfH = Lh / 2;
  const dTopRight = halfH;
  const dRight = halfH + arc;
  const dBottomRight = halfH + arc + Lv;
  const dBottom = halfH + 2 * arc + Lv;
  const dBottomLeft = halfH + 2 * arc + Lv + Lh;
  const dLeft = halfH + 3 * arc + Lv + Lh;
  const dTopLeft = halfH + 3 * arc + 2 * Lv + Lh;
  const dTop2 = halfH + 4 * arc + 2 * Lv + Lh;
  const toPass = (dist: number) =>
    normalizePerimeterProgress(dist / total - ROUNDED_PERIMETER_BOTTOM_CENTER_PROGRESS);

  const midX = x + W / 2;
  for (let c = 0; c < width; c += 1) {
    const cx = c + 0.5;
    if (cx >= midX - 1e-12) {
      bins.push({ id: `t:${c}`, passProgress: toPass(cx - midX) });
    } else {
      bins.push({ id: `t:${c}`, passProgress: toPass(dTop2 + (cx - (x + R))) });
    }
  }

  for (let r = 0; r < height; r += 1) {
    bins.push({ id: `r:${r}`, passProgress: toPass(dRight + ((r + 0.5) - (y + R))) });
  }

  for (let c = 0; c < width; c += 1) {
    const cx = c + 0.5;
    bins.push({ id: `b:${c}`, passProgress: toPass(dBottom + ((x + W - R) - cx)) });
  }

  for (let r = 0; r < height; r += 1) {
    bins.push({ id: `l:${r}`, passProgress: toPass(dLeft + ((y + H - R) - (r + 0.5))) });
  }

  const cornerN = arc > 0 ? Math.max(1, Math.round(arc)) : 0;
  const corners: { prefix: string; start: number }[] = [
    { prefix: 'tr', start: dTopRight },
    { prefix: 'br', start: dBottomRight },
    { prefix: 'bl', start: dBottomLeft },
    { prefix: 'tl', start: dTopLeft },
  ];
  for (const corner of corners) {
    for (let i = 0; i < cornerN; i += 1) {
      const t = (i + 0.5) / cornerN;
      bins.push({ id: `${corner.prefix}:${i}`, passProgress: toPass(corner.start + t * arc) });
    }
  }

  bins.sort((a, b) => {
    const dp = a.passProgress - b.passProgress;
    if (Math.abs(dp) > 1e-12) return dp;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  BIN_CACHE.set(key, bins);
  return bins;
}

export function isEligibleDirectionalTarget(pixel: Pixel, color: OrbColor): boolean {
  return !pixel.cleared && pixel.color === color && !isLinkedPrimed(pixel);
}

function occupancyAt(state: GameState): (x: number, y: number) => Pixel | undefined {
  const map = new Map<string, Pixel>();
  for (const p of state.pixels) {
    if (!p.cleared) map.set(`${p.x},${p.y}`, p);
  }
  return (x, y) => map.get(`${x},${y}`);
}

export function pickDirectionalEncounter(
  state: GameState,
  color: OrbColor,
  fromProgress: number,
  consumedBins: ReadonlySet<string>,
): DirectionalPick | null {
  const bins = listAttackBins(state.width, state.height);
  const occupier = occupancyAt(state);
  const geom = targetingPerimeter(state.width, state.height);
  const start = fromProgress <= 0 ? 0 : fromProgress;

  for (const bin of bins) {
    if (bin.passProgress < start - 1e-12) continue;
    if (bin.passProgress >= 1 - 1e-12) continue;
    if (consumedBins.has(bin.id)) continue;

    const geometryProgress = normalizePerimeterProgress(
      ROUNDED_PERIMETER_BOTTOM_CENTER_PROGRESS + bin.passProgress,
    );
    const origin = geom.pointAt(geometryProgress);
    const dir = geom.inwardNormalAt(geometryProgress);
    const cell = firstOccupiedOnRay(
      origin,
      dir,
      state.width,
      state.height,
      (x, y) => occupier(x, y) !== undefined,
    );
    if (!cell) continue;
    const pixel = occupier(cell.x, cell.y);
    if (!pixel || !isEligibleDirectionalTarget(pixel, color)) continue;
    return { pixelId: pixel.id, progress: bin.passProgress, binId: bin.id };
  }
  return null;
}

/**
 * Perimeter-side / directional-line family of an attack-bin id (`t`, `r`, `b`,
 * `l`, or a corner `tr`/`br`/`bl`/`tl`).
 */
export function attackBinFamily(binId: string): string {
  const colon = binId.indexOf(':');
  return colon >= 0 ? binId.slice(0, colon) : binId;
}

/**
 * Uncleared pixels along one Core V2 attack bin, front-to-back (first-visible
 * first). Reuses the same origin, inward normal, and DDA as targeting.
 */
export function occupiedPixelsAlongBin(state: GameState, bin: AttackBin): Pixel[] {
  const occupier = occupancyAt(state);
  const geom = targetingPerimeter(state.width, state.height);
  const geometryProgress = normalizePerimeterProgress(
    ROUNDED_PERIMETER_BOTTOM_CENTER_PROGRESS + bin.passProgress,
  );
  const origin = geom.pointAt(geometryProgress);
  const dir = geom.inwardNormalAt(geometryProgress);
  const cells = occupiedCellsOnRay(
    origin,
    dir,
    state.width,
    state.height,
    (x, y) => occupier(x, y) !== undefined,
  );
  const pixels: Pixel[] = [];
  for (const cell of cells) {
    const pixel = occupier(cell.x, cell.y);
    if (pixel) pixels.push(pixel);
  }
  return pixels;
}
