import { resolvePass } from './pass';
import { reachablePixels } from './pixels';
import type { GameState } from './types';

export type GameAction = { kind: 'tunnel'; id: string } | { kind: 'holding'; id: string };
export type Rejection = 'gameOver' | 'missingCharge' | 'noTargets' | 'holdingFull';
export function actionRejection(state: GameState, action: GameAction): Rejection | null {
  if (state.status !== 'playing') return 'gameOver';
  if (action.kind === 'holding') {
    const charge = state.holding.find((c) => c.id === action.id);
    if (!charge) return 'missingCharge';
    return reachablePixels(state).some((p) => p.color === charge.color) ? null : 'noTargets';
  }
  const charge = state.tunnels.find((t) => t.id === action.id)?.queue[0];
  if (!charge) return 'missingCharge';
  if (state.holding.length < state.holdingCapacity) return null;
  // Never gamble with a fourth Holding slot. A full tray still allows a charge
  // that will be completely consumed, including any newly exposed targets.
  return resolvePass(state, charge).charge.capacity === 0 ? null : 'holdingFull';
}
export function legalActions(state: GameState): GameAction[] {
  const candidates: GameAction[] = [
    ...state.tunnels.filter((t) => t.queue.length).map((t) => ({ kind: 'tunnel' as const, id: t.id })),
    ...state.holding.map((c) => ({ kind: 'holding' as const, id: c.id })),
  ];
  return candidates.filter((a) => actionRejection(state, a) === null);
}
