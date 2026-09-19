import { orbitFraction } from '@/game/engine/orbit';
import { progressAt } from '@/game/presentation/motion';
import { LAUNCH_HUB } from '@/game/presentation/constants';
import type { FlightPass } from '@/game/presentation/events';
import {
  normalizePerimeterProgress,
  pointAtMeasuredPerimeterProgress,
  inwardNormalAtMeasuredPerimeterProgress,
  tangentAtMeasuredPerimeterProgress,
  poseAtMeasuredPerimeterProgress,
} from '@/game/geometry/roundedPerimeter';
import type { BoardGeometry, Point } from './boardGeometry';
import { entryWaitEndAt, landingPose, railPoint } from './railPath';

/** TUNABLE — presentation-only corner-lean cap for {@link flightBankDegrees}. */
const MAX_BANK_DEG = 9;
/** Small forward/back progress step used to sense curvature (corner vs straight). */
const BANK_SAMPLE_DELTA = 0.006;
/**
 * TUNABLE — pass time at which the shell starts turning from upright toward
 * its rail heading; the turn eases in-out and completes exactly at `liftMs`.
 */
const LIFT_TURN_START_MS = LAUNCH_HUB.APPROACH / 2;
/** Progress step used to sample the rail velocity a Pal carries off the gate. */
const GATE_VELOCITY_DP = 0.002;

export interface FlightPose {
  x: number;
  y: number;
  heading: number;
  bank: number;
  /** 0 → 1 across the Gate → Holding flight; 0 everywhere else. */
  landing?: number;
}

/**
 * Position + heading + bank from one progress sample and precomputed numeric
 * perimeter metrics. This function is an exported worklet and must only call
 * other imported worklets — Reanimated does not copy private same-file
 * helpers onto the UI runtime.
 */
