import { DEFAULT_ACTIVE_CAPACITY, LAUNCH_SPACING } from './concurrency';
import { boardFingerprint } from './frozen';
import { resolveBoardHit } from './linked';
import { pickEncounter } from './pass';
import type {
  ActiveCharge,
  Charge,
  EpochLaunch,
  EpochState,
  GameState,
  Pixel,
} from './types';

/**
 * FIRST LAUNCHED, FIRST SERVED launch resolution.
 *
 * Logical time is measured in **laps**. A charge inserted at `insertionTime`
 * reaches lap-progress `t - insertionTime` at logical time `t` and flies at most
 * one lap (leftover capacity parks in Holding; targets exposed behind it wait
 * for a manual relaunch — the M1 rule).
 *
 * Because {@link LAUNCH_SPACING} is one full lap, launch `i` owns logical time
 * `[i, i+1]` and is finished before launch `i+1` can act. So every launch is
 * resolved exactly once, the moment it launches, against the board the earlier
 * launches left — nothing is ever re-simulated, and a later Pal can never
 * rewrite an earlier Pal's history.
 *
 * An **epoch** is the run of launches currently sharing the rail. It is
 * bookkeeping, not physics: which launches occupy Active slots, the clock that
 * times the next insertion, and every charge's resolution for the presentation.
 * Whether a launch joins the epoch or starts a fresh one never changes its
 * logical outcome — only these bookkeeping fields.
 */

export interface EpochResolution {
  /** Final board after every charge in the epoch has resolved. */
  pixels: Pixel[];
  /** Per-launch resolution, in launch order. */
  charges: ActiveCharge[];
}

/** One launch resolved against a board. */
export interface LaunchResolution {
  /** The board after this launch. */
  pixels: Pixel[];
  charge: ActiveCharge;
}

/**
 * Memo of single-launch resolutions for ONE board at a time — the level being
 * played or solved. Resolving a launch on a different board (`boardIdentity`
 * changes: a level switch, another Studio draft) empties it, and it is an LRU
 * capped at {@link SIM_CACHE_LIMIT} entries, so it can never grow without bound.
 *
 * Measured: live play reuses ≤ 2% of entries (retries of the same level), while
 * a solve reuses 40–78% — and a 20k-entry LRU keeps nearly all of that. An entry
 * is ~2–4 KB on Core V2 boards and ~7–10 KB on the largest Legacy boards.
 */
const SIM_CACHE = new Map<string, LaunchResolution>();
export const SIM_CACHE_LIMIT = 20_000;
let simCacheBoard = '';

/** Entries currently memoized (for tests / diagnostics). */
export function simCacheSize(): number {
  return SIM_CACHE.size;
}

function simKey(board: GameState, launch: EpochLaunch): string {
  // Only what the physics reads. The board identity is implied — the cache only
  // ever holds one board — and `boardFingerprint` supplies per-cell progress
  // (cleared / iced / shielded / primed). The ruleset is not part of the
  // identity, so it is keyed here. A launch's source, origin, sequence and the
  // Active capacity never affect its own lap, so identical Pals share an entry.
  return `${board.ruleset}:${boardFingerprint(board.pixels)}//${launch.color}:${launch.capacity}@${launch.insertionTime}`;
}

/** Resolve one launch against `board` (its pixels are the board the launch meets). */
export function resolveEpochLaunch(board: GameState, launch: EpochLaunch): LaunchResolution {
  if (board.boardIdentity !== simCacheBoard) {
    SIM_CACHE.clear();
    simCacheBoard = board.boardIdentity;
  }
  const key = simKey(board, launch);
  let physics = SIM_CACHE.get(key);
  if (physics) {
    // Most recently used goes to the back of the Map's insertion order.
    SIM_CACHE.delete(key);
    SIM_CACHE.set(key, physics);
  } else {
    physics = resolveEpochLaunchUncached(board, launch);
    if (SIM_CACHE.size >= SIM_CACHE_LIMIT) SIM_CACHE.delete(SIM_CACHE.keys().next().value!);
    SIM_CACHE.set(key, physics);
  }
  // The key deliberately ignores charge identity (two charges of the same colour
  // and capacity resolve identically), so re-label the cached physics with this
  // call's actual launch identity before handing it back.
  return {
    pixels: physics.pixels,
    charge: {
      ...physics.charge,
      id: launch.chargeId,
      source: launch.source,
      originId: launch.originId,
      insertionTime: launch.insertionTime,
      launchSequence: launch.launchSequence,
    },
  };
}

/**
 * Resolve a list of launches in order, each against the board the previous ones
 * left. Launch windows must not overlap: every launch owns one full lap, which
 * is what makes this sequential fold the whole truth.
 */
