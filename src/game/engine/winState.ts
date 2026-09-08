import { anyLaunchAvailable, holdingIsFull, remainingPixelCount } from './selectors';
import type { GameState, GameStatus } from './types';

/** Win: every pixel of the picture is cleared. */
export function isWon(state: GameState): boolean {
  return remainingPixelCount(state) === 0;
}

/**
 * Loss (evaluated only on an already-settled state):
 *
 * 1. Holding is full and automatic resolution could not free a slot — the
 *    parked charges are stuck.
 * 2. No launch is available (every tunnel empty) while pixels remain — the
 *    player has no move that could change anything.
 */
export function isLost(state: GameState): boolean {
  if (isWon(state)) return false;
  if (holdingIsFull(state)) return true;
  if (!anyLaunchAvailable(state)) return true;
  return false;
}

/** Derive the status of a settled state. Win takes priority over loss. */
export function computeStatus(state: GameState): GameStatus {
  if (isWon(state)) return 'won';
  if (isLost(state)) return 'lost';
  return 'playing';
}
