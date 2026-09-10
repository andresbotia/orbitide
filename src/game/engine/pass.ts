import { isLinkedPrimed, resolveBoardHit } from './linked';
import { ORBIT_ENTRY_FRACTION, clockwiseGap } from './orbit';
import { pictureCenter, pixelEncounterFraction, reachablePixels } from './pixels';
import type { Charge, GameState, OrbColor, Pixel } from './types';

export interface Encounter {
  pixelId: string;
  /** Distance travelled from insertion, in turns; never exceeds one lap. */
  progress: number;
  remaining: number;
  /** `true` when this encounter cracked a Frozen ice layer instead of clearing. */
  frozenBreak?: boolean;
  shieldBreak?: boolean;
  linkedPrime?: boolean;
  linkedGroupClear?: boolean;
  linkedGroupId?: string;
  linkedClearedPixelIds?: string[];
}
/** Independently representable per-charge state. No clock or renderer dependencies. */
export interface ChargePass {
  charge: Charge;
  state: GameState;
  progress: number;
  phase: 'encounter' | 'finished';
  encounters: Encounter[];
}
export function startPass(state: GameState, charge: Charge): ChargePass {
  return { state, charge: { ...charge }, progress: 0, phase: 'encounter', encounters: [] };
}
/**
 * The pure "which pixel does this charge reach next" selection, over an
 * already-computed list of currently-reachable pixels. Nearest ahead of
 * `fromProgress`, then outer radius, then pixel id — identical ordering to the
 * M1 deterministic clear order. Shared by the M1 one-pass resolver and the M2B
 * concurrent {@link simulateEpoch} so both agree exactly.
 */
export function pickEncounter(
  size: Pick<GameState, 'width' | 'height'>,
  reachable: Pixel[],
  color: OrbColor,
  fromProgress: number,
  /** Pixel ids this charge has already met on this lap (a cracked-but-uncleared
   * Frozen pixel stays reachable, so it must not be re-hit at the same point). */
  exclude?: ReadonlySet<string>,
): { pixelId: string; progress: number } | null {
  const { cx, cy } = pictureCenter(size);
  const candidates = reachable
    .filter((p) => p.color === color && !isLinkedPrimed(p) && !(exclude?.has(p.id)))
    .map((p) => ({
      pixel: p,
      // The centre is equally near everywhere: encounter it at the current position.
      progress: p.x === cx && p.y === cy ? fromProgress : clockwiseGap(
        ORBIT_ENTRY_FRACTION, pixelEncounterFraction(size, p, ORBIT_ENTRY_FRACTION)),
      radius: (p.x - cx) ** 2 + (p.y - cy) ** 2,
    }))
    .filter((p) => p.progress + 1e-9 >= fromProgress)
    .sort((a, b) => Math.abs(a.progress - b.progress) > 1e-9
      ? a.progress - b.progress
      : b.radius - a.radius || (a.pixel.id < b.pixel.id ? -1 : a.pixel.id > b.pixel.id ? 1 : 0));
  const target = candidates[0];
  if (!target) return null;
  return { pixelId: target.pixel.id, progress: Math.max(fromProgress, target.progress) };
}
/**
 * The next reachable matching pixel a charge reaches, reading fresh exposure
 * from `state`. A caller that mutates the board between calls automatically sees
 * newly exposed targets.
 */
export function nextEncounter(
  state: GameState,
  color: OrbColor,
  fromProgress: number,
  exclude?: ReadonlySet<string>,
): { pixelId: string; progress: number } | null {
  return pickEncounter(state, reachablePixels(state), color, fromProgress, exclude);
}
/** Travel to the next contact, resolve one shot, then query fresh exposure next step. */
export function advancePass(pass: ChargePass): ChargePass {
  if (pass.phase === 'finished') return pass;
  if (pass.charge.capacity <= 0) return { ...pass, phase: 'finished' };
  const met = new Set(pass.encounters.map((e) => e.pixelId));
  const hit = nextEncounter(pass.state, pass.charge.color, pass.progress, met);
  if (!hit) return { ...pass, progress: 1, phase: 'finished' };
  const progress = hit.progress;
  const remaining = pass.charge.capacity - 1;
  const resolved = resolveBoardHit(pass.state.pixels, hit.pixelId);
  return {
    ...pass, progress, charge: { ...pass.charge, capacity: remaining },
    phase: remaining === 0 ? 'finished' : 'encounter',
    state: { ...pass.state, pixels: resolved.pixels },
    encounters: [...pass.encounters, { pixelId: hit.pixelId, progress, remaining,
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
