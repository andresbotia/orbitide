/**
 * Pure rounded-rectangle perimeter geometry.
 *
 * Clockwise progress, Y-down (top-left origin). Progress is path-distance
 * along the perimeter, not an angle: equal Δprogress ⇒ equal arc length.
 *
 * Progress 0 is the top-center of the bounds (12 o'clock). Values wrap into
 * `[0, 1)`. Bottom-center is always `0.5` (180° rotational symmetry).
 *
 * Segment order from progress 0, clockwise:
 *   top → topRight → right → bottomRight → bottom → bottomLeft → left → topLeft
 *
 * Corner arcs use Y-down atan2 angles, increasing clockwise:
 *   topRight −π/2→0, bottomRight 0→π/2, bottomLeft π/2→π, topLeft π→3π/2.
 *
 * Inward normals: axis-aligned on straight edges; on arcs, toward that
 * corner's circle centre (the interior).
 *
 * This module is geometry only. It is not wired into targeting, flight, or
 * the rendered rail — those stay circular until a later phase.
 */

export interface Point {
  x: number;
  y: number;
}

export interface RoundedPerimeterBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

export type RoundedPerimeterSegment =
  | 'top'
  | 'topRight'
  | 'right'
  | 'bottomRight'
  | 'bottom'
  | 'bottomLeft'
  | 'left'
  | 'topLeft';

/**
 * Bottom-center of any rounded rectangle, as normalized progress.
 * Always ½: opposite side-centers split the path equally.
 */
export const ROUNDED_PERIMETER_BOTTOM_CENTER_PROGRESS = 0.5;

const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;

function nonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Wrap any real progress onto `[0, 1)`. `1` and integers map to `0`. */
export function normalizePerimeterProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  let wrapped = progress % 1;
  if (wrapped < 0) wrapped += 1;
  return wrapped === 0 ? 0 : wrapped;
}

/**
 * Corner radius is clamped into `[0, min(width, height) / 2]`.
 * Non-finite or negative input becomes 0; oversized input is truncated.
 * Invalid (non-positive) dimensions yield 0.
 */
export function clampCornerRadius(width: number, height: number, radius: number): number {
  const max = Math.min(nonNegative(width), nonNegative(height)) / 2;
  if (!Number.isFinite(radius) || radius <= 0 || max <= 0) return 0;
  return radius < max ? radius : max;
}

export function roundedPerimeterLength(bounds: RoundedPerimeterBounds): number {
  return createRoundedPerimeterGeometry(bounds).length;
}

export function pointAtRoundedPerimeterProgress(
  bounds: RoundedPerimeterBounds,
  progress: number,
): Point {
  return createRoundedPerimeterGeometry(bounds).pointAt(progress);
}

export function inwardNormalAtRoundedPerimeterProgress(
  bounds: RoundedPerimeterBounds,
  progress: number,
): Point {
  return createRoundedPerimeterGeometry(bounds).inwardNormalAt(progress);
}

export function tangentAtRoundedPerimeterProgress(
  bounds: RoundedPerimeterBounds,
  progress: number,
): Point {
  return createRoundedPerimeterGeometry(bounds).tangentAt(progress);
}

export function segmentAtRoundedPerimeterProgress(
  bounds: RoundedPerimeterBounds,
  progress: number,
): RoundedPerimeterSegment {
  return createRoundedPerimeterGeometry(bounds).segmentAt(progress);
}

export function bottomCenterPerimeterProgress(bounds: RoundedPerimeterBounds): number {
  return createRoundedPerimeterGeometry(bounds).bottomCenterProgress;
}

interface Part {
  id: RoundedPerimeterSegment;
  length: number;
}

export interface RoundedPerimeterGeometry {
  readonly bounds: Readonly<RoundedPerimeterBounds>;
  readonly length: number;
  /** Always {@link ROUNDED_PERIMETER_BOTTOM_CENTER_PROGRESS} (`0.5`). */
  readonly bottomCenterProgress: number;
  pointAt(progress: number): Point;
  inwardNormalAt(progress: number): Point;
  /** Clockwise unit tangent. */
  tangentAt(progress: number): Point;
  segmentAt(progress: number): RoundedPerimeterSegment;
}

