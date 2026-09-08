/**
 * Test-only brute-force solver for the pixel-clearing mechanic. NOT a shipped
 * feature — it exists so the unit tests can prove every handcrafted level is
 * winnable and record a few fairness metrics. (The real seeded solver/generator
 * is Milestone 2 work.)
 */
import { createGame } from '../createGame';
import { resolveLaunch } from '../resolveLaunch';
import type { GameState, LevelDefinition } from '../types';

function stateKey(state: GameState): string {
  const cleared = state.pixels
    .map((p) => (p.cleared ? '1' : '0'))
    .join('');
  const tunnels = state.tunnels
    .map((t) => t.queue.map((c) => `${c.color[0]}${c.capacity}`).join('.'))
    .join('|');
  const holding = [...state.holding]
    .map((c) => `${c.color[0]}${c.capacity}`)
    .sort()
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
  if (line) {
    let s = createGame(level);
    for (const move of line) {
      s = resolveLaunch(s, move).state;
      peakHolding = Math.max(peakHolding, s.holding.length);
    }
  }

  return {
    solved: !!line,
    moves: line ?? [],
    length: line?.length ?? 0,
    peakHolding,
    viableFirstMoves,
    nodes: search.nodes,
  };
}
