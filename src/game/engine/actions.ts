import {
  canJoinEpoch,
  committedBaseline,
  flushEpoch,
  planLaunch,
  simulateEpoch,
} from './epoch';
import { resolvePass } from './pass';
import { reachablePixels } from './pixels';
import type { EpochLaunch, GameState } from './types';

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
 * `activeSlotsFull` is never produced by {@link actionRejection} — the engine
 * always accepts a launch (a sixth just opens a fresh epoch). Presentation uses
 * the value to deny a launch while five flights are still visibly in the air.
 */
export type Rejection = 'gameOver' | 'missingCharge' | 'noTargets' | 'holdingFull' | 'activeSlotsFull';

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

/** Project the epoch this launch would produce and read back its committed shape. */
function projectLaunch(state: GameState, action: GameAction) {
  const charge = launchCandidate(state, action)!;
  const spec: Omit<EpochLaunch, 'insertionTime'> = {
    chargeId: charge.id,
    source: action.kind,
    originId: action.id,
    color: charge.color,
    capacity: charge.capacity,
    launchSequence: state.movesApplied,
  };
  const plan = planLaunch(state, spec, action.join === true);
  return flushEpoch(plan, simulateEpoch(plan.baseline, plan.launches));
}

export function actionRejection(
  state: GameState,
  action: GameAction,
  _options: RejectionOptions = {},
): Rejection | null {
  if (state.status !== 'playing') return 'gameOver';

  const charge = launchCandidate(state, action);
  if (!charge) return 'missingCharge';

  if (action.kind === 'holding') {
    if (!reachablePixels(state).some((p) => p.color === charge.color)) return 'noTargets';
    // Relaunching from Holding frees the slot it leaves, so it can never end the
    // pass over capacity (capacity only ever falls). Matches M1.
    return null;
  }

  // A tunnel launch may never leave Holding over capacity. Only worth checking
  // when the tray is already full — a free slot absorbs at most this one launch.
  if (state.holding.length >= state.holdingCapacity) {
    const joins = action.join === true && canJoinEpoch(state, charge.id);
    if (!joins) {
      // Fresh epoch, full tray: allow only a charge that fully consumes itself.
      return resolvePass(committedBaseline(state), charge).charge.capacity === 0 ? null : 'holdingFull';
    }
    // Joining a running epoch: a re-simulation can bump an earlier charge into
    // Holding too, so check the whole projected tray.
    const projected = projectLaunch(state, action);
    if (projected.holding.length > projected.holdingCapacity) return 'holdingFull';
  }

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
