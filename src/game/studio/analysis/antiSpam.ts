/**
 * Deterministic naive-policy evaluator. Purpose: detect levels where blind
 * tunnel spam trivially wins — not to prove difficulty.
 *
 * Policy A — round-robin tunnel spam:
 *   cycle tunnels 0 → 1 → 2 → … (mod tunnel count)
 *   if the selected tunnel is illegal, advance to the next legal tunnel
 *   when no tunnel launch is legal, use the first legal Holding action
 *   never join an open epoch (the naive player waits for settle)
 *   never use randomness; bounded by a step cap; drives the real engine
 */
import { legalActions } from '@/game/engine/actions';
import { createGame } from '@/game/engine/createGame';
import { resolveAction } from '@/game/engine/resolveLaunch';
import type { GameAction } from '@/game/engine/actions';
import type { GameState, LevelDefinition } from '@/game/engine/types';
import type { AntiSpamResult } from './types';

/** Default bound. Authored queues are short; 128 steps is well past any win. */
export const ANTI_SPAM_STEP_CAP = 128;

export interface AntiSpamOptions {
  stepCap?: number;
}

export function evaluateRoundRobinSpam(
  def: LevelDefinition,
  opts: AntiSpamOptions = {},
): AntiSpamResult {
  const stepCap = opts.stepCap ?? ANTI_SPAM_STEP_CAP;
  let state = createGame(def);
  let steps = 0;
  let peakHolding = state.holding.length;
  let holdingEntries = 0;
  let manualRelaunches = 0;
  let seenHolding = new Set(state.holding.map((c) => c.id));
  let tunnelCursor = 0;

  const finish = (outcome: AntiSpamResult['outcome']): AntiSpamResult => ({
    policy: 'round-robin',
    outcome,
    steps,
    peakHolding,
    holdingEntries,
    manualRelaunches,
  });

  while (steps < stepCap) {
    if (state.status === 'won') return finish('won');
    if (state.status === 'lost') return finish('lost');

    const action = pickRoundRobinAction(state, tunnelCursor);
    if (!action) {
      return finish(state.status === 'playing' ? 'deadlocked' : 'lost');
    }
    if (action.kind === 'tunnel') {
      const idx = Number(action.id.replace('tunnel-', ''));
      if (Number.isFinite(idx) && idx >= 0) {
        const n = Math.max(1, state.tunnels.length);
        tunnelCursor = (idx + 1) % n;
      }
    }

    const outcome = resolveAction(state, action);
    if (!outcome.accepted) return finish('deadlocked');
    steps += 1;
    state = outcome.state;
    peakHolding = Math.max(peakHolding, state.holding.length);
    if (action.kind === 'holding') manualRelaunches += 1;
    const now = new Set(state.holding.map((c) => c.id));
    for (const id of now) {
      if (!seenHolding.has(id)) holdingEntries += 1;
    }
    seenHolding = now;
  }

  if (state.status === 'won') return finish('won');
  if (state.status === 'lost') return finish('lost');
  return finish('step-cap');
}

function pickRoundRobinAction(state: GameState, tunnelCursor: number): GameAction | null {
  const legal = legalActions(state, { includeJoin: false });
  const n = state.tunnels.length;
  if (n > 0) {
    for (let k = 0; k < n; k += 1) {
      const idx = (tunnelCursor + k) % n;
      const id = `tunnel-${idx}`;
      const action = legal.find((a) => a.kind === 'tunnel' && a.id === id);
      if (action) return action;
    }
  }
  return legal.find((a) => a.kind === 'holding') ?? null;
}
