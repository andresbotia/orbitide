import { isLinkedPrimed, resolveBoardHit } from './linked';
import { orbitFraction } from './orbit';
import { clearOrder, reachablePixels } from './pixels';
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
 * Immediate target acquisition: a charge with legal matching targets fires
 * immediately from its current actual orbit position `fromProgress` without
 * waiting or travelling around the ring to reach the target's side. When multiple
 * targets exist, deterministic selection sorts clockwise from the charge's
 * current orbital angle using {@link clearOrder}.
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
  const candidates = reachable
    .filter((p) => p.color === color && !isLinkedPrimed(p) && !(exclude?.has(p.id)));
  if (candidates.length === 0) return null;

  const currentAngle = orbitFraction(fromProgress);
  candidates.sort(clearOrder(size, currentAngle));
  const target = candidates[0]!;
  return { pixelId: target.id, progress: fromProgress };
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
