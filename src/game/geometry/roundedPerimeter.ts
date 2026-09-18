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
  'worklet';
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Wrap any real progress onto `[0, 1)`. `1` and integers map to `0`. */
export function normalizePerimeterProgress(progress: number): number {
  'worklet';
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
  'worklet';
  const max = Math.min(nonNegative(width), nonNegative(height)) / 2;
  if (!Number.isFinite(radius) || radius <= 0 || max <= 0) return 0;
  return radius < max ? radius : max;
}

/** Flattened path metrics. Safe to capture in worklets; no methods. */
export interface RoundedPerimeterMetrics {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  straightH: number;
  straightV: number;
  arc: number;
  halfH: number;
  length: number;
  cxTR: number;
  cyTR: number;
  cxBR: number;
  cyBR: number;
  cxBL: number;
  cyBL: number;
  cxTL: number;
  cyTL: number;
}

type PerimeterMetrics = RoundedPerimeterMetrics;

interface LocatedSegment {
  index: number;
  t: number;
}

/** Plain numeric layout. Worklet-safe; no function objects. */
export function measureRoundedPerimeter(bounds: RoundedPerimeterBounds): RoundedPerimeterMetrics {
  'worklet';
  const x = Number.isFinite(bounds.x) ? bounds.x : 0;
  const y = Number.isFinite(bounds.y) ? bounds.y : 0;
  const width = nonNegative(bounds.width);
  const height = nonNegative(bounds.height);
  const radius = clampCornerRadius(width, height, bounds.radius);
  const straightH = Math.max(0, width - 2 * radius);
  const straightV = Math.max(0, height - 2 * radius);
  const arc = radius > 0 ? HALF_PI * radius : 0;
  const halfH = straightH / 2;
  return {
    x,
    y,
    width,
    height,
    radius,
    straightH,
    straightV,
    arc,
    halfH,
    length: 2 * straightH + 2 * straightV + TWO_PI * radius,
    cxTR: x + width - radius,
    cyTR: y + radius,
    cxBR: x + width - radius,
    cyBR: y + height - radius,
    cxBL: x + radius,
    cyBL: y + height - radius,
    cxTL: x + radius,
    cyTL: y + radius,
  };
}

function partLength(m: PerimeterMetrics, index: number): number {
  'worklet';
  if (index === 0 || index === 8) return m.halfH;
  if (index === 2 || index === 6) return m.straightV;
  if (index === 4) return m.straightH;
  return m.arc;
}

function locateOnPerimeter(m: PerimeterMetrics, progress: number): LocatedSegment {
  'worklet';
  const dist = m.length > 0 ? normalizePerimeterProgress(progress) * m.length : 0;
  let remaining = dist;
  const last = 8;
  for (let i = 0; i <= last; i += 1) {
    const length = partLength(m, i);
    if (i === last || remaining <= length) {
      const t = length > 0 ? Math.min(1, Math.max(0, remaining / length)) : 0;
      return { index: i, t };
    }
    remaining -= length;
  }
  return { index: 0, t: 0 };
}

function pointOnPerimeter(m: PerimeterMetrics, index: number, t: number): Point {
  'worklet';
  switch (index) {
    case 0: // top, center → right end
      return { x: m.x + m.width / 2 + t * m.halfH, y: m.y };
    case 1: { // topRight −π/2 → 0
      const theta = -HALF_PI + t * HALF_PI;
      return { x: m.cxTR + m.radius * Math.cos(theta), y: m.cyTR + m.radius * Math.sin(theta) };
    }
    case 2: // right, top → bottom
      return { x: m.x + m.width, y: m.y + m.radius + t * m.straightV };
    case 3: { // bottomRight 0 → π/2
      const theta = t * HALF_PI;
      return { x: m.cxBR + m.radius * Math.cos(theta), y: m.cyBR + m.radius * Math.sin(theta) };
    }
    case 4: // bottom, right → left
      return { x: m.x + m.width - m.radius - t * m.straightH, y: m.y + m.height };
    case 5: { // bottomLeft π/2 → π
      const theta = HALF_PI + t * HALF_PI;
      return { x: m.cxBL + m.radius * Math.cos(theta), y: m.cyBL + m.radius * Math.sin(theta) };
    }
    case 6: // left, bottom → top
      return { x: m.x, y: m.y + m.height - m.radius - t * m.straightV };
    case 7: { // topLeft π → 3π/2
      const theta = Math.PI + t * HALF_PI;
      return { x: m.cxTL + m.radius * Math.cos(theta), y: m.cyTL + m.radius * Math.sin(theta) };
    }
    default: // top, left end → center
      return { x: m.x + m.radius + t * m.halfH, y: m.y };
  }
}

function inwardOnPerimeter(m: PerimeterMetrics, index: number, t: number): Point {
  'worklet';
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
}

function tangentOnPerimeter(m: PerimeterMetrics, index: number, t: number): Point {
  'worklet';
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
}

export function roundedPerimeterLength(bounds: RoundedPerimeterBounds): number {
  return createRoundedPerimeterGeometry(bounds).length;
}

export function pointAtMeasuredPerimeterProgress(
  m: RoundedPerimeterMetrics,
  progress: number,
): Point {
  'worklet';
  if (m.length <= 0) return { x: m.x, y: m.y };
  const loc = locateOnPerimeter(m, progress);
  return pointOnPerimeter(m, loc.index, loc.t);
}

export function inwardNormalAtMeasuredPerimeterProgress(
  m: RoundedPerimeterMetrics,
  progress: number,
): Point {
  'worklet';
  if (m.length <= 0) return { x: 0, y: 1 };
  const loc = locateOnPerimeter(m, progress);
  return inwardOnPerimeter(m, loc.index, loc.t);
}

