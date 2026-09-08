import { applyChargePass } from './pixels';
import { settleHolding, type AutoResolution } from './resolveHolding';
import { findTunnel } from './selectors';
import type { Charge, GameState, Pixel, TunnelState } from './types';
import { computeStatus } from './winState';

export interface LaunchOutcome {
  /** State after the launch. Referentially equal to the input when rejected. */
  state: GameState;
  /** Whether the engine accepted and applied the launch. */
  accepted: boolean;
  tunnelId?: string;
  /** The charge that was launched (with its capacity as it left the tunnel). */
  launchedCharge?: Charge;
  /** Pixels the launched charge cleared, in clear order. */
  primaryClearedPixelIds: string[];
  /** True when the launched charge emptied on its pass. */
  primaryConsumed: boolean;
  /** The launched charge parked in Holding (leftover capacity), else null. */
  heldCharge: Charge | null;
  /** Held-charge relaunches triggered by this move, in resolution order. */
  autoResolutions: AutoResolution[];
  /** The next front charge now visible in the launched tunnel, or null. */
  revealedCharge: Charge | null;
  status: GameState['status'];
}

function reject(state: GameState): LaunchOutcome {
  return {
    state,
    accepted: false,
    primaryClearedPixelIds: [],
    primaryConsumed: false,
    heldCharge: null,
    autoResolutions: [],
    revealedCharge: null,
    status: state.status,
  };
}

function clonePixels(pixels: Pixel[]): Pixel[] {
  return pixels.map((p) => ({ ...p }));
}

function cloneTunnels(tunnels: TunnelState[]): TunnelState[] {
  return tunnels.map((t) => ({ id: t.id, queue: t.queue.map((c) => ({ ...c })) }));
}

/**
 * Resolve a player tapping tunnel `tunnelId` to launch its front charge.
 *
 * Pure and deterministic. On an illegal tap (game over, unknown tunnel, or an
 * empty tunnel) the *same* state object is returned with `accepted: false` —
 * the guard that makes rapid tapping and stale taps harmless.
 *
 * Sequence:
 *   1. remove the front charge from the tunnel (next charge becomes visible)
 *   2. the charge clears up to `capacity` reachable matching pixels (clockwise)
 *   3. if capacity remains, it parks in Holding
 *   4. run automatic Holding resolution until stable
 *   5. recompute status
 */
export function resolveLaunch(state: GameState, tunnelId: string): LaunchOutcome {
  if (state.status !== 'playing') return reject(state);

  const sourceTunnel = findTunnel(state, tunnelId);
  const front = sourceTunnel?.queue[0];
  if (!sourceTunnel || !front) return reject(state);

  const next: GameState = {
    ...state,
    pixels: clonePixels(state.pixels),
    tunnels: cloneTunnels(state.tunnels),
    holding: state.holding.map((c) => ({ ...c })),
    movesApplied: state.movesApplied + 1,
    status: 'playing',
  };

  const workingTunnel = findTunnel(next, tunnelId) as TunnelState;
  const [launched] = workingTunnel.queue.splice(0, 1);
  const launchedCharge: Charge = { ...(launched as Charge) };

  // Primary pass.
  const pass = applyChargePass(next, launchedCharge.color, launchedCharge.capacity);
  const leftover = launchedCharge.capacity - pass.clearedPixelIds.length;
  const primaryConsumed = leftover <= 0;

  // Snapshot of what parked (before auto-resolution may reduce/consume it).
  let heldCharge: Charge | null = null;
  if (!primaryConsumed) {
    heldCharge = { ...launchedCharge, capacity: leftover };
    next.holding.push({ ...heldCharge });
  }

  // Automatic Holding resolution.
  const autoResolutions = settleHolding(next);

  next.status = computeStatus(next);

  return {
    state: next,
    accepted: true,
    tunnelId,
    launchedCharge,
    primaryClearedPixelIds: pass.clearedPixelIds,
    primaryConsumed,
    heldCharge,
    autoResolutions,
    revealedCharge: workingTunnel.queue[0] ?? null,
    status: next.status,
  };
}
