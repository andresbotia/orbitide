import { actionRejection, type GameAction, type Rejection } from './actions';
import { resolvePass, type ChargePass } from './pass';
import type { Charge, GameState } from './types';
import { computeStatus } from './winState';

export interface LaunchOutcome {
  state: GameState;
  accepted: boolean;
  action: GameAction;
  rejection?: Rejection;
  sourceIndex: number;
  launchedCharge?: Charge;
  pass?: ChargePass;
  heldCharge: Charge | null;
}
export function resolveAction(state: GameState, action: GameAction): LaunchOutcome {
  const rejection = actionRejection(state, action);
  if (rejection) return { state, action, accepted: false, rejection, sourceIndex: -1, heldCharge: null };
  const sourceIndex = action.kind === 'tunnel'
    ? state.tunnels.findIndex((t) => t.id === action.id)
    : state.holding.findIndex((c) => c.id === action.id);
  const charge = action.kind === 'tunnel' ? state.tunnels[sourceIndex]!.queue[0]! : state.holding[sourceIndex]!;
  const launchedCharge = { ...charge };
  const start: GameState = {
    ...state, movesApplied: state.movesApplied + 1,
    tunnels: action.kind === 'tunnel' ? state.tunnels.map((t, i) =>
      i === sourceIndex ? { ...t, queue: t.queue.slice(1) } : t) : state.tunnels,
    holding: action.kind === 'holding' ? state.holding.filter((c) => c.id !== action.id) : state.holding,
  };
  const pass = resolvePass(start, launchedCharge);
  const heldCharge = pass.charge.capacity > 0 ? { ...pass.charge } : null;
  const next = { ...pass.state, holding: heldCharge ? [...start.holding, heldCharge] : start.holding };
  next.status = computeStatus(next);
  return { state: next, action, accepted: true, sourceIndex, launchedCharge, pass, heldCharge };
}
export function resolveLaunch(state: GameState, tunnelId: string): LaunchOutcome {
  return resolveAction(state, { kind: 'tunnel', id: tunnelId });
}
