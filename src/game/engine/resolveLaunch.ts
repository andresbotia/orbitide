import { actionRejection, type GameAction, type Rejection } from './actions';
import {
  flushEpoch,
  launchedResolution,
  planLaunch,
  simulateEpoch,
  type EpochResolution,
} from './epoch';
import type { ChargePass, Encounter } from './pass';
import type { ActiveCharge, Charge, EpochLaunch, GameState } from './types';
import { computeStatus } from './winState';

export interface LaunchOutcome {
  state: GameState;
  accepted: boolean;
  action: GameAction;
  rejection?: Rejection;
  sourceIndex: number;
  launchedCharge?: Charge;
  /**
   * The launched charge's own resolution, shaped like an M1 {@link ChargePass}
   * for back-compat with the single-charge presentation path.
   */
  pass?: ChargePass;
  /** Every charge in the epoch, in launch order (M2B multi-charge presentation). */
  epochCharges?: ActiveCharge[];
  /** Whether this launch joined an already-running epoch. */
  joinedEpoch?: boolean;
  heldCharge: Charge | null;
}

function toChargePass(
  resolution: EpochResolution,
  chargeId: string,
  state: GameState,
): { pass: ChargePass; charge: ActiveCharge } {
  const charge = launchedResolution(resolution, chargeId);
  const encounters: Encounter[] = charge.encounters.map((e) => ({
    pixelId: e.pixelId,
    progress: e.progress,
    remaining: e.remaining,
  }));
  return {
    charge,
    pass: {
      charge: { id: charge.id, color: charge.color, capacity: charge.remainingCapacity },
      state,
      progress: charge.finishTime - charge.insertionTime,
      phase: 'finished',
      encounters,
    },
  };
}

export function resolveAction(state: GameState, action: GameAction): LaunchOutcome {
  const rejection = actionRejection(state, action);
  if (rejection) return { state, action, accepted: false, rejection, sourceIndex: -1, heldCharge: null };

  const sourceIndex = action.kind === 'tunnel'
    ? state.tunnels.findIndex((t) => t.id === action.id)
    : state.holding.findIndex((c) => c.id === action.id);
  const source = action.kind === 'tunnel' ? state.tunnels[sourceIndex]!.queue[0]! : state.holding[sourceIndex]!;
  const launchedCharge: Charge = { ...source };

  const spec: Omit<EpochLaunch, 'insertionTime'> = {
    chargeId: source.id,
    source: action.kind,
    originId: action.id,
    color: source.color,
    capacity: source.capacity,
    launchSequence: state.movesApplied,
  };
  const plan = planLaunch(state, spec, action.join === true);
  const resolution = simulateEpoch(plan.baseline, plan.launches);
  const flushed = flushEpoch(plan, resolution);
  flushed.status = computeStatus(flushed);

  const { pass, charge } = toChargePass(resolution, source.id, flushed);
  const heldCharge = charge.remainingCapacity > 0
    ? { id: charge.id, color: charge.color, capacity: charge.remainingCapacity }
    : null;

  return {
    state: flushed,
    action,
    accepted: true,
    sourceIndex,
    launchedCharge,
    pass,
    epochCharges: resolution.charges,
    joinedEpoch: plan.joined,
    heldCharge,
  };
}

export function resolveLaunch(state: GameState, tunnelId: string): LaunchOutcome {
  return resolveAction(state, { kind: 'tunnel', id: tunnelId });
}
