import { legalActions } from './actions';
import { remainingPixelCount } from './pixels';
import type { GameState, GameStatus } from './types';
export function isWon(state: GameState): boolean { return remainingPixelCount(state) === 0; }
/**
 * Runtime deadlock: the picture is not cleared and there is no admitted player
 * action left that can still change it.
 *
 * While an epoch is open a `join: true` launch onto the running rail is a real
 * option, so it is considered too — the game must never declare a loss while a
 * legal join can still progress the board (M4A.2).
 *
 * Every action `legalActions` returns is progress-making, so "a legal action
 * exists" and "the board can still change" are the same test here:
 *   - a tunnel launch always consumes the visible charge, advancing a finite
 *     queue toward emptiness (even a launch that clears nothing);
 *   - a held relaunch is only admitted with a matching *reachable* target
 *     (`actionRejection`), so its pass always clears or cracks at least one
 *     pixel;
 *   - Frozen ice is finite, so crack→…→clear on any one pixel terminates.
 * There is no "launch that returns to Holding unchanged" — the source charge
 * always moves and the board or a queue always changes.
 */
export function isLost(state: GameState): boolean {
  if (isWon(state)) return false;
  const playing: GameState = { ...state, status: 'playing' };
  return legalActions(playing, { includeJoin: playing.epoch !== null }).length === 0;
}
export function computeStatus(state: GameState): GameStatus {
  return isWon(state) ? 'won' : isLost(state) ? 'lost' : 'playing';
}
