import type { Charge } from '@/game/engine/types';
import type { FlightPass } from './events';

/**
 * The one slot model: a Pal's Holding slot is its index in reconciled truth
 * Holding (-1 when truth does not keep it). Never derived from launch-time
 * reservations.
 */
export function holdingSlotFor(holding: readonly Charge[], chargeId: string): number {
  return holding.findIndex((c) => c.id === chargeId);
}

/**
 * Presented Holding after `landed` Pals have arrived: extend the presented
 * prefix with truth's next occupants, in slot order, while each has landed.
 * Already-presented occupants are never rewritten. Returns the ids committed.
 */
export function commitLandings(presented: readonly Charge[], truth: readonly Charge[], landed: Set<string>): { holding: Charge[]; committed: string[] } {
  const holding = [...presented];
  const committed: string[] = [];
  for (let i = presented.length; i < truth.length; i += 1) {
    const next = truth[i]!;
    if (!landed.has(next.id)) break;
    holding.push(next);
    landed.delete(next.id);
    committed.push(next.id);
  }
  return committed.length ? { holding, committed } : { holding: presented as Charge[], committed };
}

/** DEV lifecycle checks at boundaries only (never per frame). */
export function terminalProblem(pass: FlightPass, capacity: number): string | null {
  const t = pass.terminal;
  if (t.kind !== 'toHolding') return null;
  if (!Number.isInteger(t.slot) || t.slot < 0 || t.slot >= capacity) return `toHolding ${pass.charge.id} has invalid slot ${t.slot}`;
  return null;
}
