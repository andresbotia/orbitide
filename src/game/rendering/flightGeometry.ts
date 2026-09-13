import { orbitFraction } from '@/game/engine/orbit';
import { progressAt } from '@/game/presentation/motion';
import { LAUNCH_HUB } from '@/game/presentation/constants';
import type { FlightPass } from '@/game/presentation/events';
import {
  normalizePerimeterProgress,
  pointAtRoundedPerimeterProgress,
  inwardNormalAtRoundedPerimeterProgress,
  tangentAtRoundedPerimeterProgress,
} from '@/game/geometry/roundedPerimeter';
import type { BoardGeometry, Point } from './boardGeometry';

/**
 * The single position function used by the rendered charge AND every projectile.
 *
 * Lift is split into the shared launch-hub choreography:
 *   source -> LAUNCH_HUB (APPROACH, ease-out)
 *          -> seat at LAUNCH_HUB (SEAT, held)
 *          -> ORBIT_INSERTION (TO_INSERTION, ease-in-out, radial)
 * then the orbit proper begins at ORBIT_INSERTION exactly at `time === liftMs`.
 *
 * Engine truth is untouched: the orbit still starts at ORBIT_INSERTION.
 */
export function flightPosition(
  pass: FlightPass,
  layout: BoardGeometry,
  time: number,
  radialOffset = 0,
): Point {
  'worklet';
  const hub = layout.launchHub;
  const insertion = layout.insertion;

  if (time < pass.liftMs) {
    const from = pass.from ?? { x: layout.center.x + (pass.sourceIndex - 1) * 80, y: layout.size + 50 };
    const seatStart = LAUNCH_HUB.APPROACH;
    const insertionStart = LAUNCH_HUB.APPROACH + LAUNCH_HUB.SEAT;

    if (time <= seatStart) {
      const p = Math.max(0, time / LAUNCH_HUB.APPROACH);
      const e = 1 - (1 - p) ** 2; // ease-out
      return { x: from.x + (hub.x - from.x) * e, y: from.y + (hub.y - from.y) * e };
    }
    if (time <= insertionStart) {
      return { x: hub.x, y: hub.y };
    }
    const p = Math.max(0, Math.min(1, (time - insertionStart) / LAUNCH_HUB.TO_INSERTION));
    const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2; // ease-in-out
    return { x: hub.x + (insertion.x - hub.x) * e, y: hub.y + (insertion.y - hub.y) * e };
  }

  // radialOffset is a presentation-only lane nudge so near-overlapping charges
  // stay readable; it never touches engine geometry (spec §12).
  let point: Point;
  if (layout.perimeter) {
    const t = normalizePerimeterProgress(orbitFraction(progressAt(pass, time)));
    const base = pointAtRoundedPerimeterProgress(layout.perimeter, t);
    if (radialOffset) {
      const inward = inwardNormalAtRoundedPerimeterProgress(layout.perimeter, t);
      point = { x: base.x - inward.x * radialOffset, y: base.y - inward.y * radialOffset };
    } else {
      point = base;
    }
  } else {
    const angle = orbitFraction(progressAt(pass, time)) * Math.PI * 2 - Math.PI / 2;
    point = { x: layout.center.x + Math.cos(angle) * (layout.orbit[0]!.rx + radialOffset),
      y: layout.center.y + Math.sin(angle) * (layout.orbit[0]!.ry + radialOffset) };
  }
  if (time > pass.orbitEndAt && pass.endKind === 'toHolding') {
    const to = pass.holdingTarget ?? { x: layout.center.x, y: layout.size + 100 };
    const p = Math.min(1, (time - pass.orbitEndAt) / (pass.landingAt - pass.orbitEndAt));
    return { x: point.x + (to.x - point.x) * p, y: point.y + (to.y - point.y) * p };
  }
  return point;
}

/**
 * Fractional lift phase for presentation effects (trail intensity, hub flash):
 * 0..1 across APPROACH, 1..2 across SEAT, 2..3 across TO_INSERTION, >=3 once
 * orbiting. Cheap, pure, worklet-safe.
 */
export function liftPhase(pass: FlightPass, time: number): number {
  'worklet';
  if (time >= pass.liftMs) return 3;
  const seatStart = LAUNCH_HUB.APPROACH;
  const insertionStart = LAUNCH_HUB.APPROACH + LAUNCH_HUB.SEAT;
  if (time <= seatStart) return time / LAUNCH_HUB.APPROACH;
  if (time <= insertionStart) return 1 + (time - seatStart) / LAUNCH_HUB.SEAT;
  return 2 + (time - insertionStart) / LAUNCH_HUB.TO_INSERTION;
}

/**
 * M5.3 — clockwise heading (radians) along the rounded perimeter at `time`,
 * for a Pixel Pal's "orientation follows perimeter travel". `0` (facing
 * +x, i.e. no rotation) for Legacy V1 geometry, which never orients its orb.
 */
export function flightHeading(pass: FlightPass, layout: BoardGeometry, time: number): number {
  'worklet';
  if (!layout.perimeter || time < pass.liftMs) return 0;
  const t = normalizePerimeterProgress(orbitFraction(progressAt(pass, time)));
  const tangent = tangentAtRoundedPerimeterProgress(layout.perimeter, t);
  return Math.atan2(tangent.y, tangent.x);
}

/** TUNABLE — presentation-only corner-lean cap for {@link flightBankDegrees}. */
const MAX_BANK_DEG = 9;
/** Small forward/back progress step used to sense curvature (corner vs straight). */
const BANK_SAMPLE_DELTA = 0.006;

/**
 * M5.3 — subtle bank/lean (degrees) through rounded corners: proportional to
 * how fast the heading is turning, so straight edges read as ~0deg and corner
 * arcs read as a gentle, capped lean. `0` for Legacy V1 geometry.
 */
export function flightBankDegrees(pass: FlightPass, layout: BoardGeometry, time: number): number {
  'worklet';
  if (!layout.perimeter || time < pass.liftMs) return 0;
  const t = normalizePerimeterProgress(orbitFraction(progressAt(pass, time)));
  const behind = normalizePerimeterProgress(t - BANK_SAMPLE_DELTA);
  const ahead = normalizePerimeterProgress(t + BANK_SAMPLE_DELTA);
  const a = tangentAtRoundedPerimeterProgress(layout.perimeter, behind);
  const b = tangentAtRoundedPerimeterProgress(layout.perimeter, ahead);
  let dTheta = Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x);
  if (dTheta > Math.PI) dTheta -= Math.PI * 2;
  if (dTheta < -Math.PI) dTheta += Math.PI * 2;
  const deg = (dTheta / (BANK_SAMPLE_DELTA * 2)) * (MAX_BANK_DEG / 90);
  return Math.max(-MAX_BANK_DEG, Math.min(MAX_BANK_DEG, deg));
}
