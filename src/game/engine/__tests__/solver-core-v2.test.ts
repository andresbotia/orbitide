/**
 * M5.6A — Core V2 solver verification. The solver must drive the real runtime
 * (createGame / legalActions / resolveAction) and memoize future-relevant
 * Core V2 state, including epoch residue and Holding relaunch.
 */
import { legalActions } from '../actions';
import { createGame } from '../createGame';
import { boardFingerprint } from '../frozen';
import { resolveAction } from '../resolveLaunch';
import { solve, stateKey } from '../solver';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import {
  V2_DETERMINISTIC, V2_HOLDING_RELAUNCH, V2_MULTI_ACTIVE, V2_TRAP,
} from '../../studio/analysis/__fixtures__/coreV2';

const T = (i: number, join = false) => ({
  kind: 'tunnel' as const,
  id: `tunnel-${i}`,
  ...(join ? { join: true } : {}),
});

function replay(def: Parameters<typeof createGame>[0], moves: ReturnType<typeof solve>['moves']) {
  let s = createGame(def);
  for (const a of moves) {
    const out = resolveAction(s, a);
    expect(out.accepted).toBe(true);
    s = out.state;
  }
  return s;
}

test('Core V2 deterministic witness replays to a win and is stable across runs', () => {
  const a = solve(V2_DETERMINISTIC);
  const b = solve(V2_DETERMINISTIC);
  expect(a.solved).toBe(true);
  expect(a.complete).toBe(true);
  expect(a).toEqual(b);
  expect(replay(V2_DETERMINISTIC, a.moves).status).toBe('won');
});

test('Core V2 Holding relaunch is an explicit witness action and replays', () => {
  const r = solve(V2_HOLDING_RELAUNCH);
  expect(r.solved).toBe(true);
  expect(r.moves.some((m) => m.kind === 'holding')).toBe(true);
  expect(r.heldLaunches).toBeGreaterThanOrEqual(1);
  expect(replay(V2_HOLDING_RELAUNCH, r.moves).status).toBe('won');
});

test('Core V2 multi-active join is accepted and the solver still wins', () => {
  let s = createGame(V2_MULTI_ACTIVE);
  s = resolveAction(s, T(0)).state;
  const joined = resolveAction(s, { ...T(1), join: true });
  expect(joined.accepted).toBe(true);
  expect((joined.epochCharges ?? []).length).toBeGreaterThanOrEqual(2);

  const r = solve(V2_MULTI_ACTIVE);
  expect(r.solved).toBe(true);
  expect(replay(V2_MULTI_ACTIVE, r.moves).status).toBe('won');
});

test('solver memoization does not collapse distinct Core V2 futures', () => {
  const initial = createGame(V2_TRAP);
  const afterTrap = resolveAction(initial, T(0)).state;

  // Same occupancy (the blue pixel is still there) but Holding / queues differ.
  expect(boardFingerprint(initial.pixels)).toBe(boardFingerprint(afterTrap.pixels));
  expect(stateKey(initial)).not.toBe(stateKey(afterTrap));

  // Open epoch vs stripped committed baseline of the same launch.
  expect(afterTrap.epoch).not.toBeNull();
  const settled = { ...afterTrap, epoch: null, activeCharges: [] };
  expect(stateKey(afterTrap)).not.toBe(stateKey(settled));

  // Different Holding colours with identical occupancy cannot share a key.
  const recolored = {
    ...afterTrap,
    holding: afterTrap.holding.map((c) => ({ ...c, color: 'red' as const })),
  };
  expect(stateKey(afterTrap)).not.toBe(stateKey(recolored));

  // The trap opening is unsolvable; the other first move wins.
  const r = solve(V2_TRAP);
  expect(r.solved).toBe(true);
  const trapFirst = r.firstMoves.find((m) => m.action.id === 'tunnel-0');
  const winFirst = r.firstMoves.find((m) => m.action.id === 'tunnel-1');
  expect(trapFirst?.solvable).toBe(false);
  expect(winFirst?.solvable).toBe(true);
});

test('a Core V2 Holding miss-loop is a cycle, not an unbounded search', () => {
  const r = solve(V2_TRAP, { nodeCap: 2_000 });
  expect(r.complete).toBe(true);
  expect(r.solved).toBe(true);
  expect(r.nodes).toBeLessThan(2_000);
});

test('Legacy V1 campaign fixture still solves unchanged', () => {
  const r = solve(LEVEL_DEFINITIONS[0]!, { mode: 'sequential-compat' });
  expect(r.solved).toBe(true);
  expect(r.complete).toBe(true);
  expect(r.totalFirstMoves).toBe(3);
  expect(legalActions(createGame(LEVEL_DEFINITIONS[0]!))).toHaveLength(3);
});
