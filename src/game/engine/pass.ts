import { ORBIT_ENTRY_FRACTION, clockwiseGap } from './orbit';
import { pictureCenter, pixelEncounterFraction, reachablePixels } from './pixels';
import type { Charge, GameState } from './types';

export interface Encounter {
  pixelId: string;
  /** Distance travelled from insertion, in turns; never exceeds one lap. */
  progress: number;
  remaining: number;
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
/** Travel to the next contact, resolve one shot, then query fresh exposure next step. */
export function advancePass(pass: ChargePass): ChargePass {
  if (pass.phase === 'finished') return pass;
  if (pass.charge.capacity <= 0) return { ...pass, phase: 'finished' };
  const { cx, cy } = pictureCenter(pass.state);
  const candidates = reachablePixels(pass.state)
    .filter((p) => p.color === pass.charge.color)
    .map((p) => ({ pixel: p,
      // The centre is equally near everywhere: encounter it at the current position.
      progress: p.x === cx && p.y === cy ? pass.progress : clockwiseGap(
        ORBIT_ENTRY_FRACTION, pixelEncounterFraction(pass.state, p, ORBIT_ENTRY_FRACTION)),
      radius: (p.x - cx) ** 2 + (p.y - cy) ** 2,
    }))
    .filter((p) => p.progress + 1e-9 >= pass.progress)
    .sort((a, b) => Math.abs(a.progress - b.progress) > 1e-9
      ? a.progress - b.progress : b.radius - a.radius || (a.pixel.id < b.pixel.id ? -1 : a.pixel.id > b.pixel.id ? 1 : 0));
  const target = candidates[0];
  if (!target) return { ...pass, progress: 1, phase: 'finished' };
  const progress = Math.max(pass.progress, target.progress);
  const remaining = pass.charge.capacity - 1;
  return {
    ...pass, progress, charge: { ...pass.charge, capacity: remaining },
    phase: remaining === 0 ? 'finished' : 'encounter',
    state: { ...pass.state, pixels: pass.state.pixels.map((p) =>
      p.id === target.pixel.id ? { ...p, cleared: true } : p) },
    encounters: [...pass.encounters, { pixelId: target.pixel.id, progress, remaining }],
  };
}
/** M1 has one active pass: safely evaluate discrete steps ahead of presentation. */
export function resolvePass(state: GameState, charge: Charge): ChargePass {
  let pass = startPass(state, charge);
  while (pass.phase !== 'finished') pass = advancePass(pass);
  return pass;
}
