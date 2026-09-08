import { settle } from './resolveHolding';
import { getActiveTarget } from './selectors';
import type { GameState, Orb, OrbColor } from './types';
import { computeStatus } from './winState';

export interface MoveOutcome {
  /** The state after the move. Referentially equal to the input if rejected. */
  state: GameState;
  /** Whether the engine accepted and applied the tap. */
  accepted: boolean;
  /** How the tapped orb resolved. `undefined` when the move was rejected. */
  kind?: 'core' | 'held';
  /** True when tapping the orb completed the active Core target. */
  completedTarget: boolean;
  /** True when this move (incl. auto-resolution) completed the whole sequence. */
  completedAllTargets: boolean;
  /** Orbs pulled from the tray by automatic resolution, in resolve order. */
  autoResolved: Orb[];
  /** The tapped orb, when the move was accepted. */
  movedOrb?: Orb;
}

function reject(state: GameState): MoveOutcome {
  return {
    state,
    accepted: false,
    completedTarget: false,
    completedAllTargets: false,
    autoResolved: [],
  };
}

/**
 * Resolve a single player tap on the exposed orb identified by `orbId`.
 *
 * Pure and deterministic. On an illegal tap (game already over, unknown id, or
 * an id that is not currently the exposed orb of its lane) the *same* state
 * object is returned and `accepted` is false — this is the guard that makes
 * rapid tapping and stale taps harmless: a double tap on an orb that was just
 * consumed simply no-ops.
 */
export function resolveMove(state: GameState, orbId: string): MoveOutcome {
  if (state.status !== 'playing') return reject(state);

  const laneIndex = state.lanes.findIndex((lane) => lane[0]?.id === orbId);
  if (laneIndex === -1) return reject(state);

  const sourceLane = state.lanes[laneIndex];
  const orb = sourceLane?.[0];
  if (!sourceLane || !orb) return reject(state);

  // Work on fresh copies — the input state is never mutated.
  const lanes = state.lanes.map((lane) => lane.slice());
  const holding = state.holding.slice();
  const targets = state.targets.map((target) => ({ ...target }));

  lanes[laneIndex] = sourceLane.slice(1);

  const activeBefore = getActiveTarget({ ...state, targets });
  const activeColor: OrbColor | undefined = activeBefore?.color;

  let activeTargetIndex = state.activeTargetIndex;
  let kind: 'core' | 'held';
  let completedTarget = false;

  if (activeBefore && orb.color === activeColor) {
    kind = 'core';
    activeBefore.count -= 1;
    if (activeBefore.count === 0) {
      completedTarget = true;
      activeTargetIndex += 1;
    }
  } else {
    kind = 'held';
    holding.push(orb);
  }

  // Automatic held-orb resolution (also chains through further targets).
  const settled = settle(targets, holding, activeTargetIndex);
  activeTargetIndex = settled.activeTargetIndex;

  const next: GameState = {
    ...state,
    lanes,
    holding,
    targets,
    activeTargetIndex,
    movesApplied: state.movesApplied + 1,
    status: 'playing',
  };
  next.status = computeStatus(next);

  return {
    state: next,
    accepted: true,
    kind,
    completedTarget,
    completedAllTargets: next.targets.every((t) => t.count === 0),
    autoResolved: settled.autoResolved,
    movedOrb: orb,
  };
}
