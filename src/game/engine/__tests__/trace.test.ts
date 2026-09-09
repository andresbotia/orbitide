/**
 * M3B witness replay. The trace must be produced only by the real engine and
 * must agree, frame for frame, with a direct `resolveAction` replay.
 */
import { createGame } from '../createGame';
import { remainingPixelCount } from '../pixels';
import { resolveAction } from '../resolveLaunch';
import { solve } from '../solver';
import { traceActions } from '../trace';
import type { GameAction } from '../actions';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';

const L = (id: number) => LEVEL_DEFINITIONS[id - 1]!;

function directReplay(levelId: number, actions: GameAction[]) {
  let state = createGame(L(levelId));
  const frames = [state];
  for (const action of actions) {
    if (state.status !== 'playing') break;
    const outcome = resolveAction(state, action);
    if (!outcome.accepted) break;
    state = outcome.state;
    frames.push(state);
  }
  return { state, frames };
}

test('a winning witness traces to a won final state that deep-equals a direct replay', () => {
  for (const id of [1, 2, 3, 4, 5, 6]) {
    const moves = solve(L(id)).moves;
    const trace = traceActions(L(id), moves);
    expect(trace.outcome).toBe('won');
    expect(trace.finalStatus).toBe('won');
    expect(trace.steps).toHaveLength(moves.length);
    expect(remainingPixelCount(trace.frames[trace.frames.length - 1]!)).toBe(0);

    const direct = directReplay(id, moves);
    expect(trace.frames).toHaveLength(direct.frames.length);
    expect(trace.frames[trace.frames.length - 1]).toEqual(direct.state);
  }
}, 120_000);

test('a failing witness traces to a lost final state', () => {
  // The first campaign level with a genuine fail path (a Hard finale).
  const level = LEVEL_DEFINITIONS.find((l) => solve(l).failPath !== null)!;
  const failPath = solve(level).failPath;
  expect(failPath).not.toBeNull();
  const trace = traceActions(level, failPath!);
  expect(trace.outcome).toBe('lost');
  expect(trace.finalStatus).toBe('lost');
  expect(remainingPixelCount(trace.frames[trace.frames.length - 1]!)).toBeGreaterThan(0);
}, 120_000);

test('every cleared pixel is attributed to exactly one step', () => {
  const trace = traceActions(L(3), solve(L(3)).moves);
  const allCleared = trace.steps.flatMap((s) => s.clearedPixelIds);
  expect(new Set(allCleared).size).toBe(allCleared.length); // no pixel cleared twice
  expect(allCleared.length).toBe(createGame(L(3)).pixels.length); // full picture
}, 120_000);

test('a step that unburies pixels reports them as newly exposed', () => {
  // Level 3 has a white centre buried under cyan.
  const trace = traceActions(L(3), solve(L(3)).moves);
  const exposed = trace.steps.flatMap((s) => s.newlyExposedPixelIds);
  expect(exposed.length).toBeGreaterThan(0);
  // Nothing is "newly exposed" and "cleared" in the same step.
  for (const step of trace.steps) {
    const cs = new Set(step.clearedPixelIds);
    expect(step.newlyExposedPixelIds.some((id) => cs.has(id))).toBe(false);
  }
}, 120_000);

test('a rejected action stops the trace and is flagged', () => {
  const trace = traceActions(L(1), [
    { kind: 'tunnel', id: 'tunnel-0' },
    { kind: 'holding', id: 'does-not-exist' },
    { kind: 'tunnel', id: 'tunnel-1' },
  ]);
  expect(trace.steps).toHaveLength(2);
  expect(trace.steps[1]!.accepted).toBe(false);
  expect(trace.steps[1]!.rejection).toBe('missingCharge');
  expect(trace.outcome).toBe('rejected');
});

test('an incomplete (non-terminal) line reports "incomplete"', () => {
  const trace = traceActions(L(6), [{ kind: 'tunnel', id: 'tunnel-0' }]);
  expect(trace.outcome).toBe('incomplete');
  expect(trace.finalStatus).toBe('playing');
});

test('unused charges and unused capacity are reported', () => {
  const trace = traceActions(L(1), solve(L(1)).moves);
  expect(Array.isArray(trace.unusedChargeIds)).toBe(true);
  expect(trace.unusedCapacity).toBeGreaterThanOrEqual(0);
  // Level 1 is white-only and the witness clears all 20 white pixels.
  expect(trace.steps.flatMap((s) => s.clearedPixelIds).length).toBe(20);
}, 120_000);
