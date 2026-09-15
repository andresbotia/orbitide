import type { Charge } from '@/game/engine/types';
import type { FlightPass } from './events';

/**
 * First compact presented-Holding index that is neither occupied nor already
 * reserved by an in-flight Pal that will land into Holding.
 * Presentation-only — does not touch engine Holding.
 */
export function reserveHoldingSlot(
  holding: readonly Charge[],
  pending: readonly FlightPass[],
  capacity: number,
): number {
  const taken = new Set<number>();
  for (let i = 0; i < holding.length; i += 1) taken.add(i);
  for (const pass of pending) {
    if (pass.endKind !== 'toHolding') continue;
    if (typeof pass.holdingSlotIndex !== 'number') continue;
    taken.add(pass.holdingSlotIndex);
  }
  const cap = capacity > 0 ? capacity : 1;
  for (let i = 0; i < cap; i += 1) {
    if (!taken.has(i)) return i;
  }
  return -1;
}
