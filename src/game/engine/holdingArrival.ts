import type { GameAction } from './actions';
import { resolveAction, type LaunchOutcome } from './resolveLaunch';
import type { Charge, GameState } from './types';
import { settleStatus } from './winState';

/**
 * GATE ARRIVAL — where a provisional Holding admission actually commits.
 *
 * A Pal's combat is fixed the moment it launches (FIRST LAUNCHED, FIRST
 * SERVED): its shots, the pixels it cleared and its remaining charge can never
 * be rewritten. The one thing left open is whether the surviving Pal can enter
 * Holding when it physically lands, and that is decided HERE, against the tray
 * as it stands at that moment — not against the tray as it stood a lap earlier.
 *
 * That is what makes an overflow recoverable: while the Pal travels, the player
 * may relaunch a held Pal and free the slot it needs.
 *
 * Arrivals commit strictly in launch order (the queue is FIFO), so two Pals can
 * never take the same slot, and no slot is reserved ahead of time — the tray
 * stays fully interactive the whole way.
 */
export interface ArrivalOutcome {
  state: GameState;
  /** The Pal that took a slot, when one was free. */
  admitted: Charge | null;
  /** The Pal that found the tray full: the level is lost on this beat. */
  rejected: Charge | null;
}

const NOTHING_PENDING = (state: GameState): ArrivalOutcome => ({ state, admitted: null, rejected: null });

/**
 * Commit the oldest pending arrival. `chargeId` asserts WHICH Pal is arriving
 * (the presentation knows); passing one that is not at the head is a no-op, so
 * out-of-order presentation can never reorder admission.
 */
export function resolveArrival(state: GameState, chargeId?: string): ArrivalOutcome {
  const head = state.pendingHolding[0];
  if (!head) return NOTHING_PENDING(state);
  if (chargeId !== undefined && head.charge.id !== chargeId) return NOTHING_PENDING(state);

  const rest = state.pendingHolding.slice(1);
  if (state.holding.length < state.holdingCapacity) {
    const next = settleStatus({ ...state, holding: [...state.holding, head.charge], pendingHolding: rest });
    return { state: next, admitted: head.charge, rejected: null };
  }
  // No room when it landed: this is the reject, and the loss commits with it.
  // The level is over, so nothing still inbound can commit either — the queue
  // empties with it, and a finished game is never left holding a live arrival.
  const next: GameState = { ...state, pendingHolding: [], status: 'lost', epoch: null };
  return { state: next, admitted: null, rejected: head.charge };
}

/**
 * Commit every arrival whose grace window has elapsed (`dueAt <= movesApplied`),
 * oldest first, stopping at the first rejection. This is how a timeline that
 * has no wall clock — the solver, and any pure analysis — advances arrivals:
 * each pending Pal gets exactly one player action of grace, which is the same
 * one-lap spacing the epoch already uses.
 *
 * The live session does not use this: it commits each arrival with
 * {@link resolveArrival} on the frame that Pal actually reaches the Gate.
 */
export function settleDueArrivals(state: GameState): GameState {
  // Commit everything whose grace has run out, oldest first, then age the rest
  // by one action. Doing it in that order is what gives a Pal created by THIS
  // action a full action of grace before it is judged.
  let current = state;
  while (
    current.status === 'playing'
    && current.pendingHolding.length > 0
    && current.pendingHolding[0]!.grace <= 0
  ) {
    const outcome = resolveArrival(current);
    current = outcome.state;
    if (outcome.rejected) break;
  }
  if (current.status !== 'playing' || current.pendingHolding.length === 0) return current;
  return {
    ...current,
    pendingHolding: current.pendingHolding.map((p) => (p.grace > 0 ? { ...p, grace: p.grace - 1 } : p)),
  };
}

/** Every Pal still travelling toward an undecided Holding admission. */
export function pendingArrivalCharges(state: GameState): Charge[] {
  return state.pendingHolding.map((p) => p.charge);
}

/**
 * Apply one action the way a PURE replay must: resolve it, then commit any
 * arrival whose grace window has elapsed. Every timeline that has no wall clock
 * — the solver, witness replay, trace, analysis — goes through this, so none of
 * them can drift from the search the campaign is validated with.
 *
 * The live session does NOT use it: there, each arrival commits on the frame
 * its Pal actually reaches the Gate.
 */
export function applyActionWithArrivals(state: GameState, action: GameAction): LaunchOutcome {
  const outcome = resolveAction(state, action);
  if (!outcome.accepted) return outcome;
  return { ...outcome, state: settleDueArrivals(outcome.state) };
}
