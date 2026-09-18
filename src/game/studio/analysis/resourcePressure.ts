/**
 * Holding resource pressure composed from the winning-line trace metrics. Does
 * not re-simulate.
 *
 * Active-slot pressure is deliberately absent: Pals sharing the rail is
 * presentation / game feel, not a puzzle resource. Under FIRST LAUNCHED, FIRST
 * SERVED a join resolves exactly like a settle-first launch, so the solver never
 * launches concurrently and has no Active peak to report.
 */
import type { HoldingPressure, ResourcePressure } from './types';

export function resourcePressure(args: { holding: HoldingPressure }): ResourcePressure {
  const holdingCapacity = args.holding.holdingCapacity;
  const maxHolding = args.holding.maxHolding;
  return {
    maxHolding,
    holdingCapacity,
    holdingUtilization: holdingCapacity > 0 ? maxHolding / holdingCapacity : 0,
    manualRelaunches: args.holding.manualRelaunches,
    chargesEnteringHolding: args.holding.chargesEnteringHolding,
    longestHeldDurationSteps: args.holding.longestHeldDurationSteps,
  };
}
