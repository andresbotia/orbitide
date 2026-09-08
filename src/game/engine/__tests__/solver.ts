/**
 * Test-only brute-force solver. This is NOT a shipped feature — it exists so the
 * unit tests can prove every handcrafted level is winnable. (The real seeded
 * solver/generator is Milestone 2 work.)
 */
import { createGame } from '../createGame';
import { getExposedOrbs } from '../selectors';
import { resolveMove } from '../resolveMove';
import type { GameState, LevelDefinition } from '../types';

function key(state: GameState): string {
  const lanes = state.lanes.map((lane) => lane.map((o) => o.color).join('')).join('|');
  const holding = [...state.holding.map((o) => o.color)].sort().join('');
  const targets = state.targets.map((t) => `${t.color}:${t.count}`).join(',');
  return `${lanes}//${holding}//${state.activeTargetIndex}//${targets}`;
}

export interface SolveResult {
  solved: boolean;
  /** Orb ids tapped, in order, for one winning line. */
  moves: string[];
}

/** Depth-first search for any sequence of legal taps that wins the level. */
export function solve(level: LevelDefinition): SolveResult {
  const seen = new Set<string>();
  const path: string[] = [];

  function dfs(state: GameState): boolean {
    if (state.status === 'won') return true;
    if (state.status === 'lost') return false;

    const k = key(state);
    if (seen.has(k)) return false;
    seen.add(k);

    for (const { orb } of getExposedOrbs(state)) {
      const outcome = resolveMove(state, orb.id);
      if (!outcome.accepted) continue;
      path.push(orb.id);
      if (dfs(outcome.state)) return true;
      path.pop();
    }
    return false;
  }

  const solved = dfs(createGame(level));
  return { solved, moves: solved ? [...path] : [] };
}