export function simulateEpoch(baseline: GameState, launches: EpochLaunch[]): EpochResolution {
  let pixels = baseline.pixels;
  const charges: ActiveCharge[] = [];
  launches.forEach((launch, i) => {
    const previous = launches[i - 1];
    if (previous && launch.insertionTime < previous.insertionTime + LAUNCH_SPACING) {
      throw new Error(`Launch windows overlap: ${launch.chargeId} at ${launch.insertionTime} starts before `
        + `${previous.chargeId} at ${previous.insertionTime} has flown its lap (LAUNCH_SPACING ${LAUNCH_SPACING}).`);
    }
    const own = resolveEpochLaunch(pixels === baseline.pixels ? baseline : { ...baseline, pixels }, launch);
    charges.push(own.charge);
    pixels = own.pixels;
  });
  return { pixels, charges };
}

/**
 * One charge's lap. It advances along the rail from its insertion point; after
 * each resolved hit the board is mutated and exposure is re-queried, so a clear
 * can expose a target the charge reaches later in the same lap.
 */
function resolveEpochLaunchUncached(from: GameState, launch: EpochLaunch): LaunchResolution {
  // Structural sharing: only the pixels that change are replaced.
  let pixels = from.pixels;
  // One board view, re-pointed at the current pixels each step (targeting reads
  // only size, ruleset and pixels, and retains nothing).
  const board: GameState = { ...from };

  let remaining = launch.capacity;
  let progress = 0;
  let finished = false;
  let finishTime = launch.insertionTime + 1;
  // Logical time reached so far.
  let simTime = 0;
  const encounters: ActiveCharge['encounters'] = [];
  /** Pixel ids already met this lap (Frozen re-hit guard, legacy V1). */
  const hitPixelIds = new Set<string>();
  /** Core V2 attack-line bins already resolved this lap: one shot per line. */
  const consumedBins = new Set<string>();

  // Each step resolves exactly one hit or ends the lap. A hit clears a pixel,
  // cracks one ice / shield layer or primes a linked pixel, so the loop is
  // bounded well inside this.
  const modifierHits = pixels.reduce((n, p) => {
    if (p.cleared || (p.modifier?.kind !== 'frozen' && p.modifier?.kind !== 'shielded')) return n;
    return n + Math.max(0, Math.trunc(p.modifier.level ?? 1));
  }, 0);
  const maxSteps = pixels.length + modifierHits + 6;
  for (let step = 0; step < maxSteps; step += 1) {
    board.pixels = pixels;
    let hit: ReturnType<typeof pickEncounter> = null;
    if (!finished && remaining > 0) {
      const fromProgress = Math.max(progress, simTime - launch.insertionTime);
      if (fromProgress >= 1) {
        // A full lap flown. Targets exposed behind it now wait for a manual
        // relaunch — the M1 rule.
        finished = true;
        progress = 1;
        finishTime = launch.insertionTime + 1;
      } else {
        hit = pickEncounter(board, launch.color, fromProgress, hitPixelIds, consumedBins);
      }
    }
    if (!hit) {
      // Nothing more to meet: the charge coasts to the end of its lap.
      if (!finished) {
        finished = true;
        progress = 1;
        finishTime = launch.insertionTime + 1;
      }
      break;
    }

    const time = launch.insertionTime + hit.progress;
    simTime = Math.max(simTime, time);
    const resolved = resolveBoardHit(pixels, hit.pixelId);
    pixels = resolved.pixels;
    remaining -= 1;
    progress = hit.progress;
    hitPixelIds.add(hit.pixelId);
    if (hit.binId) consumedBins.add(hit.binId);
    const encounter: ActiveCharge['encounters'][number] = { pixelId: hit.pixelId, time, progress: hit.progress, remaining };
    if (resolved.frozenBreak) encounter.frozenBreak = true;
    if (resolved.shieldBreak) encounter.shieldBreak = true;
    if (resolved.linkedPrime) encounter.linkedPrime = true;
    if (resolved.linkedGroupClear) encounter.linkedGroupClear = true;
    if (resolved.linkedGroupId) encounter.linkedGroupId = resolved.linkedGroupId;
    if (resolved.linkedGroupClear) encounter.linkedClearedPixelIds = resolved.clearedPixelIds;
    encounters.push(encounter);
    if (remaining === 0) {
      finished = true;
      finishTime = time;
    }
  }

  return {
    pixels,
    charge: {
      id: launch.chargeId,
      source: launch.source,
      originId: launch.originId,
      color: launch.color,
      capacity: launch.capacity,
      remainingCapacity: remaining,
      insertionTime: launch.insertionTime,
      launchSequence: launch.launchSequence,
      passCount: encounters.length > 0 || progress >= 1 ? 1 : 0,
      phase: 'finished',
      encounters,
      finishTime,
      landed: remaining > 0 ? 'holding' : 'consumed',
    },
  };
}

