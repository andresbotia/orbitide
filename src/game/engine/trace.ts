/**
 * Witness replay — the ONE trace utility.
 *
 * Given a `LevelDefinition` and an ordered `GameAction[]` (a solver winning or
 * failing witness, or any hand-authored line), produce a frame-by-frame trace by
 * replaying it through the REAL engine (`createGame` + `resolveAction`). No
 * board state is ever reconstructed by hand; every frame is an actual
 * `GameState` the engine produced.
 *
 * The same trace structure feeds both the winning-path and failing-path
 * visualisers.
 */
import type { GameAction, Rejection } from './actions';
import { createGame } from './createGame';
import { iceLayers, shieldLayers } from './frozen';
import { isLinkedPrimed, linkedGroupId } from './linked';
import { reachablePixels, remainingPixelCount } from './pixels';
import { resolveAction } from './resolveLaunch';
import type { GameState, GameStatus, LevelDefinition, OrbColor } from './types';

export interface TraceCharge {
  id: string;
  color: OrbColor;
  /** Capacity the charge launched with this step. */
  startingCapacity: number;
  /** Capacity left after the step (0 when fully consumed). */
  remainingCapacity: number;
  /** Where it ended up: consumed by the board, or parked in Holding. */
  landed: 'consumed' | 'holding';
}

export interface TraceStep {
  /** 1-based step number. */
  index: number;
  action: GameAction;
  actionLabel: string;
  source: { kind: 'tunnel' | 'holding'; id: string; tunnelIndex: number };
  /** `true` when this launch joined a running epoch. */
  joined: boolean;
  charge: TraceCharge | null;
  /** Charges on the rail immediately after this launch resolved. */
  activeCount: number;
  holdingBefore: { id: string; color: OrbColor; capacity: number }[];
  holdingAfter: { id: string; color: OrbColor; capacity: number }[];
  /** Pixel ids cleared by this step, in engine order (a FROZEN break is NOT a clear). */
  clearedPixelIds: string[];
  /** Frozen pixel ids whose ice cracked this step (one layer lost, pixel not cleared). */
  frozenBreakPixelIds: string[];
  /** Shielded pixel ids whose membrane collapsed this step. */
  shieldBreakPixelIds: string[];
  /** Linked members energized this step without completing their group. */
  linkedPrimePixelIds: string[];
  /** Linked group ids atomically discharged and cleared this step. */
  linkedGroupClearIds: string[];
  /** Pixel ids that became reachable this step and are not yet cleared. */
  newlyExposedPixelIds: string[];
  /** Uncleared pixels remaining after this step. */
  remainingPixels: number;
  status: GameStatus;
  accepted: boolean;
  rejection?: Rejection;
}

export type TraceOutcome = 'won' | 'lost' | 'incomplete' | 'rejected';

export interface Trace {
  levelId: number;
  /** `frames[0]` is the initial state; `frames[i]` is the state after step `i`. */
  frames: GameState[];
  steps: TraceStep[];
  finalStatus: GameStatus;
  outcome: TraceOutcome;
  /** Authored charges (tunnel + starting Holding) never launched anywhere in the line. */
  unusedChargeIds: string[];
  /** Total authored tunnel capacity minus the capacity actually spent clearing pixels. */
  unusedCapacity: number;
}

function reachableIds(state: GameState): Set<string> {
  return new Set(reachablePixels(state).map((p) => p.id));
}

function clearedThisStep(before: GameState, after: GameState): string[] {
  const wasCleared = new Set(before.pixels.filter((p) => p.cleared).map((p) => p.id));
  return after.pixels.filter((p) => p.cleared && !wasCleared.has(p.id)).map((p) => p.id);
}

function frozenBrokenThisStep(before: GameState, after: GameState): string[] {
  const iceBefore = new Map(before.pixels.map((p) => [p.id, iceLayers(p)]));
  return after.pixels
    .filter((p) => !p.cleared && iceLayers(p) < (iceBefore.get(p.id) ?? 0))
    .map((p) => p.id);
}

function shieldBrokenThisStep(before: GameState, after: GameState): string[] {
  const beforeLayers = new Map(before.pixels.map((p) => [p.id, shieldLayers(p)]));
  return after.pixels
    .filter((p) => !p.cleared && shieldLayers(p) < (beforeLayers.get(p.id) ?? 0))
    .map((p) => p.id);
}

function linkedPrimedThisStep(before: GameState, after: GameState): string[] {
  const primedBefore = new Set(before.pixels.filter(isLinkedPrimed).map((p) => p.id));
  return after.pixels
    .filter((p) => isLinkedPrimed(p) && !primedBefore.has(p.id) && !p.cleared)
    .map((p) => p.id);
}

function linkedGroupsClearedThisStep(before: GameState, after: GameState): string[] {
  const afterById = new Map(after.pixels.map((pixel) => [pixel.id, pixel]));
  const groups = new Set<string>();
  for (const pixel of before.pixels) {
    const group = linkedGroupId(pixel);
    if (group !== undefined && !pixel.cleared && afterById.get(pixel.id)?.cleared) groups.add(group);
  }
  return [...groups].sort((a, b) => a.localeCompare(b));
}

