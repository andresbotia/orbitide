/**
 * The solver is a real production-neutral module at `engine/solver.ts` (M3A).
 * The old `engine/__tests__/solver` path must keep resolving to the same
 * implementation, and cancellation must work.
 */
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import { SolverCancelled, solve as solveFromModule } from '../solver';
import { solve as solveFromShim, audit } from './solver';

test('the shim re-exports the one solver implementation', () => {
  expect(solveFromShim).toBe(solveFromModule);
  expect(audit).toBe(solveFromModule);
});

test('solving Level 1 through either path gives the identical result', () => {
  const a = solveFromModule(LEVEL_DEFINITIONS[0]!);
  const b = solveFromShim(LEVEL_DEFINITIONS[0]!);
  expect(a).toEqual(b);
  expect(a.solved).toBe(true);
});

test('a flipped cancel signal aborts with SolverCancelled', () => {
  const signal = { cancelled: true };
  expect(() => solveFromModule(LEVEL_DEFINITIONS[8]!, { signal })).toThrow(SolverCancelled);
});

test('an un-flipped signal solves normally', () => {
  const signal = { cancelled: false };
  const result = solveFromModule(LEVEL_DEFINITIONS[0]!, { signal });
  expect(result.solved).toBe(true);
});

test('nodeCap overflow is a plain error, not a cancellation', () => {
  expect(() => solveFromModule(LEVEL_DEFINITIONS[8]!, { nodeCap: 5 })).toThrow(/exceeded 5 states/);
});
