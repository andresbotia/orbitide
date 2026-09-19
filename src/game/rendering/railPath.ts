import { orbitFraction } from '@/game/engine/orbit';
import { normalizePerimeterProgress, poseAtMeasuredPerimeterProgress } from '@/game/geometry/roundedPerimeter';
import { HOLDING_RETARGET_MIN_MS } from '@/game/presentation/constants';
import type { FlightPass, Point } from '@/game/presentation/events';
import type { BoardGeometry } from './boardGeometry';

/**
 * Rail + Gate → Holding path worklets shared by `flightGeometry`. They live in
 * their own module because worklets may only call imported worklets.
 */

/** Rail point at `progress` in a Pal's radial lane (rounded perimeter or circle). */
export function railPoint(layout: BoardGeometry, progress: number, radialOffset: number): Point {
  'worklet';
  const metrics = layout.perimeterMetrics;
  if (metrics) {
    const pose = poseAtMeasuredPerimeterProgress(metrics, normalizePerimeterProgress(orbitFraction(progress)), radialOffset);
    return { x: pose.x, y: pose.y };
  }
  const angle = orbitFraction(progress) * Math.PI * 2 - Math.PI / 2;
  return {
    x: layout.center.x + Math.cos(angle) * (layout.orbit[0]!.rx + radialOffset),
    y: layout.center.y + Math.sin(angle) * (layout.orbit[0]!.ry + radialOffset),
  };
}

export interface LandingSample {
  x: number;
  y: number;
  /** 0 → 1 across the whole Gate → slot flight (drives turn-upright and grow). */
  s: number;
}

/**
 * Gate → exact Holding slot, as a cubic Hermite leg: it leaves the gate with
 * the rail's own velocity `(v0x, v0y)` px/ms (no speed or direction snap off
 * the rail) and arrives at rest on the slot (an arrival ease, not a linear
 * slide). A retarget starts a new leg from the position AND velocity the Pal
 * had on the previous leg at the retarget instant, so the path never jumps.
 * Without a measured slot the Pal holds exactly where it left the rail.
 */
export function landingPose(pass: FlightPass, time: number, fromX: number, fromY: number, v0x: number, v0y: number): LandingSample {
  'worklet';
  const terminal = pass.terminal;
  const retargets = terminal.kind === 'toHolding' && terminal.retargets !== undefined ? terminal.retargets : [];
  const finalTarget = terminal.kind === 'toHolding' ? terminal.target : undefined;
  const legs = retargets.length;
  const arrival = legs > 0
    ? Math.max(pass.landingAt, retargets[legs - 1]!.at + HOLDING_RETARGET_MIN_MS)
    : pass.landingAt;
  const s = Math.max(0, Math.min(1, (time - pass.orbitEndAt) / Math.max(1, arrival - pass.orbitEndAt)));

  let px = fromX;
  let py = fromY;
  let vx = v0x;
  let vy = v0y;
  let t0 = pass.orbitEndAt;
  for (let i = 0; i <= legs; i += 1) {
    const last = i === legs;
    const target = last ? finalTarget : retargets[i]!.target;
    const t1 = Math.max(pass.landingAt, t0 + HOLDING_RETARGET_MIN_MS);
    const until = last ? time : Math.min(time, retargets[i]!.at);
    let x = px;
    let y = py;
    let dx = 0;
    let dy = 0;
    if (target !== undefined) {
      const T = Math.max(1, t1 - t0);
      const u = Math.max(0, Math.min(1, (until - t0) / T));
      const u2 = u * u;
      const u3 = u2 * u;
      const h00 = 2 * u3 - 3 * u2 + 1;
      const h10 = u3 - 2 * u2 + u;
      const h01 = -2 * u3 + 3 * u2;
      x = h00 * px + h10 * T * vx + h01 * target.x;
      y = h00 * py + h10 * T * vy + h01 * target.y;
      if (u < 1) {
        const d00 = 6 * u2 - 6 * u;
        const d10 = 3 * u2 - 4 * u + 1;
        const d01 = -6 * u2 + 6 * u;
        dx = (d00 * px + d01 * target.x) / T + d10 * vx;
        dy = (d00 * py + d01 * target.y) / T + d10 * vy;
      }
    }
    if (last || time <= retargets[i]!.at) return { x, y, s };
    px = x;
    py = y;
    vx = dx;
    vy = dy;
    t0 = retargets[i]!.at;
  }
  return { x: px, y: py, s };
}

/**
 * Rail-entry staging (presentation only).
 *
 * When the rail origin is still occupied, the convoy scheduler makes a new Pal
 * wait there (a hold at progress 0 starting exactly at `liftMs`) — which drew
 * it ON TOP of the Pal ahead. Instead, for that wait the Pal is drawn upstream
 * on the rail at `(t - entryAt) / lap`: it rides in at normal rail speed and
 * reaches the origin exactly when its logical wait ends, then continues on its
 * unchanged schedule. The scheduler guarantees `entryAt` is at least one convoy
 * spacing (at rail speed) after the Pal ahead left the origin, so staged Pals
 * keep the convoy's own spacing from each other and from the Pal ahead.
 *
 * Returns the end of that wait (== `liftMs` when there is none).
 */
export function entryWaitEndAt(pass: FlightPass): number {
  'worklet';
  const holds = pass.convoyHolds;
  if (holds === undefined || holds.length === 0) return pass.liftMs;
  const first = holds[0]!;
  if (first.progress > 1e-9 || Math.abs(first.startAt - pass.liftMs) > 0.5) return pass.liftMs;
  return first.endAt;
}
