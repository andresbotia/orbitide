import { FEEL } from './constants';
import type { FlightPass } from './events';
/** Shared by the token and projectile. No independent timers or angle guesses. */
export function progressAt(pass: FlightPass, time: number): number {
  'worklet';
  let paused = 0;
  for (const shot of pass.shots) {
    if (time < shot.anticipateAt) break;
    if (time <= shot.clearAt) return shot.progress;
    paused += FEEL.PIXEL_CLEAR_INTERVAL;
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
