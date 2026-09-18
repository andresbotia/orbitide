import { CORE_V2_CONVOY_SPACING, FEEL } from './constants';
import type { ConvoyHold, FlightPass, PlaybackEvent, Shot } from './events';
import { progressAt } from './motion';

const SHOT_EVENT_KINDS: ReadonlySet<PlaybackEvent['kind']> = new Set([
  'pixelClear', 'frozenHit', 'shieldHit', 'linkPrime', 'linkGroupClear',
]);

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

  const offset = follower.launchedAtMs - leader.launchedAtMs;

  const speed = 1 / follower.orbitDurationMs;
  const shotPause = FEEL.PIXEL_CLEAR_INTERVAL;
  const spacing = CORE_V2_CONVOY_SPACING;
  const endProgress = follower.endProgress;
  const original = follower.shots;

  let t = follower.liftMs;
  let p = 0;
  let shotI = 0;
  const holds: ConvoyHold[] = [];
  const shots: Shot[] = [];
  const maxT = follower.liftMs + follower.orbitDurationMs + 60_000;
  let steps = 0;

  while (t < maxT && steps < 8_000) {
    steps += 1;
    const shot = original[shotI];
    const leaderT = t + offset;
    const bumper = bumperProgress(leader, leaderT, spacing);
    const atBumper = Number.isFinite(bumper) && p >= bumper - 1e-9;

    if (atBumper && (bumper < 0 || isDwelling(leader, leaderT))) {
      const wait = Math.max(1, msUntilBumperAhead(leader, leaderT, p, spacing));
      holds.push({ progress: p, startAt: t, endAt: t + wait });
      t += wait;
      continue;
    }

    if (shot && p >= shot.progress - 1e-9) {
      const anticipateAt = t;
      shots.push({
        ...shot,
        anticipateAt,
        fireAt: anticipateAt + FEEL.ANTICIPATION_DURATION,
        impactAt: anticipateAt + FEEL.ANTICIPATION_DURATION + FEEL.ENERGY_TRAVEL_DURATION,
        clearAt: anticipateAt + shotPause,
      });
      t += shotPause;
      shotI += 1;
      continue;
    }
    if (p >= endProgress - 1e-9) break;

    const tOwnShot = shot ? (shot.progress - p) / speed : Number.POSITIVE_INFINITY;
    const tEnd = (endProgress - p) / speed;
    const tLeaderDwell = nextDwellStart(leader, leaderT) - leaderT;
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

  if (shotI < original.length) {
    // Drain any remaining contacts at the progress they already occupy.
    for (; shotI < original.length; shotI += 1) {
      const shot = original[shotI]!;
      const anticipateAt = t;
      shots.push({
        ...shot,
        anticipateAt,
        fireAt: anticipateAt + FEEL.ANTICIPATION_DURATION,
        impactAt: anticipateAt + FEEL.ANTICIPATION_DURATION + FEEL.ENERGY_TRAVEL_DURATION,
        clearAt: anticipateAt + shotPause,
      });
      t += shotPause;
    }
  }

  const orbitEndAt = follower.endKind === 'burst' && shots.length > 0 && follower.endProgress < 1
    ? shots[shots.length - 1]!.clearAt
    : t;
  const dt = orbitEndAt - follower.orbitEndAt;
  const merged = mergeHolds(holds);
  if (dt <= 0.5 && merged.length === 0 && shotTimesUnchanged(original, shots)) return follower;

  return retimedPass(follower, shots, merged, orbitEndAt);
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

function pickLeader(leaders: readonly FlightPass[], follower: FlightPass): FlightPass | undefined {
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
  const dt = orbitEndAt - follower.orbitEndAt;
  const landingAt = follower.landingAt + dt;
  const totalMs = follower.totalMs + dt;
  let shotEvent = 0;
  const events: PlaybackEvent[] = follower.events.map((event) => {
    if (event.kind === 'orbitEnter') return event;
    if (SHOT_EVENT_KINDS.has(event.kind)) {
      const shot = shots[shotEvent];
      shotEvent += 1;
      return shot ? { ...event, at: shot.clearAt } : { ...event, at: event.at + dt };
    }
    if (event.kind === 'complete') return { ...event, at: totalMs };
    return { ...event, at: event.at + dt };
  });
  events.sort((a, b) => a.at - b.at);
  return { ...follower, shots, convoyHolds, orbitEndAt, landingAt, totalMs, events };
}
