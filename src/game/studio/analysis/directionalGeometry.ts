/**
 * Ruleset-aware geometry analysis.
 *
 * Core V2: layer depth and exposure come from the same attack-bin rays the
 * runtime uses (`listAttackBins` + inward DDA). A pixel's layer depth is the
 * minimum number of occupied cells in front of it on any attack ray
 * (0 = first-visible / initially exposed).
 *
 * Legacy V1: keeps the existing exterior flood-fill (`reachablePixels`). Layer
 * depth is orthogonal distance through uncleared cells from that exposed set.
 * Ray analysis is never applied to Legacy boards.
 */
import {
  attackBinFamily,
  listAttackBins,
  occupiedPixelsAlongBin,
} from '@/game/engine/directionalTargeting';
import { reachablePixels } from '@/game/engine/pixels';
import { isCoreV2 } from '@/game/engine/ruleset';
import type { GameState, Pixel } from '@/game/engine/types';
import type { DirectionalGeometry } from './types';

const ORTHO: readonly (readonly [number, number])[] = [
  [0, -1], [1, 0], [0, 1], [-1, 0],
];

export function directionalGeometry(state: GameState): DirectionalGeometry {
  return isCoreV2(state.ruleset) ? coreV2Geometry(state) : legacyGeometry(state);
}

function coreV2Geometry(state: GameState): DirectionalGeometry {
  const uncleared = state.pixels.filter((p) => !p.cleared);
  if (uncleared.length === 0) {
    return emptyGeometry('coreV2');
  }

  const minDepth = new Map<string, number>();
  const familiesAtZero = new Map<string, Set<string>>();
  for (const p of uncleared) {
    minDepth.set(p.id, Number.POSITIVE_INFINITY);
    familiesAtZero.set(p.id, new Set());
  }

  for (const bin of listAttackBins(state.width, state.height)) {
    const family = attackBinFamily(bin.id);
    const along = occupiedPixelsAlongBin(state, bin);
    along.forEach((pixel, depth) => {
      const prev = minDepth.get(pixel.id);
      if (prev === undefined) return;
      if (depth < prev) minDepth.set(pixel.id, depth);
      if (depth === 0) familiesAtZero.get(pixel.id)!.add(family);
    });
  }

  return summarise(uncleared, minDepth, familiesAtZero, 'coreV2');
}

function legacyGeometry(state: GameState): DirectionalGeometry {
  const uncleared = state.pixels.filter((p) => !p.cleared);
  if (uncleared.length === 0) {
    return emptyGeometry('legacyV1');
  }

  const solid = new Map<string, Pixel>();
  for (const p of uncleared) solid.set(`${p.x},${p.y}`, p);

  const exposed = reachablePixels(state);
  const minDepth = new Map<string, number>();
  const familiesAtZero = new Map<string, Set<string>>();
  for (const p of uncleared) {
    minDepth.set(p.id, Number.POSITIVE_INFINITY);
    familiesAtZero.set(p.id, new Set());
  }
  for (const p of exposed) minDepth.set(p.id, 0);

  // Orthogonal layer cake from the flood-fill exposed set.
  const byCoord = (x: number, y: number) => solid.get(`${x},${y}`);
  let frontier = [...exposed];
  while (frontier.length > 0) {
    const next: Pixel[] = [];
    for (const p of frontier) {
      const d = minDepth.get(p.id) ?? 0;
      for (const [dx, dy] of ORTHO) {
        const n = byCoord(p.x + dx, p.y + dy);
        if (!n) continue;
        const nd = minDepth.get(n.id) ?? Number.POSITIVE_INFINITY;
        if (d + 1 < nd) {
          minDepth.set(n.id, d + 1);
          next.push(n);
        }
      }
    }
    frontier = next;
  }

  // Side family = which ortho directions currently neighbour exterior-empty
  // space (the same exterior test reachablePixels uses, approximated as
  // "neighbour cell is not an uncleared pixel" only for pixels already in
  // the exposed set — interior holes are not exterior).
  const exposedSet = new Set(exposed.map((p) => p.id));
  const SIDE = ['n', 'e', 's', 'w'] as const;
  for (const p of exposed) {
    const fam = familiesAtZero.get(p.id)!;
    ORTHO.forEach(([dx, dy], i) => {
      if (!solid.has(`${p.x + dx},${p.y + dy}`)) fam.add(SIDE[i]!);
    });
    if (fam.size === 0 && exposedSet.has(p.id)) fam.add('n');
  }

  return summarise(uncleared, minDepth, familiesAtZero, 'legacyV1');
}

function summarise(
  uncleared: Pixel[],
  minDepth: Map<string, number>,
  familiesAtZero: Map<string, Set<string>>,
  mode: DirectionalGeometry['mode'],
): DirectionalGeometry {
  let initiallyExposed = 0;
  let buried = 0;
  let maxLayerDepth = 0;
  let depthSum = 0;
  let singleSideExposed = 0;
  let multiSideExposed = 0;

  for (const p of uncleared) {
    const raw = minDepth.get(p.id) ?? Number.POSITIVE_INFINITY;
    const depth = Number.isFinite(raw) ? raw : uncleared.length;
    depthSum += depth;
    maxLayerDepth = Math.max(maxLayerDepth, depth);
    if (depth === 0) {
      initiallyExposed += 1;
      const sides = familiesAtZero.get(p.id)?.size ?? 0;
      if (sides <= 1) singleSideExposed += 1;
      else multiSideExposed += 1;
    } else {
      buried += 1;
    }
  }

  return {
    mode,
    initiallyExposed,
    buried,
    maxLayerDepth,
    averageLayerDepth: uncleared.length > 0 ? depthSum / uncleared.length : 0,
    singleSideExposed,
    multiSideExposed,
  };
}

function emptyGeometry(mode: DirectionalGeometry['mode']): DirectionalGeometry {
  return {
    mode,
    initiallyExposed: 0,
    buried: 0,
    maxLayerDepth: 0,
    averageLayerDepth: 0,
    singleSideExposed: 0,
    multiSideExposed: 0,
  };
}
