import { actionRejection, type GameAction, type Rejection } from './actions';
import {
  commitLaunch,
  launchedResolution,
  planLaunch,
  resolveEpochLaunch,
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
    ...(e.frozenBreak ? { frozenBreak: true } : {}),
    ...(e.shieldBreak ? { shieldBreak: true } : {}),
    ...(e.linkedPrime ? { linkedPrime: true } : {}),
    ...(e.linkedGroupClear ? { linkedGroupClear: true } : {}),
    ...(e.linkedGroupId ? { linkedGroupId: e.linkedGroupId } : {}),
    ...(e.linkedClearedPixelIds ? { linkedClearedPixelIds: [...e.linkedClearedPixelIds] } : {}),
  }));
  return {
    charge,
    pass: {
      charge: { id: charge.id, color: charge.color, capacity: charge.remainingCapacity },
      state,
      progress: charge.finishTime - charge.insertionTime,
      phase: 'finished',
      encounters,
      consumedBins: new Set(encounters.map((e) => e.binId).filter((id): id is string => id !== undefined)),
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
  // FIRST LAUNCHED, FIRST SERVED: the charges already on the rail were resolved
  // when they launched and never change. Resolve only the new one, against the
  // board they left (= this committed state).
  const own = resolveEpochLaunch(state, plan.launches[plan.launches.length - 1]!);
  const resolution: EpochResolution = {
    pixels: own.pixels,
    charges: plan.joined ? [...state.activeCharges, own.charge] : [own.charge],
  };
  const flushed = commitLaunch(state, plan, resolution);
  flushed.status = computeStatus(flushed);
  if (flushed.status !== 'won') {
    const parkedIds = resolution.charges
      .filter((c) => c.landed === 'holding')
      .map((c) => c.id);
    const heldIds = new Set(flushed.holding.map((c) => c.id));
    if (parkedIds.some((id) => !heldIds.has(id))) {
      flushed.status = 'lost';
      flushed.epoch = null;
    }
  }

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
