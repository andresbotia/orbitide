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
 * Joins need no separate look: `candidateActions` only ever offers a
 * `join: true` launch next to its settle-first twin, and `actionRejection`
 * never admits a join whose twin it refuses — so a join cannot change whether
 * *any* move exists. (Under FIRST LAUNCHED, FIRST SERVED it cannot change the
 * outcome either: a join resolves exactly like launching after the rail settles.)
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
  if (state.status === 'lost') return true;
  if (isWon(state)) return false;
  const playing: GameState = { ...state, status: 'playing' };
  if (legalActions(playing).length === 0) return true;

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
  if (state.status === 'lost') return 'lost';
  return isWon(state) ? 'won' : isLost(state) ? 'lost' : 'playing';
}
