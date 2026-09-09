/**
 * Traceable Holding-pressure metrics over a witness. Everything is measured in
 * action steps / logical state — never wall-clock time.
 */
import type { Trace } from '@/game/engine/trace';
import type { HoldingPressure } from './types';

export function holdingPressure(trace: Trace, holdingCapacity: number): HoldingPressure {
  const accepted = trace.steps.filter((s) => s.accepted);
  const timeline = accepted.map((s) => s.holdingAfter.length);
  const maxHolding = timeline.reduce((m, v) => Math.max(m, v), 0);
  const stepsAtOrAbove2 = timeline.filter((v) => v >= 2).length;
  const manualRelaunches = accepted.filter((s) => s.source.kind === 'holding').length;

  // Charge lifecycle: id → step index it entered Holding.
  const enteredAt = new Map<string, number>();
  let chargesEnteringHolding = 0;
  let longestHeldDurationSteps = 0;

  let prev = new Set((accepted[0]?.holdingBefore ?? []).map((c) => c.id));
  accepted.forEach((step, i) => {
    const now = new Set(step.holdingAfter.map((c) => c.id));
    for (const id of now) {
      if (!prev.has(id)) { enteredAt.set(id, i); chargesEnteringHolding += 1; }
    }
    for (const id of prev) {
      if (!now.has(id) && enteredAt.has(id)) {
        longestHeldDurationSteps = Math.max(longestHeldDurationSteps, i - enteredAt.get(id)!);
        enteredAt.delete(id);
      }
    }
    prev = now;
  });
  // Charges still parked at the end.
  const lastIndex = accepted.length;
  for (const enter of enteredAt.values()) {
    longestHeldDurationSteps = Math.max(longestHeldDurationSteps, lastIndex - enter);
  }

  return {
    timeline,
    holdingCapacity,
    maxHolding,
    stepsAtOrAbove2,
    fractionAtOrAbove2: timeline.length > 0 ? stepsAtOrAbove2 / timeline.length : 0,
    manualRelaunches,
    chargesEnteringHolding,
    longestHeldDurationSteps,
  };
}
