import { legalActions } from './actions';
import { remainingPixelCount } from './pixels';
import type { GameState, GameStatus } from './types';
export function isWon(state: GameState): boolean { return remainingPixelCount(state) === 0; }
/** Deadlock means no admitted tunnel action and no useful manual Holding action. */
export function isLost(state: GameState): boolean {
  return !isWon(state) && legalActions({ ...state, status: 'playing' }).length === 0;
}
export function computeStatus(state: GameState): GameStatus {
  return isWon(state) ? 'won' : isLost(state) ? 'lost' : 'playing';
}
