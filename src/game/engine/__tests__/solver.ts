/** Test-only exhaustive action graph. Runtime and solver use the same admission and pass rules. */
import { createGame } from '../createGame';
import { legalActions, type GameAction } from '../actions';
import { resolveAction } from '../resolveLaunch';
import type { GameState, LevelDefinition } from '../types';
export function stateKey(s: GameState): string {
  return s.pixels.map((p) => p.cleared ? '1' : '0').join('') + '/' +
    s.tunnels.map((t) => t.queue.map((c) => `${c.id}:${c.capacity}`).join(',')).join('|') + '/' +
    s.holding.map((c) => `${c.id}:${c.color}:${c.capacity}`).join(',');
}
export interface SolveResult {
  solved: boolean; complete: boolean; moves: GameAction[]; length: number;
  peakHolding: number; minWinningPeak: number; maxHolding: number;
  viableFirstMoves: number; nodes: number; failPath: GameAction[] | null;
  lossProbability: number; heldLaunches: number;
}
interface Node { win: GameAction[] | null; fail: GameAction[] | null; minPeak: number; loss: number }
export function solve(level: LevelDefinition, nodeCap = 300_000): SolveResult {
  const memo = new Map<string, Node>();
  let nodes = 0;
  let maxHolding = 0;
  function visit(state: GameState): Node {
    maxHolding = Math.max(maxHolding, state.holding.length);
    if (state.status === 'won') return { win: [], fail: null, minPeak: state.holding.length, loss: 0 };
    if (state.status === 'lost') return { win: null, fail: [], minPeak: Infinity, loss: 1 };
    const key = stateKey(state);
    const cached = memo.get(key);
    if (cached) return cached;
    if (++nodes > nodeCap) throw new Error(`Level ${level.id} solver exceeded ${nodeCap} states`);
    const actions = legalActions(state);
    if (!actions.length) throw new Error('Runtime failed to mark a deadlock');
    let win: GameAction[] | null = null;
    let fail: GameAction[] | null = null;
    let minPeak = Infinity;
    let loss = 0;
    for (const action of actions) {
      const outcome = resolveAction(state, action);
      if (!outcome.accepted) throw new Error('Solver/runtime admission mismatch');
      const child = visit(outcome.state);
      if (child.win !== null) {
        const candidate = [action, ...child.win];
        if (win === null || candidate.length < win.length) win = candidate;
        minPeak = Math.min(minPeak, Math.max(state.holding.length, child.minPeak));
      }
      if (child.fail !== null && (fail === null || child.fail.length + 1 < fail.length)) fail = [action, ...child.fail];
      loss += child.loss / actions.length;
    }
    const result = { win, fail, minPeak, loss };
    memo.set(key, result);
    return result;
  }
  const initial = createGame(level);
  const root = visit(initial);
  const viableFirstMoves = legalActions(initial).filter((a) => visit(resolveAction(initial, a).state).win !== null).length;
  let peakHolding = 0;
  let state = initial;
  for (const action of root.win ?? []) {
    state = resolveAction(state, action).state;
    peakHolding = Math.max(peakHolding, state.holding.length);
  }
  return { solved: root.win !== null, complete: true, moves: root.win ?? [], length: root.win?.length ?? 0,
    peakHolding, minWinningPeak: root.minPeak, maxHolding, viableFirstMoves, nodes,
    failPath: root.fail, lossProbability: root.loss,
    heldLaunches: root.win?.filter((a) => a.kind === 'holding').length ?? 0 };
}
export const audit = solve;
