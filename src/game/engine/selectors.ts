import type { Charge, GameState, OrbColor, TunnelState } from './types';

/** The visible front charge of a tunnel, or `null` when its queue is empty. */
export function frontCharge(tunnel: TunnelState): Charge | null {
  return tunnel.queue[0] ?? null;
}

export interface VisibleCharge {
  tunnelId: string;
  charge: Charge | null;
}

/** The three visible front charges (one per tunnel), in tunnel order. */
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
  if (state.status !== 'playing') return false;
  const tunnel = findTunnel(state, tunnelId);
  return !!tunnel && tunnel.queue.length > 0;
}

/** Whether any tunnel still has a charge to launch. */
export function anyLaunchAvailable(state: GameState): boolean {
  return state.tunnels.some((tunnel) => tunnel.queue.length > 0);
}

export function holdingIsFull(state: GameState): boolean {
  return state.holding.length >= state.holdingCapacity;
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
