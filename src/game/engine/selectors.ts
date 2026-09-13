import { actionRejection } from './actions';
import { activeCapacityOf, activeSlotCount } from './epoch';
import { isCoreV2 } from './ruleset';
import type { Charge, GameRuleset, GameState, OrbColor, TunnelState } from './types';

/** Core V2 product rule: CURRENT + NEXT + NEXT+1. */
export const VISIBLE_TUNNEL_ENTRIES = 3;
/** Upcoming magazine chips behind the loaded front (VISIBLE_TUNNEL_ENTRIES - 1). */
export const MAX_UPCOMING_PREVIEWS = VISIBLE_TUNNEL_ENTRIES - 1;
/** Legacy V1 magazine still shows one extra chip (front + 3). */
export const LEGACY_UPCOMING_PREVIEWS = 3;

export function visibleTunnelEntryCount(ruleset: GameRuleset | undefined): number {
  return isCoreV2(ruleset) ? VISIBLE_TUNNEL_ENTRIES : 1 + LEGACY_UPCOMING_PREVIEWS;
}

export function upcomingPreviewCount(ruleset: GameRuleset | undefined): number {
  return visibleTunnelEntryCount(ruleset) - 1;
}

/** The loaded front plus the allowed upcoming previews. Hidden tail stays in `queue`. */
export function visibleTunnelWindow(
  queue: readonly Charge[],
  ruleset: GameRuleset | undefined,
): Charge[] {
  return queue.slice(0, visibleTunnelEntryCount(ruleset));
}

export function holdingWarnAt(capacity: number): number {
  return Math.max(1, capacity - 1);
}

/** The visible front charge of a tunnel, or `null` when its queue is empty. */
export function frontCharge(tunnel: TunnelState): Charge | null {
  return tunnel.queue[0] ?? null;
}

export interface VisibleCharge {
  tunnelId: string;
  charge: Charge | null;
}

/** The visible front charge of each tunnel, in tunnel order. */
export function visibleCharges(state: GameState): VisibleCharge[] {
  return state.tunnels.map((tunnel) => ({
    tunnelId: tunnel.id,
    charge: frontCharge(tunnel),
  }));
}

export function findTunnel(
  state: GameState,
  tunnelId: string,
): TunnelState | undefined {
  return state.tunnels.find((tunnel) => tunnel.id === tunnelId);
}

/** Whether tapping `tunnelId` right now is a legal move. */
export function isTunnelSelectable(state: GameState, tunnelId: string): boolean {
  return actionRejection(state, { kind: 'tunnel', id: tunnelId }) === null;
}

/** Whether any tunnel still has a charge to launch. */
export function anyLaunchAvailable(state: GameState): boolean {
  return state.tunnels.some((tunnel) => tunnel.queue.length > 0);
}

export function holdingIsFull(state: GameState): boolean {
  return state.holding.length >= state.holdingCapacity;
}

export function tunnelCount(state: GameState): number {
  return state.tunnels.length;
}

/** Engine occupancy of the open epoch (0 when idle). */
export function activeCount(state: GameState): number {
  return activeSlotCount(state);
}

export function activeCapacity(state: GameState): number {
  return activeCapacityOf(state);
}

/** Count of uncleared pixels of a given color (reachable or not). */
export function pixelsRemainingOfColor(state: GameState, color: OrbColor): number {
  let n = 0;
  for (const p of state.pixels) if (!p.cleared && p.color === color) n += 1;
  return n;
}

/** Distinct colors still present in the picture, in first-seen pixel order. */
export function remainingColors(state: GameState): OrbColor[] {
  const seen = new Set<OrbColor>();
  for (const p of state.pixels) if (!p.cleared) seen.add(p.color);
  return [...seen];
}