/** Replay `actions` from a fresh game and record every frame + step. */
export function traceActions(level: LevelDefinition, actions: GameAction[]): Trace {
  const initial = createGame(level);
  const frames: GameState[] = [initial];
  const steps: TraceStep[] = [];
  const launchedChargeIds = new Set<string>();

  let state = initial;
  let rejected = false;

  actions.forEach((action, i) => {
    if (rejected || state.status !== 'playing') return;

    const before = state;
    const beforeReach = reachableIds(before);
    const tunnelIndex = action.kind === 'tunnel'
      ? before.tunnels.findIndex((t) => t.id === action.id)
      : -1;
    const launched = action.kind === 'tunnel'
      ? before.tunnels.find((t) => t.id === action.id)?.queue[0]
      : before.holding.find((c) => c.id === action.id);

    const outcome = resolveAction(before, action);

    if (!outcome.accepted) {
      steps.push({
        index: i + 1, action, actionLabel: describeTraceAction(action),
        source: { kind: action.kind, id: action.id, tunnelIndex },
        joined: false, charge: null, activeCount: before.epoch?.launches.length ?? 0,
        holdingBefore: snapshotHolding(before), holdingAfter: snapshotHolding(before),
        clearedPixelIds: [], frozenBreakPixelIds: [], shieldBreakPixelIds: [],
        linkedPrimePixelIds: [], linkedGroupClearIds: [], newlyExposedPixelIds: [],
        remainingPixels: remainingPixelCount(before), status: before.status,
        accepted: false, rejection: outcome.rejection,
      });
      rejected = true;
      return;
    }

    state = outcome.state;
    frames.push(state);
    if (launched) launchedChargeIds.add(launched.id);

    const cleared = clearedThisStep(before, state);
    const frozenBroken = frozenBrokenThisStep(before, state);
    const shieldBroken = shieldBrokenThisStep(before, state);
    const linkedPrimed = linkedPrimedThisStep(before, state);
    const linkedCleared = linkedGroupsClearedThisStep(before, state);
    const afterReach = reachableIds(state);
    const clearedSet = new Set(cleared);
    const newlyExposed = [...afterReach].filter((id) => !beforeReach.has(id) && !clearedSet.has(id));

    const resolved = outcome.epochCharges?.find((c) => c.id === launched?.id);
    steps.push({
      index: i + 1, action, actionLabel: describeTraceAction(action),
      source: { kind: action.kind, id: action.id, tunnelIndex },
      joined: outcome.joinedEpoch === true,
      charge: launched
        ? {
          id: launched.id, color: launched.color, startingCapacity: launched.capacity,
          remainingCapacity: outcome.heldCharge?.capacity ?? 0,
          landed: resolved?.landed ?? (outcome.heldCharge ? 'holding' : 'consumed'),
        }
        : null,
      activeCount: outcome.epochCharges?.length ?? state.epoch?.launches.length ?? 0,
      holdingBefore: snapshotHolding(before),
      holdingAfter: snapshotHolding(state),
      clearedPixelIds: cleared,
      frozenBreakPixelIds: frozenBroken,
      shieldBreakPixelIds: shieldBroken,
      linkedPrimePixelIds: linkedPrimed,
      linkedGroupClearIds: linkedCleared,
      newlyExposedPixelIds: newlyExposed,
      remainingPixels: remainingPixelCount(state),
      status: state.status,
      accepted: true,
    });
  });

  const finalStatus = state.status;
  const outcome: TraceOutcome = rejected
    ? 'rejected'
    : finalStatus === 'won' ? 'won'
      : finalStatus === 'lost' ? 'lost'
        : 'incomplete';

  const authoredChargeIds = [
    ...initial.tunnels.flatMap((t) => t.queue.map((c) => c.id)),
    ...initial.holding.map((c) => c.id),
  ];
  const unusedChargeIds = authoredChargeIds.filter((id) => !launchedChargeIds.has(id));

  const totalAuthoredCapacity = initial.tunnels.reduce(
    (n, t) => n + t.queue.reduce((m, c) => m + c.capacity, 0), 0,
  );
  const capacitySpent = steps.reduce((n, step) => n + (step.charge
    ? step.charge.startingCapacity - step.charge.remainingCapacity
    : 0), 0);
  const unusedCapacity = Math.max(0, totalAuthoredCapacity - capacitySpent);

  return { levelId: level.id, frames, steps, finalStatus, outcome, unusedChargeIds, unusedCapacity };
}

function snapshotHolding(state: GameState) {
  return state.holding.map((c) => ({ id: c.id, color: c.color, capacity: c.capacity }));
}

export function describeTraceAction(action: GameAction): string {
  const where = action.kind === 'tunnel'
    ? `Tunnel ${String.fromCharCode(65 + Number(action.id.replace('tunnel-', '')))}`
    : `Holding ${action.id}`;
  return action.join ? `${where} (join)` : where;
}
