/**
 * Holding + Active resource pressure composed from the winning-line trace
 * metrics and the solver's witness Active peak. Does not re-simulate.
 */
import { DEFAULT_ACTIVE_CAPACITY } from '@/game/engine/concurrency';
import type { LevelDefinition } from '@/game/engine/types';
import type { HoldingPressure, ResourcePressure } from './types';

export function resourcePressure(args: {
  def: LevelDefinition;
  holding: HoldingPressure;
  /** Peak concurrent actives on the winning witness (0 when unsolved). */
  maxActiveOnWitness: number;
}): ResourcePressure {
  const holdingCapacity = args.holding.holdingCapacity;
  const activeCapacity = resolveActiveCapacity(args.def.activeCapacity);
  const maxHolding = args.holding.maxHolding;
  const maxActive = args.maxActiveOnWitness;
  return {
    maxHolding,
    holdingCapacity,
    holdingUtilization: holdingCapacity > 0 ? maxHolding / holdingCapacity : 0,
    manualRelaunches: args.holding.manualRelaunches,
    chargesEnteringHolding: args.holding.chargesEnteringHolding,
    longestHeldDurationSteps: args.holding.longestHeldDurationSteps,
    maxActive,
    activeCapacity,
    activeUtilization: activeCapacity > 0 ? maxActive / activeCapacity : 0,
  };
}

function resolveActiveCapacity(value: number | undefined): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  return DEFAULT_ACTIVE_CAPACITY;
}
