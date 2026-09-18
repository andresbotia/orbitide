import { finalizePass, timedShot } from './buildScript';
import { CORE_V2_CONVOY_SPACING, FEEL } from './constants';
import type { ConvoyHold, FlightPass, Shot } from './events';
import { progressAt } from './motion';

/**
 * Core V2 convoy scheduler. Presentation-only: tap/launch order is the rail
 * order for the whole pass. A Pal that pauses to fire keeps its place; the
 * Pal behind dwells at a readable bumper until the Pal ahead moves again.
 *
 * Bakes extra dwells and retimes shots/events onto the follower's existing
 * `FlightPass` so worklets keep using `progressAt` with no per-PixelPal logic.
 * Engine targeting, queues, and capacities are untouched.
 */
export function applyCoreV2Convoy(follower: FlightPass, leaders: readonly FlightPass[]): FlightPass {
  const leader = pickLeader(leaders, follower);
  if (!leader) return follower;
  const { shots, holds: merged, orbitEndAt } = scheduleRail(follower, follower.shots, leader);
  const dt = orbitEndAt - follower.orbitEndAt;
  if (dt <= 0.5 && merged.length === 0 && shotTimesUnchanged(follower.shots, shots)) return follower;
  return retimedPass(follower, shots, merged, orbitEndAt);
}

/** Where a re-scheduled tail picks up: pass-clock time and rail progress. */
export interface RailResume { t: number; p: number }

export interface RailSchedule { shots: Shot[]; holds: ConvoyHold[]; orbitEndAt: number }

/**
 * Time `shots` (untimed or stale) along the rail from `resume` (default: orbit
 * start), dwelling behind `leader` when one is given. The single rail clock
 * used by the launch-time convoy and by tail re-scripting, so both keep the
 * same rail-order and bumper semantics.
 */
export function scheduleRail(
  pass: Pick<FlightPass, 'launchedAtMs' | 'liftMs' | 'orbitDurationMs' | 'endProgress' | 'terminal'>,
  original: readonly Shot[],
  leader: FlightPass | undefined,
  resume: RailResume = { t: pass.liftMs, p: 0 },
): RailSchedule {
  const offset = leader ? pass.launchedAtMs - leader.launchedAtMs : 0;
  const speed = 1 / pass.orbitDurationMs;
  const shotPause = FEEL.PIXEL_CLEAR_INTERVAL;
  const spacing = CORE_V2_CONVOY_SPACING;
  const endProgress = pass.endProgress;

  let t = resume.t;
  let p = resume.p;
  let shotI = 0;
  const holds: ConvoyHold[] = [];
  const shots: Shot[] = [];
  const maxT = t + pass.orbitDurationMs + 60_000;
  let steps = 0;

  while (t < maxT && steps < 8_000) {
    steps += 1;
    const shot = original[shotI];
    const leaderT = t + offset;
    const bumper = leader ? bumperProgress(leader, leaderT, spacing) : Number.NaN;
    const atBumper = Number.isFinite(bumper) && p >= bumper - 1e-9;

    if (leader && atBumper && (bumper < 0 || isDwelling(leader, leaderT))) {
      const wait = Math.max(1, msUntilBumperAhead(leader, leaderT, p, spacing));
      holds.push({ progress: p, startAt: t, endAt: t + wait });
      t += wait;
      continue;
    }

    if (shot && p >= shot.progress - 1e-9) {
      shots.push(timedShot(shot, t));
      t += shotPause;
      shotI += 1;
      continue;
    }
    if (p >= endProgress - 1e-9) break;

    const tOwnShot = shot ? (shot.progress - p) / speed : Number.POSITIVE_INFINITY;
    const tEnd = (endProgress - p) / speed;
    const tLeaderDwell = leader ? nextDwellStart(leader, leaderT) - leaderT : Number.POSITIVE_INFINITY;
    // Same speed as the leader: the bumper only closes while they are paused.
    // On the bumper, lockstep — never run past them to the exit or a later shot.
    let dt: number;
    if (atBumper) {
      dt = Math.min(tOwnShot, tLeaderDwell);
    } else {
      const tCatch = Number.isFinite(bumper) && bumper > p
        ? (bumper - p) / speed
        : Number.POSITIVE_INFINITY;
      dt = Math.min(tOwnShot, tEnd, tLeaderDwell, tCatch);
    }
    if (!Number.isFinite(dt) || dt <= 0) {
      holds.push({ progress: p, startAt: t, endAt: t + 1 });
      t += 1;
      continue;
    }
    p = Math.min(endProgress, p + speed * dt);
    t += dt;
  }

  // Drain any remaining contacts at the progress they already occupy.
  for (; shotI < original.length; shotI += 1) {
    shots.push(timedShot(original[shotI]!, t));
    t += shotPause;
  }

  const orbitEndAt = pass.terminal.kind === 'consumed' && shots.length > 0
    ? shots[shots.length - 1]!.clearAt
    : t;
  return { shots, holds: mergeHolds(holds), orbitEndAt };
}

