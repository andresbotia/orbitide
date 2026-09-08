import type { GameState } from '@/game/engine/types';

export interface Point {
  x: number;
  y: number;
}

export interface BoardLayout {
  size: number;
  center: Point;
  coreRadius: number;
  /** Radii of the concentric orbital guide rings. */
  ringRadii: number[];
  orbRadius: number;
  laneCount: number;
}

const MAX_VISIBLE_DEPTH = 4;

/** Geometry for a square board of a given pixel size and lane count. */
export function computeBoardLayout(size: number, laneCount: number): BoardLayout {
  const center = { x: size / 2, y: size / 2 };
  const outerPadding = size * 0.06;
  const coreRadius = size * 0.11;
  const orbRadius = Math.max(
    12,
    Math.min(size * 0.052, (size * 0.5 - coreRadius - outerPadding) / 6),
  );

  const innerR = coreRadius + orbRadius * 2.1;
  const outerR = size / 2 - outerPadding - orbRadius;
  const rings = Math.max(2, MAX_VISIBLE_DEPTH);
  const ringRadii: number[] = [];
  for (let i = 0; i < rings; i += 1) {
    const t = rings === 1 ? 0 : i / (rings - 1);
    ringRadii.push(innerR + (outerR - innerR) * t);
  }

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
 * Depths beyond the last guide ring are clamped just outside it.
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
      : lastRing + (depth - layout.ringRadii.length + 1) * layout.orbRadius * 2.2;
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