/**
 * Whether a launch of `chargeId` is even *able* to join the open epoch. Whether
 * it actually does is the player's coarse timing choice, carried on the action
 * as `join: true` (the session sets it while flights are still on the rail).
 * The epoch holds at most `state.activeCapacity` launches, and the same
 * charge never appears twice in one epoch.
 */
export function canJoinEpoch(state: GameState, chargeId: string): boolean {
  const epoch = state.epoch;
  if (!epoch) return false;
  if (epoch.launches.length >= activeCapacityOf(state)) return false;
  return !epoch.launches.some((l) => l.chargeId === chargeId);
}

/** Active-slot occupancy the next launch would see (0 when the epoch is idle). */
export function activeSlotCount(state: GameState): number {
  return state.epoch?.launches.length ?? 0;
}

export function activeCapacityOf(state: Pick<GameState, 'activeCapacity'>): number {
  return state.activeCapacity > 0 ? state.activeCapacity : DEFAULT_ACTIVE_CAPACITY;
}

/** Whether another concurrent pass can still join the open epoch. */
export function epochHasCapacity(state: GameState): boolean {
  return activeSlotCount(state) < activeCapacityOf(state);
}

export interface EpochPlan {
  /** Every launch in the epoch after this one, in launch order. */
  launches: EpochLaunch[];
  /** Insertion time assigned to the new launch. */
  insertionTime: number;
  /** Epoch clock after the new launch. */
  clock: number;
  joined: boolean;
}

/**
 * Place a launch in the epoch. `wantsJoin` is the player's coarse timing choice
 * (from the action's `join` flag); the launch actually joins only if the open
 * epoch can still take it.
 */
export function planLaunch(
  state: GameState,
  launch: Omit<EpochLaunch, 'insertionTime'>,
  wantsJoin = false,
): EpochPlan {
  const join = wantsJoin && canJoinEpoch(state, launch.chargeId);
  const prior = join ? state.epoch!.launches : [];
  const insertionTime = join ? state.epoch!.clock : 0;
  const full: EpochLaunch = { ...launch, insertionTime };
  return {
    launches: [...prior, full],
    insertionTime,
    clock: insertionTime + LAUNCH_SPACING,
    joined: join,
  };
}

/**
 * Commit the plan's newest launch to `state`: apply its board, consume its
 * tunnel front / held charge, park its leftover capacity in Holding (when there
 * is room), and record it in the epoch so the next launch can join.
 * `resolution.charges` is every charge on the rail, the new one last.
 */
export function commitLaunch(state: GameState, plan: EpochPlan, resolution: EpochResolution): GameState {
  const launch = plan.launches[plan.launches.length - 1]!;
  const charge = resolution.charges[resolution.charges.length - 1]!;

  // Rebuild only the tunnel the launch was taken from; untouched tunnels keep
  // their identity (structural sharing the M1 tests rely on).
  const tunnels = launch.source === 'tunnel'
    ? state.tunnels.map((t) => (t.id === launch.originId ? { ...t, queue: t.queue.slice(1) } : t))
    : state.tunnels;

  const fromHolding = launch.source === 'holding';
  const parked: Charge[] = charge.landed === 'holding'
    ? [{ id: charge.id, color: charge.color, capacity: charge.remainingCapacity }]
    : [];
  const keep = fromHolding ? state.holding.filter((c) => c.id !== launch.originId) : state.holding;
  const room = Math.max(0, state.holdingCapacity - keep.length);
  const holding: Charge[] = !fromHolding && parked.length === 0
    ? state.holding
    : [...keep, ...parked.slice(0, room)];

  const epoch: EpochState = { launches: plan.launches, clock: plan.clock };

  return {
    ...state,
    pixels: resolution.pixels,
    tunnels,
    holding,
    movesApplied: state.movesApplied + 1,
    activeCharges: resolution.charges,
    epoch,
    status: state.status,
  };
}

/** The launched charge's own resolution within an epoch resolution. */
export function launchedResolution(resolution: EpochResolution, chargeId: string): ActiveCharge {
  const found = [...resolution.charges].reverse().find((c) => c.id === chargeId);
  if (!found) throw new Error(`Epoch resolution missing charge ${chargeId} — have [${resolution.charges.map((c) => c.id).join(', ')}]`);
  return found;
}
