import { solve } from '@/game/engine/solver';
import { traceActions } from '@/game/engine/trace';
import { LEVEL_DEFINITIONS } from '../../../levels/levelDefinitions';
import { HOLDING_MEDIUM } from '../__fixtures__/levels';
import { holdingPressure } from '../holdingPressure';

test('a no-Holding level reports zero pressure', () => {
  const def = LEVEL_DEFINITIONS[0]!; // Level 1 — white only, never parks
  const trace = traceActions(def, solve(def).moves);
  const p = holdingPressure(trace, def.holdingCapacity);
  expect(p.maxHolding).toBe(0);
  expect(p.stepsAtOrAbove2).toBe(0);
  expect(p.manualRelaunches).toBe(0);
  expect(p.chargesEnteringHolding).toBe(0);
  expect(p.longestHeldDurationSteps).toBe(0);
  expect(p.timeline).toHaveLength(trace.steps.filter((s) => s.accepted).length);
}, 60_000);

test('a Holding-using line records occupancy, entries and duration', () => {
  // Sequential play of the World-1 Hard finale needs held relaunches.
  // The concurrent shortest line can park leftover without relaunching.
  const def = LEVEL_DEFINITIONS.find((l) => l.title === 'Ring Nebula')!;
  const trace = traceActions(def, solve(def).moves);
  const p = holdingPressure(trace, def.holdingCapacity);
  expect(p.holdingCapacity).toBe(3);
  expect(p.maxHolding).toBeGreaterThanOrEqual(1);
  expect(p.chargesEnteringHolding).toBeGreaterThanOrEqual(1);
  expect(p.manualRelaunches).toBeGreaterThanOrEqual(1);
  expect(p.longestHeldDurationSteps).toBeGreaterThanOrEqual(1);
  expect(p.fractionAtOrAbove2).toBeGreaterThanOrEqual(0);
  expect(p.fractionAtOrAbove2).toBeLessThanOrEqual(1);
}, 120_000);

test('metrics are measured in action steps, and deterministic', () => {
  const def = HOLDING_MEDIUM;
  const trace = traceActions(def, solve(def).moves);
  const a = holdingPressure(trace, def.holdingCapacity);
  const b = holdingPressure(trace, def.holdingCapacity);
  expect(a).toEqual(b);
  expect(Number.isInteger(a.longestHeldDurationSteps)).toBe(true);
  expect(Number.isInteger(a.stepsAtOrAbove2)).toBe(true);
}, 60_000);
