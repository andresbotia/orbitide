import { ENCOUNTER_EPSILON, LAUNCH_SPACING, MAX_ACTIVE_CHARGES } from './concurrency';
import { boardFingerprint } from './frozen';
import { resolveBoardHit } from './linked';
import { pickEncounter } from './pass';
import { reachablePixels } from './pixels';
import type {
  ActiveCharge,
  Charge,
  EpochLaunch,
  EpochState,
  GameState,
  Pixel,
} from './types';

/**
 * M2B concurrent-orbit engine.
 *
 * An **epoch** is a batch of launches whose laps overlap in logical time,
 * resolved as one deterministic discrete-event timeline. The board mutation, the
 * clockwise clear order and the dynamic exposure recompute are all identical to
 * M1 — the only new thing is that up to five charges share the timeline and the
 * engine (never a render callback) decides who reaches which pixel first.
 *
 * Logical time is measured in **laps**. A charge inserted at `insertionTime`
 * reaches lap-progress `t - insertionTime` at logical time `t`, and does at most
 * one lap per launch (leftover capacity parks in Holding; targets exposed behind
 * it wait for a manual relaunch — the M1 rule).
 */

export interface EpochResolution {
  /** Final board after every charge in the epoch has resolved. */
  pixels: Pixel[];
  /** Per-launch resolution, in launch order. */
  charges: ActiveCharge[];
}

interface Cursor {
  launch: EpochLaunch;
  remaining: number;
  /** Absolute logical time of the last event (starts at insertion). */
  cursorTime: number;
  /** Lap-progress so far (`cursorTime - insertionTime`). */
  progress: number;
  encounters: ActiveCharge['encounters'];
  phase: ActiveCharge['phase'];
  finishTime: number;
  /** Pixel ids this cursor has already met this lap (Frozen re-hit guard). */
  hitPixelIds: Set<string>;
}

/**
 * A `(baseline, launches)` pair fully determines the resolution, and the solver
 * re-simulates the same pairs constantly (admission look-ahead, deadlock check,
 * then the actual apply), so memoize. Bounded; cleared wholesale when full.
 */
const SIM_CACHE = new Map<string, EpochResolution>();
const SIM_CACHE_LIMIT = 250_000;

function simKey(baseline: GameState, launches: EpochLaunch[]): string {
  // Insertion time is `index * LAUNCH_SPACING` and only the relative launch order
  // (= array order) affects the tie-break, so neither needs to be in the key.
  const cleared = boardFingerprint(baseline.pixels);
  const launchList = launches
    .map((l) => `${l.source[0]}${l.originId}:${l.color}:${l.capacity}`)
    .join(',');
  return `${baseline.levelId}:${cleared}//${launchList}`;
}

export function simulateEpoch(baseline: GameState, launches: EpochLaunch[]): EpochResolution {
  const key = simKey(baseline, launches);
  const cached = SIM_CACHE.get(key);
  const physics = cached ?? simulateEpochUncached(baseline, launches);
  if (!cached) {
    if (SIM_CACHE.size >= SIM_CACHE_LIMIT) SIM_CACHE.clear();
    SIM_CACHE.set(key, physics);
  }
  // The key deliberately ignores charge identity (two charges of the same colour
  // and capacity resolve identically), so re-label the cached physics with this
  // call's actual launch identities before handing it back.
  return {
    pixels: physics.pixels,
    charges: physics.charges.map((c, i) => ({
      ...c,
      id: launches[i]!.chargeId,
      source: launches[i]!.source,
      originId: launches[i]!.originId,
      insertionTime: launches[i]!.insertionTime,
      launchSequence: launches[i]!.launchSequence,
    })),
  };
}

/**
 * Resolve a whole epoch deterministically.
 *
 * Ordering of simultaneous / near-simultaneous encounters:
 *   1. smallest logical encounter time (within {@link ENCOUNTER_EPSILON})
 *   2. smaller launch sequence
 *   3. smaller target pixel id
 * After each resolved clear the board is mutated and every still-orbiting charge
 * re-queries exposure, so a clear by one charge can expose a target another
 * charge reaches later in the same lap.
 */
