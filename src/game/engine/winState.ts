import { allLanesEmpty, allTargetsComplete } from './selectors';
import type { GameState, GameStatus } from './types';

/**
 * Win: every lane empty, the holding tray empty, and every Core target
 * complete.
 */
export function isWon(state: GameState): boolean {
  return (
    allLanesEmpty(state) &&
    state.holding.length === 0 &&
    allTargetsComplete(state)
  );
}

/**
 * Loss: the holding tray is at capacity and automatic resolution cannot free a
 * slot.
 *
 * Automatic resolution only ever consumes a held orb that matches the active
 * target, and the engine runs it (via `settle`) after every move. So by the
 * time this is evaluated, a full tray means no held orb matches the active
 * target and nothing can free a slot — the level is lost. The explicit
 * `some(...)` check is kept as a guard in case this is ever called on a state
 * that has not been settled.
 */
export function isLost(state: GameState): boolean {
  if (state.holding.length < state.holdingCapacity) return false;
  const activeColor = state.targets[state.activeTargetIndex]?.color;
  const aHeldOrbCanResolve = state.holding.some(
    (orb) => orb.color === activeColor,
  );
  return !aHeldOrbCanResolve;
}

/** Derive the status of a (already settled) state. Win takes priority. */
export function computeStatus(state: GameState): GameStatus {
  if (isWon(state)) return 'won';
  if (isLost(state)) return 'lost';
  return 'playing';
}
