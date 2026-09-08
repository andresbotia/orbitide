import { createGame } from '../../engine/createGame';
import { resolveAction } from '../../engine/resolveLaunch';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';
import { TOTAL_LEVELS, nextLevelId } from '../levels';
import { solve } from '../../engine/__tests__/solver';
test('ten authored celestial levels, three tunnels, three Holding slots, preserved difficulty labels', () => {
  expect(TOTAL_LEVELS).toBe(10);
  expect(LEVEL_DEFINITIONS.map((l) => l.id)).toEqual([1,2,3,4,5,6,7,8,9,10]);
  for (const level of LEVEL_DEFINITIONS) {
    expect(level.tunnels).toHaveLength(3);
    expect(level.holdingCapacity).toBe(3);
    expect(level.tunnels.every((t) => t.length > 0)).toBe(true);
    expect(level.difficulty).toBe(level.id < 9 ? 'easy' : level.id === 9 ? 'medium' : 'hard');
  }
  expect(nextLevelId(9)).toBe(10); expect(nextLevelId(10)).toBeUndefined();
});
test.each(LEVEL_DEFINITIONS)('level $id has the intended density and exact per-color capacity budget', (level) => {
  const state = createGame(level);
  const min = level.id <= 2 ? 20 : 25;
  const max = level.id === 1 ? 25 : level.id <= 3 ? 30 : 40;
  expect(state.pixels.length).toBeGreaterThanOrEqual(min);
  expect(state.pixels.length).toBeLessThanOrEqual(max);
  const colors = new Set(state.pixels.map((p) => p.color));
  for (const color of colors) {
    expect(level.tunnels.flat().filter((c) => c.color === color).reduce((n,c) => n + c.capacity, 0))
      .toBe(state.pixels.filter((p) => p.color === color).length);
  }
});
test('every winning and failing witness replays through the runtime resolver', () => {
  for (const level of LEVEL_DEFINITIONS) {
    const result = solve(level);
    for (const [actions, status] of [[result.moves, 'won'], [result.failPath, 'lost']] as const) {
      if (!actions) continue;
      let state = createGame(level);
      for (const action of actions) {
        const outcome = resolveAction(state, action);
        expect(outcome.accepted).toBe(true);
        expect(outcome.state.holding.length).toBeLessThanOrEqual(3);
        state = outcome.state;
      }
      expect(state.status).toBe(status);
    }
  }
}, 120_000);