function simulateEpochUncached(baseline: GameState, launches: EpochLaunch[]): EpochResolution {
  // Structural sharing: only the pixels that clear are replaced.
  let pixels = baseline.pixels;
  const size = { width: baseline.width, height: baseline.height };
  const boardView = (): GameState => ({ ...baseline, pixels });

  const cursors: Cursor[] = launches.map((launch) => ({
    launch,
    remaining: launch.capacity,
    cursorTime: launch.insertionTime,
    progress: 0,
    encounters: [],
    phase: 'orbiting',
    finishTime: launch.insertionTime + 1,
    hitPixelIds: new Set<string>(),
  }));

  // Logical time reached so far. While the sim advances, every still-orbiting
  // charge keeps flying, so a charge that has not hit anything is nonetheless at
  // lap-progress `simTime - insertionTime` — a target exposed late is met there,
  // not back where the charge was when it launched.
  let simTime = 0;

  // Each step resolves exactly one clear or finishes at least one cursor, so the
  // loop is bounded by (clears + cursor finishes).
  const modifierHits = pixels.reduce((n, p) => {
    if (p.cleared || (p.modifier?.kind !== 'frozen' && p.modifier?.kind !== 'shielded')) return n;
    return n + Math.max(0, Math.trunc(p.modifier.level ?? 1));
  }, 0);
  const maxSteps = pixels.length + modifierHits + cursors.length * 2 + 4;
  for (let step = 0; step < maxSteps; step += 1) {
    const reachable = reachablePixels(boardView());
    let best: { cursor: Cursor; pixelId: string; time: number; progress: number } | null = null;

    for (const c of cursors) {
      if (c.phase === 'finished' || c.remaining <= 0) continue;
      const fromProgress = Math.max(c.progress, simTime - c.launch.insertionTime);
      if (fromProgress >= 1) {
        // The charge has flown a full lap. Targets exposed behind it now wait for
        // a manual relaunch — the M1 rule.
        c.phase = 'finished';
        c.progress = 1;
        c.finishTime = c.launch.insertionTime + 1;
        continue;
      }
      // No reachable target ahead *right now* is not the end of the lap — another
      // charge's clear may expose one before this charge comes around. Keep flying.
      const hit = pickEncounter(size, reachable, c.launch.color, fromProgress, c.hitPixelIds);
      if (!hit) continue;
      const time = c.launch.insertionTime + hit.progress;
      const better = best === null
        || time < best.time - ENCOUNTER_EPSILON
        || (Math.abs(time - best.time) <= ENCOUNTER_EPSILON && (
          c.launch.launchSequence < best.cursor.launch.launchSequence
          || (c.launch.launchSequence === best.cursor.launch.launchSequence && hit.pixelId < best.pixelId)
        ));
      if (better) best = { cursor: c, pixelId: hit.pixelId, time, progress: hit.progress };
    }

    if (!best) {
      // Nothing more can be resolved: every still-orbiting charge coasts to the
      // end of its lap with capacity to spare.
      for (const c of cursors) {
        if (c.phase === 'finished') continue;
        c.phase = 'finished';
        c.progress = 1;
        c.finishTime = c.launch.insertionTime + 1;
      }
      break;
    }

    simTime = Math.max(simTime, best.time);
    const resolved = resolveBoardHit(pixels, best.pixelId);
    pixels = resolved.pixels;
    const c = best.cursor;
    c.remaining -= 1;
    c.cursorTime = best.time;
    c.progress = best.progress;
    c.hitPixelIds.add(best.pixelId);
    c.encounters.push({ pixelId: best.pixelId, time: best.time, progress: best.progress, remaining: c.remaining,
      ...(resolved.frozenBreak ? { frozenBreak: true } : {}),
      ...(resolved.shieldBreak ? { shieldBreak: true } : {}),
      ...(resolved.linkedPrime ? { linkedPrime: true } : {}),
      ...(resolved.linkedGroupClear ? { linkedGroupClear: true } : {}),
      ...(resolved.linkedGroupId ? { linkedGroupId: resolved.linkedGroupId } : {}),
      ...(resolved.linkedGroupClear ? { linkedClearedPixelIds: resolved.clearedPixelIds } : {}) });
    if (c.remaining === 0) {
      c.phase = 'finished';
      c.finishTime = best.time;
    }
  }

  const charges: ActiveCharge[] = cursors.map((c) => ({
    id: c.launch.chargeId,
    source: c.launch.source,
    originId: c.launch.originId,
    color: c.launch.color,
    capacity: c.launch.capacity,
    remainingCapacity: c.remaining,
    insertionTime: c.launch.insertionTime,
    launchSequence: c.launch.launchSequence,
    passCount: c.encounters.length > 0 || c.progress >= 1 ? 1 : 0,
    phase: 'finished',
    encounters: c.encounters,
    finishTime: c.finishTime,
    landed: c.remaining > 0 ? 'holding' : 'consumed',
  }));

  return { pixels, charges };
}

/** The committed truth an epoch builds on: strip the epoch view off a state. */
export function committedBaseline(state: GameState): GameState {
  return { ...state, epoch: null, activeCharges: [] };
}

/**
 * Would a launch accepted right now **join** the open epoch (rather than start a
 * fresh one)? True only while a distinct earlier charge is still mid-lap at the
 * insertion point the new launch would use. A pause long enough for every charge
 * to finish its lap closes the epoch, so unhurried play resolves exactly like M1.
 */
/**
 * Whether a launch of `chargeId` is even *able* to join the open epoch. Whether
 * it actually does is the player's coarse timing choice, carried on the action
 * as `join: true` (the session sets it while flights are still on the rail).
 * The epoch holds at most {@link MAX_ACTIVE_CHARGES} launches, and the same
 * charge never appears twice in one epoch.
 */
