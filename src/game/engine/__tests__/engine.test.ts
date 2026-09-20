import { createGame, restartGame } from '../createGame';
import { resolveLaunch, resolveAction } from '../resolveLaunch';
import { resolveHoldingLaunch } from '../resolveHolding';
import { legalActions, actionRejection } from '../actions';
import { computeStatus, isProductiveAction } from '../winState';
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
test('a held charge with no exposed target is admitted (it may miss this lap)', () => {
  // Approved semantics change: a buried colour no longer traps its Pal in
  // Holding. Relaunching is the player's way out of a full tray, and board
  // exposure changes while a Pal travels, so "exposed at this exact frame" was
  // never the right question. A miss simply parks the Pal again.
  const state = resolveLaunch(createGame(level), 'tunnel-1').state;
  const held = state.holding[0]!;
  const result = resolveHoldingLaunch(state, held.id);
  expect(result.accepted).toBe(true);
  expect(result.rejection).toBeUndefined();
  expect(result.pass!.encounters).toEqual([]);
  expect(result.state.holding).toEqual([{ id: held.id, color: held.color, capacity: held.capacity }]);
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
test('a PRODUCTIVE action strictly reduces rank; a no-op relaunch leaves it alone', () => {
  // The old invariant was that every admitted action reduces this rank, which
  // is what kept the solver cycle-free. Admission no longer guarantees it: a
  // held Pal may relaunch with its colour buried and change nothing. The
  // guarantee now lives in `isProductiveAction`, and `isLost` uses it to end a
  // state whose every remaining action is such a loop.
  const state = resolveLaunch(createGame(level), 'tunnel-1').state;
  const rank = (s: GameState) => s.tunnels.reduce((n, t) => n + t.queue.length, 0) * 100 + s.pixels.filter((p) => !p.cleared).length;
  let sawProductive = false;
  let sawLoop = false;
  for (const action of legalActions(state)) {
    const next = resolveAction(state, action).state;
    if (isProductiveAction(state, action)) {
      sawProductive = true;
      expect(rank(next)).toBeLessThan(rank(state));
    } else {
      sawLoop = true;
      // A no-op loop: same board, same queues, same Holding contents.
      expect(rank(next)).toBe(rank(state));
      expect(next.holding.map((c) => `${c.id}:${c.capacity}`).sort())
        .toEqual(state.holding.map((c) => `${c.id}:${c.capacity}`).sort());
    }
  }
  expect(sawProductive).toBe(true);
  expect(sawLoop).toBe(true);
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
