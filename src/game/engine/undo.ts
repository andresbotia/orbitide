import type { GameState } from './types';

/**
 * Creates an authoritative, isolated logical snapshot of GameState for One-Step Undo.
 * Does not snapshot React views or presentation objects.
 */
export function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    pixels: state.pixels.map((p) => ({ ...p })),
    tunnels: state.tunnels.map((t) => ({
      ...t,
      queue: t.queue.map((c) => ({ ...c })),
    })),
    holding: state.holding.map((c) => ({ ...c })),
    pendingHolding: state.pendingHolding.map((p) => ({
      ...p,
      charge: { ...p.charge },
    })),
    activeCharges: state.activeCharges.map((a) => ({
      ...a,
      encounters: a.encounters.map((e) => ({ ...e })),
    })),
    epoch: state.epoch
      ? { clock: state.epoch.clock, launches: state.epoch.launches.map((l) => ({ ...l })) }
      : null,
  };
}

/**
 * Restores a snapshot into a clean, idle gameplay state ready for player input.
 * Preserves the Extra Slot booster (capacity 4) if it was activated during this level run.
 */
export function restoreSnapshot(snapshot: GameState, extraSlotActive: boolean): GameState {
  const restored = cloneGameState(snapshot);
  return {
    ...restored,
    holdingCapacity: extraSlotActive ? Math.max(restored.holdingCapacity, 4) : restored.holdingCapacity,
    // When rolling back, any in-flight flights/arrivals that were spawned after this snapshot
    // are terminated, so the restored state returns to idle on the rail.
    activeCharges: [],
    epoch: null,
    pendingHolding: restored.pendingHolding,
    status: 'playing',
  };
}
