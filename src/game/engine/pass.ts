import { pickDirectionalEncounter } from './directionalTargeting';
import { isLinkedPrimed, resolveBoardHit } from './linked';
import { orbitFraction } from './orbit';
import { firstInClearOrder, reachablePixels } from './pixels';
import { isCoreV2 } from './ruleset';
import type { Charge, GameState, OrbColor, Pixel } from './types';

export interface Encounter {
  pixelId: string;
  /** Distance travelled from insertion, in turns; never exceeds one lap. */
  progress: number;
  remaining: number;
  /** Attack-line bin id when the Core V2 directional ruleset produced this hit. */
  binId?: string;
  /** `true` when this encounter cracked a Frozen ice layer instead of clearing. */
  frozenBreak?: boolean;
  shieldBreak?: boolean;
  linkedPrime?: boolean;
  linkedGroupClear?: boolean;
  linkedGroupId?: string;
  linkedClearedPixelIds?: string[];
}

export interface EncounterPick {
  pixelId: string;
  progress: number;
  binId?: string;
}

/** Independently representable per-charge state. No clock or renderer dependencies. */
export interface ChargePass {
  charge: Charge;
  state: GameState;
  progress: number;
  phase: 'encounter' | 'finished';
  encounters: Encounter[];
  /** Core V2: attack-line bins already resolved on this pass. Empty under legacyV1. */
  consumedBins: Set<string>;
}

export function startPass(state: GameState, charge: Charge): ChargePass {
  return {
    state,
    charge: { ...charge },
    progress: 0,
    phase: 'encounter',
    encounters: [],
    consumedBins: new Set(),
  };
}

/**
 * Legacy V1: immediate target acquisition from global exterior flood-fill.
 * A charge with legal matching targets fires immediately from `fromProgress`
 * without travelling. Multiple newly-exposed pixels can chain in one pass.
 */
export function pickLegacyEncounter(
  size: Pick<GameState, 'width' | 'height'>,
  reachable: Pixel[],
  color: OrbColor,
  fromProgress: number,
  exclude?: ReadonlySet<string>,
): EncounterPick | null {
  const candidates = reachable
    .filter((p) => p.color === color && !isLinkedPrimed(p) && !(exclude?.has(p.id)));
  const target = firstInClearOrder(size, candidates, orbitFraction(fromProgress));
  return target ? { pixelId: target.id, progress: fromProgress } : null;
}

/**
 * Single targeting dispatch. Legacy V1 keeps flood-fill + immediate fire.
 * Core V2 uses rounded-perimeter directional rays and one shot per attack-line
 * bin. Callers should not branch on the ruleset themselves.
 */
export function pickEncounter(
  state: GameState,
  color: OrbColor,
  fromProgress: number,
  exclude?: ReadonlySet<string>,
  consumedBins?: ReadonlySet<string>,
): EncounterPick | null {
  if (isCoreV2(state.ruleset)) {
    return pickDirectionalEncounter(state, color, fromProgress, consumedBins ?? EMPTY_BINS);
  }
  return pickLegacyEncounter(state, reachablePixels(state), color, fromProgress, exclude);
}

const EMPTY_BINS: ReadonlySet<string> = new Set();

/**
 * The next matching encounter a charge reaches, reading fresh board state.
 */
export function nextEncounter(
  state: GameState,
  color: OrbColor,
  fromProgress: number,
  exclude?: ReadonlySet<string>,
  consumedBins?: ReadonlySet<string>,
): EncounterPick | null {
  return pickEncounter(state, color, fromProgress, exclude, consumedBins);
}

/** Travel to the next contact, resolve one shot, then query fresh exposure next step. */
export function advancePass(pass: ChargePass): ChargePass {
  if (pass.phase === 'finished') return pass;
  if (pass.charge.capacity <= 0) return { ...pass, phase: 'finished' };
  const met = new Set(pass.encounters.map((e) => e.pixelId));
  const consumed = pass.consumedBins;
  const hit = nextEncounter(pass.state, pass.charge.color, pass.progress, met, consumed);
  if (!hit) return { ...pass, progress: 1, phase: 'finished' };
  const progress = hit.progress;
  const remaining = pass.charge.capacity - 1;
  const resolved = resolveBoardHit(pass.state.pixels, hit.pixelId);
  const consumedBins = hit.binId ? new Set(consumed).add(hit.binId) : consumed;
  return {
    ...pass, progress, charge: { ...pass.charge, capacity: remaining },
    phase: remaining === 0 ? 'finished' : 'encounter',
    state: { ...pass.state, pixels: resolved.pixels },
    consumedBins,
    encounters: [...pass.encounters, { pixelId: hit.pixelId, progress, remaining,
      ...(hit.binId ? { binId: hit.binId } : {}),
      ...(resolved.frozenBreak ? { frozenBreak: true } : {}),
      ...(resolved.shieldBreak ? { shieldBreak: true } : {}),
      ...(resolved.linkedPrime ? { linkedPrime: true } : {}),
      ...(resolved.linkedGroupClear ? { linkedGroupClear: true } : {}),
      ...(resolved.linkedGroupId ? { linkedGroupId: resolved.linkedGroupId } : {}),
      ...(resolved.linkedGroupClear ? { linkedClearedPixelIds: resolved.clearedPixelIds } : {}) }],
  };
}

/** M1 has one active pass: safely evaluate discrete steps ahead of presentation. */
export function resolvePass(state: GameState, charge: Charge): ChargePass {
  let pass = startPass(state, charge);
  while (pass.phase !== 'finished') pass = advancePass(pass);
  return pass;
}
