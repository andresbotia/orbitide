import type { CoreTarget, GameState, Lane, Orb } from './types';

/** The exposed (selectable) orb of a lane, or `undefined` if the lane is empty. */
export function getExposedOrb(lane: Lane): Orb | undefined {
  return lane[0];
}

export interface ExposedOrb {
  laneIndex: number;
  orb: Orb;
}

/** Every currently selectable orb, one per non-empty lane. */
export function getExposedOrbs(state: GameState): ExposedOrb[] {
  const result: ExposedOrb[] = [];
  state.lanes.forEach((lane, laneIndex) => {
    const orb = lane[0];
    if (orb) result.push({ laneIndex, orb });
  });
  return result;
}

/** The Core target awaiting resolution, or `undefined` once all are complete. */
export function getActiveTarget(state: GameState): CoreTarget | undefined {
  return state.targets[state.activeTargetIndex];
}

/** The active Core color, or `undefined` once every target is complete. */
export function getActiveColor(state: GameState) {
  return getActiveTarget(state)?.color;
}

/** Remaining count on the active target (0 when the sequence is complete). */
export function getRemainingCount(state: GameState): number {
  return getActiveTarget(state)?.count ?? 0;
}

export function allLanesEmpty(state: GameState): boolean {
  return state.lanes.every((lane) => lane.length === 0);
}

export function holdingIsFull(state: GameState): boolean {
  return state.holding.length >= state.holdingCapacity;
}

export function allTargetsComplete(state: GameState): boolean {
  return state.targets.every((target) => target.count === 0);
}

/**
 * Whether `orbId` names the exposed orb of some lane in the current state.
 * The single source of truth for "is this tap legal".
 */
export function isSelectable(state: GameState, orbId: string): boolean {
  return state.lanes.some((lane) => lane[0]?.id === orbId);
}
