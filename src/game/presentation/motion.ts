import { FEEL } from './constants';
import type { FlightPass } from './events';
/** Shared by the token and projectile. No independent timers or angle guesses. */
export function progressAt(pass: FlightPass, time: number): number {
  'worklet';
  let paused = 0;
  const holds = pass.convoyHolds;
  if (holds === undefined || holds.length === 0) {
    for (const shot of pass.shots) {
      if (time < shot.anticipateAt) break;
      if (time <= shot.clearAt) return shot.progress;
      paused += FEEL.PIXEL_CLEAR_INTERVAL;
    }
    return Math.max(0, Math.min(pass.endProgress, (time - pass.liftMs - paused) / pass.orbitDurationMs));
  }

  let si = 0;
  let hi = 0;
  const nShots = pass.shots.length;
  const nHolds = holds.length;
  while (si < nShots || hi < nHolds) {
    const shot = si < nShots ? pass.shots[si] : undefined;
    const hold = hi < nHolds ? holds[hi] : undefined;
    const shotAt = shot !== undefined ? shot.anticipateAt : Number.POSITIVE_INFINITY;
    const holdAt = hold !== undefined ? hold.startAt : Number.POSITIVE_INFINITY;
    if (shot !== undefined && shotAt <= holdAt) {
      if (time < shot.anticipateAt) break;
      if (time <= shot.clearAt) return shot.progress;
      paused += FEEL.PIXEL_CLEAR_INTERVAL;
      si += 1;
    } else if (hold !== undefined) {
      if (time < hold.startAt) break;
      if (time <= hold.endAt) return hold.progress;
      paused += hold.endAt - hold.startAt;
      hi += 1;
    } else {
      break;
    }
  }
  return Math.max(0, Math.min(pass.endProgress, (time - pass.liftMs - paused) / pass.orbitDurationMs));
}
export function capacityAt(pass: FlightPass, time: number): number {
  'worklet';
  let remaining = pass.charge.capacity;
  for (const shot of pass.shots) {
    if (time < shot.clearAt) break;
    remaining = shot.remaining;
  }
  return remaining;
}
export function eventCountAt(pass: FlightPass, time: number): number {
  'worklet';
  let count = 0;
  for (const event of pass.events) { if (event.at <= time) count++; else break; }
  return count;
}