export function createRoundedPerimeterGeometry(
  bounds: RoundedPerimeterBounds,
): RoundedPerimeterGeometry {
  const x = Number.isFinite(bounds.x) ? bounds.x : 0;
  const y = Number.isFinite(bounds.y) ? bounds.y : 0;
  const width = nonNegative(bounds.width);
  const height = nonNegative(bounds.height);
  const radius = clampCornerRadius(width, height, bounds.radius);

  const straightH = Math.max(0, width - 2 * radius);
  const straightV = Math.max(0, height - 2 * radius);
  const arc = radius > 0 ? HALF_PI * radius : 0;
  const halfH = straightH / 2;
  const length = 2 * straightH + 2 * straightV + TWO_PI * radius;

  const cxTR = x + width - radius;
  const cyTR = y + radius;
  const cxBR = x + width - radius;
  const cyBR = y + height - radius;
  const cxBL = x + radius;
  const cyBL = y + height - radius;
  const cxTL = x + radius;
  const cyTL = y + radius;

  // Progress 0 = top-center. The top edge is split across the wrap.
  const parts: readonly Part[] = [
    { id: 'top', length: halfH },
    { id: 'topRight', length: arc },
    { id: 'right', length: straightV },
    { id: 'bottomRight', length: arc },
    { id: 'bottom', length: straightH },
    { id: 'bottomLeft', length: arc },
    { id: 'left', length: straightV },
    { id: 'topLeft', length: arc },
    { id: 'top', length: halfH },
  ];

  const normalized: RoundedPerimeterBounds = { x, y, width, height, radius };

  const locate = (progress: number): { part: Part; index: number; t: number } => {
    const dist = length > 0 ? normalizePerimeterProgress(progress) * length : 0;
    let remaining = dist;
    const last = parts.length - 1;
    for (let i = 0; i <= last; i += 1) {
      const part = parts[i]!;
      if (i === last || remaining <= part.length) {
        const t = part.length > 0 ? Math.min(1, Math.max(0, remaining / part.length)) : 0;
        return { part, index: i, t };
      }
      remaining -= part.length;
    }
    return { part: parts[0]!, index: 0, t: 0 };
  };

  const pointOn = (index: number, t: number): Point => {
    switch (index) {
      case 0: // top, center → right end
        return { x: x + width / 2 + t * halfH, y };
      case 1: { // topRight −π/2 → 0
        const theta = -HALF_PI + t * HALF_PI;
        return { x: cxTR + radius * Math.cos(theta), y: cyTR + radius * Math.sin(theta) };
      }
      case 2: // right, top → bottom
        return { x: x + width, y: y + radius + t * straightV };
      case 3: { // bottomRight 0 → π/2
        const theta = t * HALF_PI;
        return { x: cxBR + radius * Math.cos(theta), y: cyBR + radius * Math.sin(theta) };
      }
      case 4: // bottom, right → left
        return { x: x + width - radius - t * straightH, y: y + height };
      case 5: { // bottomLeft π/2 → π
        const theta = HALF_PI + t * HALF_PI;
        return { x: cxBL + radius * Math.cos(theta), y: cyBL + radius * Math.sin(theta) };
      }
      case 6: // left, bottom → top
        return { x, y: y + height - radius - t * straightV };
      case 7: { // topLeft π → 3π/2
        const theta = Math.PI + t * HALF_PI;
        return { x: cxTL + radius * Math.cos(theta), y: cyTL + radius * Math.sin(theta) };
      }
      default: // top, left end → center
        return { x: x + radius + t * halfH, y };
    }
  };

  const inwardOn = (index: number, t: number): Point => {
    switch (index) {
      case 0:
      case 8:
        return { x: 0, y: 1 };
      case 2:
        return { x: -1, y: 0 };
      case 4:
        return { x: 0, y: -1 };
      case 6:
        return { x: 1, y: 0 };
      case 1: {
        const theta = -HALF_PI + t * HALF_PI;
        return { x: -Math.cos(theta), y: -Math.sin(theta) };
      }
      case 3: {
        const theta = t * HALF_PI;
        return { x: -Math.cos(theta), y: -Math.sin(theta) };
      }
      case 5: {
        const theta = HALF_PI + t * HALF_PI;
        return { x: -Math.cos(theta), y: -Math.sin(theta) };
      }
      default: {
        const theta = Math.PI + t * HALF_PI;
        return { x: -Math.cos(theta), y: -Math.sin(theta) };
      }
    }
  };

  const tangentOn = (index: number, t: number): Point => {
    switch (index) {
      case 0:
      case 8:
        return { x: 1, y: 0 };
      case 2:
        return { x: 0, y: 1 };
      case 4:
        return { x: -1, y: 0 };
      case 6:
        return { x: 0, y: -1 };
      case 1: {
        const theta = -HALF_PI + t * HALF_PI;
        return { x: -Math.sin(theta), y: Math.cos(theta) };
      }
      case 3: {
        const theta = t * HALF_PI;
        return { x: -Math.sin(theta), y: Math.cos(theta) };
      }
      case 5: {
        const theta = HALF_PI + t * HALF_PI;
        return { x: -Math.sin(theta), y: Math.cos(theta) };
      }
      default: {
        const theta = Math.PI + t * HALF_PI;
        return { x: -Math.sin(theta), y: Math.cos(theta) };
      }
    }
  };

  return {
    bounds: normalized,
    length,
    bottomCenterProgress: ROUNDED_PERIMETER_BOTTOM_CENTER_PROGRESS,
    pointAt(progress: number): Point {
      if (length <= 0) return { x, y };
      const { index, t } = locate(progress);
      return pointOn(index, t);
    },
    inwardNormalAt(progress: number): Point {
      if (length <= 0) return { x: 0, y: 1 };
      const { index, t } = locate(progress);
      return inwardOn(index, t);
    },
    tangentAt(progress: number): Point {
      if (length <= 0) return { x: 1, y: 0 };
      const { index, t } = locate(progress);
      return tangentOn(index, t);
    },
    segmentAt(progress: number): RoundedPerimeterSegment {
      if (length <= 0) return 'top';
      return locate(progress).part.id;
    },
  };
}
