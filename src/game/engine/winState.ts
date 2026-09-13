import { legalActions } from './actions';
import { activeSlotCount } from './epoch';
import { resolvePass } from './pass';
import { remainingPixelCount } from './pixels';
import { isCoreV2 } from './ruleset';
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
 *   - a Legacy V1 held relaunch is only admitted with a matching *reachable*
 *     target (`actionRejection`), so its pass always clears or cracks at least
 *     one pixel;
 *   - Frozen ice is finite, so crack→…→clear on any one pixel terminates.
 *
 * Core V2 terminal deadlock:
 * When ruleset === coreV2, every tunnel queue is empty, and activeCount === 0,
 * evaluate each held charge against the CURRENT board using real Core V2 pass
 * simulation. If no held charge can produce board progress (pixel clear,
 * modifier break/prime), the state is lost.
 */
export function isLost(state: GameState): boolean {
  if (isWon(state)) return false;
  const playing: GameState = { ...state, status: 'playing' };
  const actions = legalActions(playing, { includeJoin: playing.epoch !== null });
  if (actions.length === 0) return true;

  if (
    isCoreV2(state.ruleset)
    && state.tunnels.every((t) => t.queue.length === 0)
    && activeSlotCount(state) === 0
    && (state.activeCharges?.length ?? 0) === 0
  ) {
    const hasProgressMakingHeldCharge = state.holding.some((heldCharge) => {
      const pass = resolvePass(state, heldCharge);
      return pass.encounters.length > 0;
    });
    if (!hasProgressMakingHeldCharge) {
      return true;
    }
  }

  return false;
}
export function computeStatus(state: GameState): GameStatus {
  return isWon(state) ? 'won' : isLost(state) ? 'lost' : 'playing';
}
