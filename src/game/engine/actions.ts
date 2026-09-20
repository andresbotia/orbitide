import {
  activeCapacityOf,
  activeSlotCount,
  canJoinEpoch,
} from './epoch';
import { isCoreV2 } from './ruleset';
import type { GameState } from './types';

/**
 * `join: true` means the player launched this charge while earlier charges are
 * still visibly on the rail, so it enters the running epoch and arbitrates
 * against them. Omitted / `false` is the default: the player waited for the
 * board to settle, so the launch starts a fresh epoch and resolves exactly like
 * M1. This coarse "now vs after it settles" choice (spec §8) is the only way
 * launch timing affects the outcome.
 */
export type GameAction =
  | { kind: 'tunnel'; id: string; join?: boolean }
  | { kind: 'holding'; id: string; join?: boolean };
/**
 * `activeSlotsFull` is produced by Core V2 when a join is requested at
 * `activeCapacity`. Legacy V1 still opens a fresh epoch instead of rejecting.
 *
 * `noTargets` is gone: a held Pal is no longer refused because its colour
 * happens to be buried at this exact frame (see {@link actionRejection}).
 */
export type Rejection = 'gameOver' | 'missingCharge' | 'holdingFull' | 'activeSlotsFull';

// Reserved for a future deadlock-detection knob; no options are needed today.
type RejectionOptions = Record<string, never>;

/** The charge a tunnel/holding action would launch, or `null` when unavailable. */
export function launchCandidate(state: GameState, action: GameAction) {
  if (action.kind === 'holding') return state.holding.find((c) => c.id === action.id) ?? null;
  return state.tunnels.find((t) => t.id === action.id)?.queue[0] ?? null;
}

/** Runtime id of the charge a launch action would send, or `undefined`. */
export function actionChargeId(state: GameState, action: GameAction): string | undefined {
  return launchCandidate(state, action)?.id;
}

export function actionRejection(
  state: GameState,
  action: GameAction,
  _options: RejectionOptions = {},
): Rejection | null {
  if (state.status !== 'playing') return 'gameOver';

  const charge = launchCandidate(state, action);
  if (!charge) return 'missingCharge';

  // Core V2: a join at capacity is a hard deny — do not silently open a fresh
  // epoch, pop a queue, or free a Holding slot.
  if (
    isCoreV2(state.ruleset)
    && action.join === true
    && activeSlotCount(state) >= activeCapacityOf(state)
  ) {
    return 'activeSlotsFull';
  }

  if (action.kind === 'holding') {
    // RULESET-INDEPENDENT (approved semantics change): a held Pal may relaunch
    // whether or not a matching target is exposed right now. The player is
    // allowed to spend an Active slot on a Pal that may miss this lap.
    //
    // Legacy V1 used to require a currently reachable matching target here.
    // With a full tray that made relaunching — the player's way OUT of a full
    // tray — impossible whenever every held colour was buried, with free Active
    // slots sitting unused. Board exposure also changes while a Pal travels, so
    // "exposed at this exact frame" was never the right question.
    //
    // The cost of allowing it is that a relaunch can now be a no-op loop, so
    // "a legal action exists" no longer implies "the board can still change".
    // `isLost` carries that weight instead — see `isProductiveAction`.
    //
    // Relaunching from Holding frees the slot it leaves, so it can never end the
    // pass over capacity (capacity only ever falls). Matches M1.
    return null;
  }

  // Full Holding must not pre-empt a legal tunnel tap. The player may launch;
  // overflow is a LOSS after the pass if this Pal (or a joined peer) still
  // needs a slot. See commitLaunch / resolveAction.

  return null;
}

/**
 * Every action worth *considering* from `state`, before admission filtering:
 * one launch per tunnel-with-a-queue and one per held charge. When `includeJoin`
 * is set and an epoch is open, each launch also gets a `join: true` variant —
 * but only for a charge that {@link canJoinEpoch} would actually let onto the
 * running rail, so a `join: true` here always denotes a real alternative to the
 * settle-first launch (never a silent no-op).
 *
 * This is the ONE candidate generator: {@link legalActions} (runtime + deadlock
 * check) and the solver's `enumerateActions` both build on it, so the two can
 * never disagree about which actions exist.
 */
export function candidateActions(state: GameState, includeJoin = false): GameAction[] {
  const launches: GameAction[] = [
    ...state.tunnels.filter((t) => t.queue.length).map((t) => ({ kind: 'tunnel' as const, id: t.id })),
    ...state.holding.map((c) => ({ kind: 'holding' as const, id: c.id })),
  ];
  if (!includeJoin || !state.epoch) return launches;
  const out: GameAction[] = [];
  for (const a of launches) {
    out.push(a);
    const chargeId = actionChargeId(state, a);
    if (chargeId && canJoinEpoch(state, chargeId)) out.push({ ...a, join: true });
  }
  return out;
}

/**
 * The candidate actions the runtime would actually admit — the single source of
 * truth for "what can the player do now". Pass `includeJoin` (concurrent solver
 * / live session) to also consider joining the running epoch.
 */
export function legalActions(state: GameState, opts: { includeJoin?: boolean } = {}): GameAction[] {
  return candidateActions(state, opts.includeJoin ?? false)
    .filter((a) => actionRejection(state, a) === null);
}
