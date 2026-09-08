/**
 * Test-only brute-force solver for the pixel-clearing mechanic. NOT a shipped
 * feature — it exists so the unit tests can prove every handcrafted level is
 * winnable and record a few fairness metrics. (The real seeded solver/generator
 * is Milestone 2 work.)
 */
import { createGame } from '../createGame';
import { resolveLaunch, type LaunchOutcome } from '../resolveLaunch';
import type { GameState, LevelDefinition } from '../types';

function stateKey(state: GameState): string {
  const cleared = state.pixels
    .map((p) => (p.cleared ? '1' : '0'))
    .join('');
  const tunnels = state.tunnels
    .map((t) => t.queue.map((c) => `${c.color}${c.capacity}`).join('.'))
    .join('|');
  const holding = state.holding
    .map((c) => `${c.color}${c.capacity}`)
    .join(',');
  return `${cleared}//${tunnels}//${holding}`;
}

export interface SolveResult {
  solved: boolean;
  /** Tunnel ids launched, in order, for one winning line. */
  moves: string[];
  /** Length of that line. */
  length: number;
  /** Peak Holding occupancy along that line. */
  peakHolding: number;
  /** Includes the brief landing before automatic Holding resolution. */
  peakPresentedHolding: number;
  /** How many distinct first moves lead to a win. */
  viableFirstMoves: number;
  /** Nodes explored (search-cost sanity check). */
  nodes: number;
}

interface Search {
  seen: Set<string>;
  nodes: number;
  nodeCap: number;
}

function dfs(
  state: GameState,
  path: string[],
  peak: { value: number },
  search: Search,
): string[] | null {
  if (state.status === 'won') return [...path];
  if (state.status === 'lost') return null;

  search.nodes += 1;
  if (search.nodes > search.nodeCap) return null;

  const key = stateKey(state);
  if (search.seen.has(key)) return null;
  search.seen.add(key);

  for (const tunnel of state.tunnels) {
    if (tunnel.queue.length === 0) continue;
    const outcome = resolveLaunch(state, tunnel.id);
    if (!outcome.accepted) continue;

    path.push(tunnel.id);
    peak.value = Math.max(peak.value, outcome.state.holding.length);
    const found = dfs(outcome.state, path, peak, search);
    path.pop();
    if (found) return found;
  }
  return null;
}

/** Depth-first search for any winning sequence of tunnel launches. */
export function solve(level: LevelDefinition, nodeCap = 400_000): SolveResult {
  const start = createGame(level);

  const search: Search = { seen: new Set(), nodes: 0, nodeCap };
  const peak = { value: 0 };
  const line = dfs(start, [], peak, search);

  let viableFirstMoves = 0;
  if (line) {
    for (const tunnel of start.tunnels) {
      if (tunnel.queue.length === 0) continue;
      const outcome = resolveLaunch(start, tunnel.id);
      if (!outcome.accepted) continue;
      const inner: Search = { seen: new Set(), nodes: 0, nodeCap };
      const found = dfs(outcome.state, [], { value: 0 }, inner);
      if (found) viableFirstMoves += 1;
    }
  }

  // Recompute peak holding for the winning line only.
  let peakHolding = 0;
  let peakPresentedHolding = 0;
  if (line) {
    let s = createGame(level);
    for (const move of line) {
      const outcome = resolveLaunch(s, move);
      peakPresentedHolding = Math.max(peakPresentedHolding, presentationPeak(s, outcome));
      s = outcome.state;
      peakHolding = Math.max(peakHolding, s.holding.length);
    }
  }

  return {
    solved: !!line,
    moves: line ?? [],
    length: line?.length ?? 0,
    peakHolding,
    peakPresentedHolding,
    viableFirstMoves,
    nodes: search.nodes,
  };
}

export interface AuditResult {
  complete: boolean;
  nodes: number;
  failPath: string[] | null;
  /** Uniform choice among nonempty tunnels at each step; diagnostic, not runtime randomness. */
  lossProbability: number;
  /** Minimum peak settled occupancy among all winning lines. */
  minWinningPeak: number;
  /** Maximum displayed occupancy, including brief landings before auto-resolution. */
  peakPresentedHolding: number;
  /** Maximum settled occupancy over every reachable state, including loss. */
  peakHolding: number;
}

/** Exhaustive DAG audit. Holding order is part of the key: it affects resolution. */
export function audit(level: LevelDefinition, nodeCap = 400_000): AuditResult {
  type Node = { loss: number; minPeak: number };
  const memo = new Map<string, Node>();
  let nodes = 0;
  let complete = true;
  let failPath: string[] | null = null;
  let peakHolding = 0;
  let peakPresentedHolding = 0;
  function visit(state: GameState, path: string[]): Node {
    peakHolding = Math.max(peakHolding, state.holding.length);
    if (state.status === 'lost') {
      if (failPath === null) failPath = path;
      return { loss: 1, minPeak: Infinity };
    }
    if (state.status === 'won') return { loss: 0, minPeak: state.holding.length };
    const key = stateKey(state);
    const cached = memo.get(key);
    if (cached) return cached;
    if (++nodes > nodeCap) {
      complete = false;
      throw new Error(`Audit node cap exceeded for level ${level.id}`);
    }
    const children = state.tunnels.filter((t) => t.queue.length).map((t) => {
      const outcome = resolveLaunch(state, t.id);
      peakPresentedHolding = Math.max(peakPresentedHolding, presentationPeak(state, outcome));
      return visit(outcome.state, [...path, t.id]);
    });
    const result = {
      loss: children.reduce((sum, child) => sum + child.loss, 0) / children.length,
      minPeak: Math.max(state.holding.length, Math.min(...children.map((child) => child.minPeak))),
    };
    memo.set(key, result);
    return result;
  }
  const result = visit(createGame(level), []);
  return { complete, nodes, failPath, lossProbability: result.loss,
    minWinningPeak: result.minPeak, peakHolding, peakPresentedHolding };
}

/** Mirror only tray occupancy transitions, never pixel selection or game rules. */
function presentationPeak(before: GameState, outcome: LaunchOutcome): number {
  let count = before.holding.length + (outcome.heldCharge ? 1 : 0);
  let peak = count;
  for (const resolution of outcome.autoResolutions) {
    count -= 1;
    if (!resolution.consumed) count += 1;
    peak = Math.max(peak, count);
  }
  return peak;
}
