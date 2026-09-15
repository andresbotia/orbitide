import { createGame, restartGame } from '../createGame';
import { resolveLaunch, resolveAction } from '../resolveLaunch';
import { resolveHoldingLaunch } from '../resolveHolding';
import { legalActions, actionRejection } from '../actions';
import { computeStatus } from '../winState';
import { reachablePixels } from '../pixels';
import type { GameState, LevelDefinition } from '../types';
const level: LevelDefinition = { id: 900, title: 'Rules', themeId: 'test', difficulty: 'easy', holdingCapacity: 3,
  pixelArt: ['WWW', 'WBW', 'WWW'], tunnels: [
    [{ color: 'white', capacity: 8 }, { color: 'blue', capacity: 1 }],
    [{ color: 'blue', capacity: 1 }], [{ color: 'white', capacity: 2 }],
  ] };
const held = (color: 'pink' | 'blue' | 'green' | 'white', id = color) => ({ id, color, capacity: 1 });
function fullBoard(): GameState {
  const state = createGame({ ...level, pixelArt: ['W'], tunnels: [[{ color: 'white', capacity: 1 }], [], []] });
  state.holding = [held('pink'), held('blue'), held('green')];
  return state;
}
test('launch advances only the selected authored queue and never mutates input', () => {
  const state = createGame(level);
  const snapshot = JSON.stringify(state);
  const result = resolveLaunch(state, 'tunnel-0');
  expect(result.accepted).toBe(true);
  expect(result.state.tunnels[0]!.queue[0]!.color).toBe('blue');
  expect(result.state.tunnels[1]).toBe(state.tunnels[1]);
  expect(result.pass!.encounters).toHaveLength(8);
  expect(result.heldCharge).toBeNull();
  expect(JSON.stringify(state)).toBe(snapshot);
});
test('buried color parks; exposure changes never auto-relaunch it', () => {
  let state = createGame(level);
  expect(reachablePixels(state).some((p) => p.color === 'blue')).toBe(false);
  state = resolveLaunch(state, 'tunnel-1').state;
  const parked = { ...state.holding[0]! };
  state = resolveLaunch(state, 'tunnel-0').state;
  expect(state.holding).toEqual([parked]);
  expect(state.pixels.find((p) => p.color === 'blue')!.cleared).toBe(false);
  expect(state.status).toBe('playing');
  const result = resolveHoldingLaunch(state, parked.id);
  expect(result.accepted).toBe(true);
  expect(result.launchedCharge).toEqual(parked);
  expect(result.state.holding).toEqual([]);
  expect(result.state.status).toBe('won');
});
test('a held charge with no targets is rejected with clear reason and no mutation', () => {
  const state = resolveLaunch(createGame(level), 'tunnel-1').state;
  const result = resolveHoldingLaunch(state, state.holding[0]!.id);
  expect(result.accepted).toBe(false);
  expect(result.rejection).toBe('noTargets');
  expect(result.state).toBe(state);
});
test('full Holding with a useful held charge remains playable', () => {
  const state = fullBoard();
  state.tunnels = state.tunnels.map((t) => ({ ...t, queue: [] }));
  state.holding[0] = held('white');
  expect(computeStatus(state)).toBe('playing');
  expect(resolveHoldingLaunch(state, 'white').state.status).toBe('won');
});
test('full Holding can launch a tunnel charge that completely consumes itself', () => {
  const state = fullBoard();
  expect(computeStatus(state)).toBe('playing');
  expect(resolveLaunch(state, 'tunnel-0').state.status).toBe('won');
});
test('full Holding accepts a partial tunnel pass then loses without overwriting Holding', () => {
  const state = fullBoard();
  state.tunnels[0]!.queue[0] = { id: 'overflow-blue', color: 'blue', capacity: 2 };
  expect(computeStatus(state)).toBe('playing');
  const result = resolveLaunch(state, 'tunnel-0');
  expect(result.accepted).toBe(true);
  expect(result.state.status).toBe('lost');
  expect(result.state.holding).toEqual(state.holding);
  expect(result.heldCharge?.capacity).toBeGreaterThan(0);
  expect(result.state.holding.some((c) => c.id === result.launchedCharge!.id)).toBe(false);
});
test('true deadlock can occur below full Holding when every tunnel is exhausted', () => {
  const state = fullBoard();
  state.holding = [held('blue')];
  state.tunnels = state.tunnels.map((t) => ({ ...t, queue: [] }));
  expect(computeStatus(state)).toBe('lost');
});
test('a no-hit tunnel launch with a free slot is admitted to reveal the next charge', () => {
  const state = createGame(level);
  expect(actionRejection(state, { kind: 'tunnel', id: 'tunnel-1' })).toBeNull();
  const outcome = resolveLaunch(state, 'tunnel-1');
  expect(outcome.pass!.encounters).toEqual([]);
  expect(outcome.heldCharge!.capacity).toBe(1);
});
test.each(['empty', 'unknown', 'finished'])('%s tunnel taps are harmless', (kind) => {
  let state = createGame(level);
  let id = 'tunnel-1';
  if (kind === 'empty') state = resolveLaunch(state, id).state;
  if (kind === 'unknown') id = 'missing';
  if (kind === 'finished') state = { ...state, status: 'won' };
  expect(resolveLaunch(state, id).state).toBe(state);
  expect(resolveLaunch(state, id).accepted).toBe(false);
});
test('stale held id is rejected', () => {
  expect(resolveHoldingLaunch(createGame(level), 'missing').rejection).toBe('missingCharge');
});
test('repeated taps cannot consume the same charge twice', () => {
  let state = createGame(level);
  for (let i = 0; i < 10; i++) state = resolveLaunch(state, 'tunnel-1').state;
  expect(state.movesApplied).toBe(1);
  expect(state.holding).toHaveLength(1);
});
test('all admitted actions reduce tunnel count or uncleared pixel count, so solver has no cycles', () => {
  const state = resolveLaunch(createGame(level), 'tunnel-1').state;
  for (const action of legalActions(state)) {
    const next = resolveAction(state, action).state;
    const rank = (s: GameState) => s.tunnels.reduce((n, t) => n + t.queue.length, 0) * 100 + s.pixels.filter((p) => !p.cleared).length;
    expect(rank(next)).toBeLessThan(rank(state));
  }
});
test('restart and repeated deterministic action sequences reproduce exact state', () => {
  const run = () => {
    let state = restartGame(level);
    state = resolveLaunch(state, 'tunnel-1').state;
    state = resolveLaunch(state, 'tunnel-0').state;
    return resolveHoldingLaunch(state, state.holding[0]!.id).state;
  };
  expect(run()).toEqual(run());
  expect(restartGame(level)).toEqual(createGame(level));
});