export function canJoinEpoch(state: GameState, chargeId: string): boolean {
  const epoch = state.epoch;
  if (!epoch) return false;
  if (epoch.launches.length >= MAX_ACTIVE_CHARGES) return false;
  return !epoch.launches.some((l) => l.chargeId === chargeId);
}

/** Active-slot occupancy the next launch would see (0 when the epoch is idle). */
export function activeSlotCount(state: GameState): number {
  return state.epoch?.launches.length ?? 0;
}

export interface EpochPlan {
  baseline: GameState;
  launches: EpochLaunch[];
  /** Insertion time assigned to the new launch. */
  insertionTime: number;
  /** Epoch clock after the new launch. */
  clock: number;
  joined: boolean;
}

/**
 * Produce the launch list to simulate. `wantsJoin` is the player's coarse timing
 * choice (from the action's `join` flag); the launch actually joins only if the
 * open epoch can still take it.
 */
export function planLaunch(
  state: GameState,
  launch: Omit<EpochLaunch, 'insertionTime'>,
  wantsJoin = false,
): EpochPlan {
  const join = wantsJoin && canJoinEpoch(state, launch.chargeId);
  const baseline = join ? state.epoch!.baseline : committedBaseline(state);
  const prior = join ? state.epoch!.launches : [];
  const insertionTime = join ? state.epoch!.clock : 0;
  const full: EpochLaunch = { ...launch, insertionTime };
  return {
    baseline,
    launches: [...prior, full],
    insertionTime,
    clock: insertionTime + LAUNCH_SPACING,
    joined: join,
  };
}

/**
 * Fold a resolved epoch back into a committed {@link GameState}: apply the board,
 * consume the launched tunnel fronts / held charges, park leftovers in Holding,
 * and keep the epoch attached so the next launch can join it.
 */
export function flushEpoch(plan: EpochPlan, resolution: EpochResolution): GameState {
  const { baseline, launches } = plan;

  // Rebuild only the tunnels a launch was taken from; untouched tunnels keep
  // their identity (structural sharing the M1 tests rely on).
  const tunnelLaunchCount = new Map<string, number>();
  const launchedHoldingIds = new Set<string>();
  for (const launch of launches) {
    if (launch.source === 'tunnel') {
      tunnelLaunchCount.set(launch.originId, (tunnelLaunchCount.get(launch.originId) ?? 0) + 1);
    } else {
      launchedHoldingIds.add(launch.originId);
    }
  }

  const tunnels = tunnelLaunchCount.size === 0
    ? baseline.tunnels
    : baseline.tunnels.map((t) => {
      const taken = tunnelLaunchCount.get(t.id);
      return taken ? { ...t, queue: t.queue.slice(taken) } : t;
    });

  const parked: Charge[] = resolution.charges
    .filter((c) => c.landed === 'holding')
    .map((c) => ({ id: c.id, color: c.color, capacity: c.remainingCapacity }));

  const holding: Charge[] = launchedHoldingIds.size === 0 && parked.length === 0
    ? baseline.holding
    : [...baseline.holding.filter((c) => !launchedHoldingIds.has(c.id)), ...parked];

  const epoch: EpochState = { baseline, launches, clock: plan.clock };

  return {
    ...baseline,
    pixels: resolution.pixels,
    tunnels,
    holding,
    movesApplied: baseline.movesApplied + launches.length,
    activeCharges: resolution.charges,
    epoch,
    status: baseline.status,
  };
}

/**
 * A canonical fingerprint of an open epoch, for solver memoization and the dev
 * overlay. Insertion times and the clock are a fixed function of the launch
 * count (`i * LAUNCH_SPACING`), so only the ordered launch list and the baseline
 * board need to appear; equivalent situations produce an identical string.
 */
export function epochResidueKey(epoch: EpochState): string {
  const cleared = boardFingerprint(epoch.baseline.pixels);
  const tunnels = epoch.baseline.tunnels
    .map((t) => t.queue.map((c) => `${c.color}${c.capacity}`).join('.')).join('|');
  const holding = epoch.baseline.holding.map((c) => `${c.color}${c.capacity}`).join('.');
  const launches = epoch.launches
    .map((l) => `${l.source[0]}${l.originId}:${l.color}:${l.capacity}`).join(',');
  return `${cleared}/${tunnels}/${holding}//${launches}`;
}

/** The launched charge's own resolution within an epoch resolution. */
export function launchedResolution(resolution: EpochResolution, chargeId: string): ActiveCharge {
  const found = [...resolution.charges].reverse().find((c) => c.id === chargeId);
  if (!found) throw new Error(`Epoch resolution missing charge ${chargeId} — have [${resolution.charges.map((c) => c.id).join(', ')}]`);
  return found;
}