export function flightPose(
  pass: FlightPass,
  layout: BoardGeometry,
  time: number,
  radialOffset = 0,
): FlightPose {
  'worklet';
  const hub = layout.launchHub;
  const insertion = layout.insertion;

  if (time < pass.liftMs) {
    const from = pass.from ?? { x: layout.center.x + (pass.sourceIndex - 1) * 80, y: layout.size + 50 };
    const seatStart = LAUNCH_HUB.APPROACH;
    const insertionStart = LAUNCH_HUB.APPROACH + LAUNCH_HUB.SEAT;
    // The rail pose this Pal takes when the lift ends: its own lane (so the lift
    // lands exactly where the rail picks it up) and the rail heading the shell
    // turns toward during the lift instead of snapping to on the first rail frame.
    // A staged Pal (rail origin still occupied) enters upstream instead — see
    // `entryWaitEndAt` — so it never lands on the Pal ahead.
    const lifted = layout.perimeterMetrics;
    const entryAt = lifted ? entryWaitEndAt(pass) : pass.liftMs;
    const staged = entryAt > pass.liftMs;
    let entryX = insertion.x;
    let entryY = insertion.y;
    let entryHeading = 0;
    if (lifted) {
      const q = (pass.liftMs - entryAt) / pass.orbitDurationMs;
      const entry = poseAtMeasuredPerimeterProgress(lifted, normalizePerimeterProgress(orbitFraction(q)), radialOffset);
      if (radialOffset !== 0 || staged) { entryX = entry.x; entryY = entry.y; }
      // Rail headings live in (-π, π]; a bottom-edge entry is π. Turning to −π
      // instead is the same pose and makes the up-then-left turn anticlockwise.
      entryHeading = entry.heading > Math.PI - 1e-3 ? entry.heading - Math.PI * 2 : entry.heading;
    } else if (radialOffset !== 0) {
      const angle = orbitFraction(0) * Math.PI * 2 - Math.PI / 2;
      entryX = layout.center.x + Math.cos(angle) * (layout.orbit[0]!.rx + radialOffset);
      entryY = layout.center.y + Math.sin(angle) * (layout.orbit[0]!.ry + radialOffset);
    }
    const turnP = Math.max(0, Math.min(1, (time - LIFT_TURN_START_MS) / (pass.liftMs - LIFT_TURN_START_MS)));
    const heading = entryHeading * ((1 - Math.cos(Math.PI * turnP)) / 2);
    // A staged Pal approaches its upstream entry directly (the shared hub IS the
    // occupied origin on Core V2) and seats there; otherwise unchanged.
    const aimX = staged ? entryX : hub.x;
    const aimY = staged ? entryY : hub.y;
    if (time <= seatStart) {
      // Ease-in-out: the UI clock is anchored to the tap, so the first painted
      // frame lands a commit's worth of ms in — an ease-out start skipped a
      // large, visible chunk of the path there.
      const p = Math.max(0, time / LAUNCH_HUB.APPROACH);
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      return { x: from.x + (aimX - from.x) * e, y: from.y + (aimY - from.y) * e, heading, bank: 0 };
    }
    if (time <= insertionStart) {
      return { x: aimX, y: aimY, heading, bank: 0 };
    }
    const p = Math.max(0, Math.min(1, (time - insertionStart) / LAUNCH_HUB.TO_INSERTION));
    const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    return { x: aimX + (entryX - aimX) * e, y: aimY + (entryY - aimY) * e, heading, bank: 0 };
  }

  const metricsForEntry = layout.perimeterMetrics;
  if (metricsForEntry) {
    const entryAt = entryWaitEndAt(pass);
    if (time < entryAt) {
      // Staged: riding in upstream at rail speed, reaching the origin at `entryAt`.
      const pose = poseAtMeasuredPerimeterProgress(
        metricsForEntry,
        normalizePerimeterProgress(orbitFraction((time - entryAt) / pass.orbitDurationMs)),
        radialOffset,
      );
      return { x: pose.x, y: pose.y, heading: pose.heading, bank: pose.bank };
    }
  }

  const progress = progressAt(pass, time);
  const metrics = layout.perimeterMetrics;
  let x: number;
  let y: number;
  let heading = 0;
  let bank = 0;

  if (metrics) {
    const t = normalizePerimeterProgress(orbitFraction(progress));
    const pose = poseAtMeasuredPerimeterProgress(metrics, t, radialOffset);
    x = pose.x;
    y = pose.y;
    heading = pose.heading;
    bank = pose.bank;
  } else {
    const angle = orbitFraction(progress) * Math.PI * 2 - Math.PI / 2;
    x = layout.center.x + Math.cos(angle) * (layout.orbit[0]!.rx + radialOffset);
    y = layout.center.y + Math.sin(angle) * (layout.orbit[0]!.ry + radialOffset);
  }

  if (time > pass.orbitEndAt && pass.terminal.kind === 'toHolding') {
    if (metrics && progress < pass.endProgress - 1e-6) {
      return { x, y, heading, bank };
    }
    // GateTerminal -> exactly this Pal's slot. An unmeasured slot point keeps
    // the Pal at GateTerminal; there is no off-screen fallback target. A laned
    // Pal leaves from its own lane's gate point, where the rail left it, with
    // the rail's velocity, and the shell turns upright as it arrives.
    const from = metrics && radialOffset === 0 ? layout.gateTerminal : { x, y };
    const behind = railPoint(layout, pass.endProgress - GATE_VELOCITY_DP, radialOffset);
    const perMs = 1 / (GATE_VELOCITY_DP * pass.orbitDurationMs);
    const land = landingPose(pass, time, from.x, from.y, (from.x - behind.x) * perMs, (from.y - behind.y) * perMs);
    const e = land.s < 0.5 ? 2 * land.s * land.s : 1 - (-2 * land.s + 2) ** 2 / 2;
    return { x: land.x, y: land.y, heading: heading * (1 - e), bank: bank * (1 - e), landing: land.s };
  }
  return { x, y, heading, bank };
}

