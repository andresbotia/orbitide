import type { GameState } from '@/game/engine/types';

export interface Point {
  x: number;
  y: number;
}

export interface BoardLayout {
  size: number;
  center: Point;
  coreRadius: number;
  /** Radii of the concentric orbital guide rings (one per visible depth). */
  ringRadii: number[];
  orbRadius: number;
  laneCount: number;
}

/** Guide rings drawn / depths positioned without clamping. */
const VISIBLE_DEPTH = 4;
/** Centre-to-centre ring spacing as a multiple of the orb radius. */
const RING_GAP = 2.35;
/** Core-edge-to-first-ring spacing as a multiple of the orb radius. */
const CORE_GAP = 2.4;

/**
 * Geometry for a square board. Orb radius is derived from the available radial
 * space so that orbs in the same lane never overlap, down to {@link VISIBLE_DEPTH}.
 */
export function computeBoardLayout(size: number, laneCount: number): BoardLayout {
  const center = { x: size / 2, y: size / 2 };
  const outerPadding = size * 0.04;
  const coreRadius = size * 0.1;
  const usableRadius = size / 2 - outerPadding;

  // usableRadius = coreRadius + CORE_GAP*r + (VISIBLE_DEPTH-1)*RING_GAP*r + r
  const denom = CORE_GAP + (VISIBLE_DEPTH - 1) * RING_GAP + 1;
  const orbRadius = Math.max(
    9,
    Math.min(22, (usableRadius - coreRadius) / denom),
  );

  const firstRing = coreRadius + CORE_GAP * orbRadius;
  const ringRadii = Array.from(
    { length: VISIBLE_DEPTH },
    (_, i) => firstRing + i * RING_GAP * orbRadius,
  );

  return {
    size,
    center,
    coreRadius,
    ringRadii,
    orbRadius,
    laneCount: Math.max(1, laneCount),
  };
}

/** Angle (radians) of a lane's spoke. Lane 0 points straight up. */
export function laneAngle(laneIndex: number, laneCount: number): number {
  return -Math.PI / 2 + (laneIndex * 2 * Math.PI) / Math.max(1, laneCount);
}

/**
 * Screen position of the orb at `depth` (0 = exposed) in `laneIndex`.
 * Depths beyond the last guide ring continue outward at the ring spacing.
 */
export function orbPosition(
  layout: BoardLayout,
  laneIndex: number,
  depth: number,
): Point {
  const angle = laneAngle(laneIndex, layout.laneCount);
  const lastRing = layout.ringRadii[layout.ringRadii.length - 1] ?? 0;
  const radius =
    depth < layout.ringRadii.length
      ? (layout.ringRadii[depth] ?? lastRing)
      : lastRing + (depth - layout.ringRadii.length + 1) * RING_GAP * layout.orbRadius;
  return {
    x: layout.center.x + Math.cos(angle) * radius,
    y: layout.center.y + Math.sin(angle) * radius,
  };
}

export interface PositionedOrb {
  id: string;
  color: GameState['lanes'][number][number]['color'];
  laneIndex: number;
  depth: number;
  point: Point;
  isExposed: boolean;
}

/** Flatten the lanes of a game state into positioned, drawable orbs. */
export function layoutOrbs(
  state: GameState,
  layout: BoardLayout,
): PositionedOrb[] {
  const orbs: PositionedOrb[] = [];
  state.lanes.forEach((lane, laneIndex) => {
    lane.forEach((orb, depth) => {
      orbs.push({
        id: orb.id,
        color: orb.color,
        laneIndex,
        depth,
        point: orbPosition(layout, laneIndex, depth),
        isExposed: depth === 0,
      });
    });
  });
  return orbs;
}
