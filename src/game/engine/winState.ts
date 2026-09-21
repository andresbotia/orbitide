import { legalActions, type GameAction } from './actions';
import { resolveEpochLaunch } from './epoch';
import { remainingPixelCount } from './pixels';
import type { Charge, GameState, GameStatus } from './types';

export function isWon(state: GameState): boolean { return remainingPixelCount(state) === 0; }

/**
 * Whether an admitted action can still change the committed logical state —
 * the board, the tunnel queues or Holding's contents. One definition for both
 * rulesets; it is what keeps "the level is still alive" honest now that a held
 * Pal may relaunch with nothing to hit.
 *
 *  - A TUNNEL launch always consumes its front charge, so a finite queue
 *    advances toward empty. Always productive, no simulation needed.
 *  - A HOLDING relaunch is productive only if its lap actually meets
 *    something (a clear, an ice/shield crack, a linked prime — every one of
 *    those changes the board fingerprint). A Pal that meets nothing parks
 *    straight back with the same remaining capacity: same pixels, same
 *    tunnels, same Holding contents. That is a no-op loop, and no number of
 *    repetitions can ever make it one.
 *
 * Holding ORDER is deliberately not part of "changed": a no-op relaunch moves
 * the Pal to the back of the tray, which changes nothing about what the player
 * can do next. Committed logical state only — never presentation.
 */
export function isProductiveAction(state: GameState, action: GameAction): boolean {
  if (action.kind === 'tunnel') return true;
  const charge = state.holding.find((c) => c.id === action.id);
  return charge !== undefined && heldRelaunchMeetsSomething(state, charge);
}

/**
 * Resolve a settle-first relaunch of `charge` with the same function real
 * launches use, so the deadlock check and the actual outcome can never
 * disagree (and share its memo).
 */
function heldRelaunchMeetsSomething(state: GameState, charge: Charge): boolean {
  const { charge: resolved } = resolveEpochLaunch(state, {
    chargeId: charge.id,
    source: 'holding',
    originId: charge.id,
    color: charge.color,
    capacity: charge.capacity,
    launchSequence: state.movesApplied,
    insertionTime: 0,
  });
  return resolved.encounters.length > 0;
}

/**
 * Runtime deadlock: the picture is not cleared and nothing the player may do
 * can still change it.
 *
 * Joins need no separate look: `candidateActions` only ever offers a
 * `join: true` launch next to its settle-first twin, and `actionRejection`
 * never admits a join whose twin it refuses — so a join cannot change whether
 * *any* move exists. (Under FIRST LAUNCHED, FIRST SERVED it cannot change the
 * outcome either: a join resolves exactly like launching after the rail settles.)
 *
 * Two ways to be lost, one concept:
 *   1. no admitted action at all;
 *   2. every admitted action is a no-op loop ({@link isProductiveAction}).
 *
 * (2) used to be Core V2-only, and was written so narrowly — tunnels empty AND
 * no active slots AND no active charges — that it could not fire once a level
 * was under way, because `commitLaunch` always leaves `activeCharges` set.
 * Legacy V1 leaned on its held-relaunch `noTargets` admission rule instead, so
 * that "a legal action exists" implied "the board can still change". That rule
 * is gone (a full tray must always be escapable), so this check now carries it
 * for BOTH rulesets, and matches how the solver already treats a move that
 * returns to a state already on its line.
 *
 * Cost: while any tunnel still holds a Pal there is a productive action by
 * construction, so the simulation below only runs on tunnel-empty states, and
 * it reuses the launch memo when it does.
 */
export function isLost(state: GameState): boolean {
  if (state.status === 'lost') return true;
  if (isWon(state)) return false;
  // A Pal is still travelling toward an undecided Holding admission. Its
  // arrival is the decision point (`resolveArrival`), and until then the level
  // is live: a full tray can still be opened by relaunching a held Pal, which
  // is the rescue this whole model exists for. The loss, if it comes, commits
  // on that arrival beat — never before it.
  if (state.pendingHolding.length > 0) return false;
  const playing: GameState = { ...state, status: 'playing' };
  const actions = legalActions(playing);
  if (actions.length === 0) return true;
  return !actions.some((action) => isProductiveAction(playing, action));
}

export function computeStatus(state: GameState): GameStatus {
  if (state.status === 'lost') return 'lost';
  return isWon(state) ? 'won' : isLost(state) ? 'lost' : 'playing';
}

/**
 * The state's settled status, with the one consequence a finished game carries:
 * nothing is inbound any more. A won or lost level will never be played again,
 * so no arrival is left pending on it and every terminal state is self
 * consistent — `pendingHolding` non-empty always means the level is still live.
 */
export function settleStatus(state: GameState): GameState {
  const status = computeStatus(state);
  if (status === 'playing' || state.pendingHolding.length === 0) return { ...state, status };
  return { ...state, status, pendingHolding: [] };
}