/**
 * The single position function used by the rendered charge AND every projectile.
 *
 * Lift is split into the shared launch-hub choreography:
 *   source -> LAUNCH_HUB (APPROACH, ease-in-out)
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
    // Same lane-true (and, when staged, upstream) rail entry as `flightPose`.
    const lifted = layout.perimeterMetrics;
    const entryAt = lifted ? entryWaitEndAt(pass) : pass.liftMs;
    const staged = entryAt > pass.liftMs;
    let entryX = insertion.x;
    let entryY = insertion.y;
    if (radialOffset !== 0 || staged) {
      if (lifted) {
        const q = (pass.liftMs - entryAt) / pass.orbitDurationMs;
        const entry = poseAtMeasuredPerimeterProgress(lifted, normalizePerimeterProgress(orbitFraction(q)), radialOffset);
        entryX = entry.x;
        entryY = entry.y;
      } else {
        const angle = orbitFraction(0) * Math.PI * 2 - Math.PI / 2;
        entryX = layout.center.x + Math.cos(angle) * (layout.orbit[0]!.rx + radialOffset);
        entryY = layout.center.y + Math.sin(angle) * (layout.orbit[0]!.ry + radialOffset);
      }
    }
    const aimX = staged ? entryX : hub.x;
    const aimY = staged ? entryY : hub.y;
    if (time <= seatStart) {
      const p = Math.max(0, time / LAUNCH_HUB.APPROACH);
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      return { x: from.x + (aimX - from.x) * e, y: from.y + (aimY - from.y) * e };
    }
    if (time <= insertionStart) {
      return { x: aimX, y: aimY };
    }
    const p = Math.max(0, Math.min(1, (time - insertionStart) / LAUNCH_HUB.TO_INSERTION));
    const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    return { x: aimX + (entryX - aimX) * e, y: aimY + (entryY - aimY) * e };
  }

  if (layout.perimeterMetrics) {
    const entryAt = entryWaitEndAt(pass);
    if (time < entryAt) {
      const upstream = railPoint(layout, (time - entryAt) / pass.orbitDurationMs, radialOffset);
      return { x: upstream.x, y: upstream.y };
    }
  }

  const progress = progressAt(pass, time);
  const metrics = layout.perimeterMetrics;
  let x: number;
  let y: number;

  if (metrics) {
    const t = normalizePerimeterProgress(orbitFraction(progress));
    const base = pointAtMeasuredPerimeterProgress(metrics, t);
    if (radialOffset) {
      const inward = inwardNormalAtMeasuredPerimeterProgress(metrics, t);
      x = base.x - inward.x * radialOffset;
      y = base.y - inward.y * radialOffset;
    } else {
      x = base.x;
      y = base.y;
    }
  } else {
    const angle = orbitFraction(progress) * Math.PI * 2 - Math.PI / 2;
    x = layout.center.x + Math.cos(angle) * (layout.orbit[0]!.rx + radialOffset);
    y = layout.center.y + Math.sin(angle) * (layout.orbit[0]!.ry + radialOffset);
  }

  if (time > pass.orbitEndAt && pass.terminal.kind === 'toHolding') {
    if (metrics && progress < pass.endProgress - 1e-6) return { x, y };
    const from = metrics && radialOffset === 0 ? layout.gateTerminal : { x, y };
    const behind = railPoint(layout, pass.endProgress - GATE_VELOCITY_DP, radialOffset);
    const perMs = 1 / (GATE_VELOCITY_DP * pass.orbitDurationMs);
    const land = landingPose(pass, time, from.x, from.y, (from.x - behind.x) * perMs, (from.y - behind.y) * perMs);
    return { x: land.x, y: land.y };
  }
  return { x, y };
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
  if (!layout.perimeterMetrics || time < pass.liftMs) return 0;
  const t = normalizePerimeterProgress(orbitFraction(progressAt(pass, time)));
  const tangent = tangentAtMeasuredPerimeterProgress(layout.perimeterMetrics, t);
  return Math.atan2(tangent.y, tangent.x);
}

/**
 * M5.3 — subtle bank/lean (degrees) through rounded corners: proportional to
 * how fast the heading is turning, so straight edges read as ~0deg and corner
 * arcs read as a gentle, capped lean. `0` for Legacy V1 geometry.
 */
export function flightBankDegrees(pass: FlightPass, layout: BoardGeometry, time: number): number {
  'worklet';
  if (!layout.perimeterMetrics || time < pass.liftMs) return 0;
  const t = normalizePerimeterProgress(orbitFraction(progressAt(pass, time)));
  const behind = normalizePerimeterProgress(t - BANK_SAMPLE_DELTA);
  const ahead = normalizePerimeterProgress(t + BANK_SAMPLE_DELTA);
  const a = tangentAtMeasuredPerimeterProgress(layout.perimeterMetrics, behind);
  const b = tangentAtMeasuredPerimeterProgress(layout.perimeterMetrics, ahead);
  let dTheta = Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x);
  if (dTheta > Math.PI) dTheta -= Math.PI * 2;
  if (dTheta < -Math.PI) dTheta += Math.PI * 2;
  const deg = (dTheta / (BANK_SAMPLE_DELTA * 2)) * (MAX_BANK_DEG / 90);
  return Math.max(-MAX_BANK_DEG, Math.min(MAX_BANK_DEG, deg));
}