function mergeHolds(holds: ConvoyHold[]): ConvoyHold[] {
  const out: ConvoyHold[] = [];
  for (const hold of holds) {
    if (hold.endAt - hold.startAt <= 0.5) continue;
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.progress - hold.progress) < 1e-9 && hold.startAt <= prev.endAt + 1.5) {
      prev.endAt = Math.max(prev.endAt, hold.endAt);
    } else {
      out.push({ ...hold });
    }
  }
  return out;
}

/** The Pal directly ahead on the rail when `follower` inserts, if any. */
export function pickLeader(leaders: readonly FlightPass[], follower: FlightPass): FlightPass | undefined {
  for (let i = leaders.length - 1; i >= 0; i -= 1) {
    const leader = leaders[i]!;
    if (leader.passId === follower.passId || leader.launchedAtMs <= 0) continue;
    const offset = follower.launchedAtMs - leader.launchedAtMs;
    if (offset < 0) continue;
    // Occupying the rail at the moment this Pal inserts. A Pal already in
    // Holding travel has left the perimeter and is no longer a bumper.
    if (offset + follower.liftMs < leader.orbitEndAt) return leader;
  }
  return undefined;
}

function bumperProgress(leader: FlightPass, leaderT: number, spacing: number): number {
  const L = leaderRailProgress(leader, leaderT);
  return L - spacing;
}

function isDwelling(pass: FlightPass, time: number): boolean {
  if (time < pass.liftMs || time >= pass.orbitEndAt) return false;
  for (const shot of pass.shots) {
    if (time < shot.anticipateAt) break;
    if (time <= shot.clearAt) return true;
  }
  for (const hold of pass.convoyHolds) {
    if (time < hold.startAt) break;
    if (time <= hold.endAt) return true;
  }
  return false;
}

function msUntilBumperAhead(leader: FlightPass, leaderT: number, followerP: number, spacing: number): number {
  const need = followerP + spacing;
  const L0 = leaderRailProgress(leader, leaderT);
  if (!Number.isFinite(L0) || L0 > need + 1e-12) return 0;
  let lo = leaderT;
  let hi = leader.orbitEndAt;
  for (let i = 0; i < 32; i += 1) {
    const mid = (lo + hi) / 2;
    const L = leaderRailProgress(leader, mid);
    if (!Number.isFinite(L) || L > need) hi = mid;
    else lo = mid;
  }
  return Math.max(0, hi - leaderT);
}

function leaderRailProgress(pass: FlightPass, time: number): number {
  if (time < pass.liftMs) return 0;
  if (time >= pass.orbitEndAt) return Number.POSITIVE_INFINITY;
  return progressAt(pass, time);
}

function nextDwellStart(pass: FlightPass, time: number): number {
  let next = Number.POSITIVE_INFINITY;
  for (const shot of pass.shots) {
    if (shot.anticipateAt > time && shot.anticipateAt < next) next = shot.anticipateAt;
  }
  for (const hold of pass.convoyHolds) {
    if (hold.startAt > time && hold.startAt < next) next = hold.startAt;
  }
  if (pass.orbitEndAt > time && pass.orbitEndAt < next) next = pass.orbitEndAt;
  return next;
}

function shotTimesUnchanged(a: Shot[], b: Shot[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]!.anticipateAt !== b[i]!.anticipateAt) return false;
  }
  return true;
}

function retimedPass(
  follower: FlightPass,
  shots: Shot[],
  convoyHolds: ConvoyHold[],
  orbitEndAt: number,
): FlightPass {
  const landingAt = follower.landingAt + (orbitEndAt - follower.orbitEndAt);
  return finalizePass({ ...follower, shots, convoyHolds, orbitEndAt, landingAt });
}
