import { FEEL, HOLDING_HANDOFF_HOLD_MS, HOLDING_HANDOFF_MS, HOLDING_RETARGET_MIN_MS } from './constants';
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
/**
 * When a toHolding Pal visibly reaches its slot: the logical `landingAt`, or
 * later when a late retarget needs its minimum glide. Logical Holding timing
 * (`holdingLanded`) never moves.
 */
export function landingArrivalAt(pass: FlightPass): number {
  'worklet';
  if (pass.terminal.kind !== 'toHolding') return pass.landingAt;
  const retargets = pass.terminal.retargets;
  if (retargets === undefined || retargets.length === 0) return pass.landingAt;
  return Math.max(pass.landingAt, retargets[retargets.length - 1]!.at + HOLDING_RETARGET_MIN_MS);
}
/**
 * When a flight's UI clock stops. A toHolding Pal keeps presenting through the
 * Holding handoff window; everything else stops at its script's end.
 */
export function presentationEndMs(pass: FlightPass): number {
  return pass.terminal.kind === 'toHolding'
    ? Math.max(pass.totalMs, landingArrivalAt(pass) + HOLDING_HANDOFF_MS)
    : pass.totalMs;
}
/** Opacity of a landed toHolding Pal across the Holding handoff (1 before arrival). */
export function holdingHandoffOpacity(pass: FlightPass, time: number): number {
  'worklet';
  // Same as `landingArrivalAt`, inlined: worklets here only call imported worklets.
  let arrival = pass.landingAt;
  const retargets = pass.terminal.kind === 'toHolding' ? pass.terminal.retargets : undefined;
  if (retargets !== undefined && retargets.length > 0) {
    arrival = Math.max(arrival, retargets[retargets.length - 1]!.at + HOLDING_RETARGET_MIN_MS);
  }
  const since = time - arrival;
  if (since < HOLDING_HANDOFF_HOLD_MS) return 1;
  return Math.max(0, 1 - (since - HOLDING_HANDOFF_HOLD_MS) / (HOLDING_HANDOFF_MS - HOLDING_HANDOFF_HOLD_MS));
}
