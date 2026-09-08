import { resolveAction } from './resolveLaunch';
import type { GameState } from './types';
/** Only an explicit player action can remove/relaunch a held charge. */
export function resolveHoldingLaunch(state: GameState, chargeId: string) {
  return resolveAction(state, { kind: 'holding', id: chargeId });
}