export function tangentAtMeasuredPerimeterProgress(
  m: RoundedPerimeterMetrics,
  progress: number,
): Point {
  'worklet';
  if (m.length <= 0) return { x: 1, y: 0 };
  const loc = locateOnPerimeter(m, progress);
  return tangentOnPerimeter(m, loc.index, loc.t);
}

export interface MeasuredPerimeterPose {
  x: number;
  y: number;
  heading: number;
  bank: number;
}

/**
 * Single-pass position + heading + bank.
 * Avoids 5 redundant locateOnPerimeter traversals per Pal per frame by sharing
 * the segment lookup and skipping bank math on pure straight sections.
 */
export function poseAtMeasuredPerimeterProgress(
  m: RoundedPerimeterMetrics,
  progress: number,
  radialOffset = 0,
): MeasuredPerimeterPose {
  'worklet';
  if (m.length <= 0) return { x: m.x, y: m.y, heading: 0, bank: 0 };
  const loc = locateOnPerimeter(m, progress);
  const base = pointOnPerimeter(m, loc.index, loc.t);
  let x = base.x;
  let y = base.y;
  if (radialOffset !== 0) {
    const inward = inwardOnPerimeter(m, loc.index, loc.t);
    x -= inward.x * radialOffset;
    y -= inward.y * radialOffset;
  }
  const tangent = tangentOnPerimeter(m, loc.index, loc.t);
  const heading = Math.atan2(tangent.y, tangent.x);

  let bank = 0;
  // Corner arc indices are 1, 3, 5, 7. Straight edges are 0, 2, 4, 6, 8.
  const isCorner = loc.index % 2 === 1;
  const delta = 0.006;
  // Banking is only ever non-zero on a corner arc or within `delta` of one.
  // The previous guard was `isCorner || m.arc > 0`, and `m.arc` is > 0 for every
  // rounded board, so the two extra perimeter lookups and two atan2 calls below
  // ran on every frame of every straight edge — roughly 70% of the lap, per Pal,
  // at 60fps — only to produce the 0 this now returns directly. Same output.
  const segment = partLength(m, loc.index);
  const reach = delta * m.length;
  const nearBoundary = loc.t * segment <= reach || (1 - loc.t) * segment <= reach;
  if (isCorner || nearBoundary) {
    const behind = normalizePerimeterProgress(progress - delta);
    const ahead = normalizePerimeterProgress(progress + delta);
    const locA = locateOnPerimeter(m, behind);
    const locB = locateOnPerimeter(m, ahead);
    if (locA.index !== locB.index || locA.index % 2 === 1) {
      const a = tangentOnPerimeter(m, locA.index, locA.t);
      const b = tangentOnPerimeter(m, locB.index, locB.t);
      let dTheta = Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x);
      if (dTheta > Math.PI) dTheta -= Math.PI * 2;
      if (dTheta < -Math.PI) dTheta += Math.PI * 2;
      const deg = (dTheta / (delta * 2)) * 0.1; // 9 / 90 = 0.1
      bank = Math.max(-9, Math.min(9, deg));
    }
  }

  return { x, y, heading, bank };
}

export function pointAtRoundedPerimeterProgress(
  bounds: RoundedPerimeterBounds,
  progress: number,
): Point {
  'worklet';
  return pointAtMeasuredPerimeterProgress(measureRoundedPerimeter(bounds), progress);
}

export function inwardNormalAtRoundedPerimeterProgress(
  bounds: RoundedPerimeterBounds,
  progress: number,
): Point {
  'worklet';
  return inwardNormalAtMeasuredPerimeterProgress(measureRoundedPerimeter(bounds), progress);
}

export function tangentAtRoundedPerimeterProgress(
  bounds: RoundedPerimeterBounds,
  progress: number,
): Point {
  'worklet';
  return tangentAtMeasuredPerimeterProgress(measureRoundedPerimeter(bounds), progress);
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
  const m = measureRoundedPerimeter(bounds);
  const { x, y, width, height, radius, length } = m;
  const parts: readonly Part[] = [
    { id: 'top', length: m.halfH },
    { id: 'topRight', length: m.arc },
    { id: 'right', length: m.straightV },
    { id: 'bottomRight', length: m.arc },
    { id: 'bottom', length: m.straightH },
    { id: 'bottomLeft', length: m.arc },
    { id: 'left', length: m.straightV },
    { id: 'topLeft', length: m.arc },
    { id: 'top', length: m.halfH },
  ];
  const normalized: RoundedPerimeterBounds = { x, y, width, height, radius };
  return {
    bounds: normalized,
    length,
    bottomCenterProgress: ROUNDED_PERIMETER_BOTTOM_CENTER_PROGRESS,
    pointAt(progress: number): Point {
      if (length <= 0) return { x, y };
      const loc = locateOnPerimeter(m, progress);
      return pointOnPerimeter(m, loc.index, loc.t);
    },
    inwardNormalAt(progress: number): Point {
      if (length <= 0) return { x: 0, y: 1 };
      const loc = locateOnPerimeter(m, progress);
      return inwardOnPerimeter(m, loc.index, loc.t);
    },
    tangentAt(progress: number): Point {
      if (length <= 0) return { x: 1, y: 0 };
      const loc = locateOnPerimeter(m, progress);
      return tangentOnPerimeter(m, loc.index, loc.t);
    },
    segmentAt(progress: number): RoundedPerimeterSegment {
      if (length <= 0) return 'top';
      return parts[locateOnPerimeter(m, progress).index]!.id;
    },
  };
}
