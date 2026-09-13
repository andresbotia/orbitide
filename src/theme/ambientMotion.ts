import type { AmbientTreatmentId } from './worldSkins';

/**
 * PIXEL ARCADIA AMBIENT MOTION REGISTRY (UI-R7).
 *
 * The world-personality motion pass. Deliberately a SMALL, declarative,
 * reusable vocabulary — four motion kinds and two shapes — rather than ten
 * bespoke per-world particle systems. `AmbientLayer` (component) is the only
 * thing that reads this; no screen ever branches on `themeId`/`ambientId`
 * itself, it just asks `ambientMotion(id)` for a spec.
 */

/** How a particle moves. Four kinds cover every world's brief. */
export type MotionKind =
  | 'driftUp' // rises slowly, fades near the top — light, ash, dust
  | 'driftSide' // gentle horizontal wobble — currents, distant skyline
  | 'twinkle' // opacity pulse in place, no travel — stars, signage flicker
  | 'sway'; // small rotation/position wobble — foliage, machinery pulse

export type ParticleShape = 'dot' | 'square' | 'line';

export interface AmbientMotionSpec {
  kind: MotionKind;
  shape: ParticleShape;
  /** Relative density multiplier (0..~1.3) applied on top of the intensity tier's base count. */
  density: number;
  /** Base period for one full loop, ms — jittered per-particle so the set never reads as synced. */
  periodMs: number;
}

const REGISTRY: Record<AmbientTreatmentId, AmbientMotionSpec> = {
  warmDawn: { kind: 'driftUp', shape: 'dot', density: 0.8, periodMs: 7000 },
  foliage: { kind: 'sway', shape: 'dot', density: 1, periodMs: 5200 },
  neonSignage: { kind: 'twinkle', shape: 'line', density: 0.9, periodMs: 2200 },
  gearsSteam: { kind: 'sway', shape: 'dot', density: 0.7, periodMs: 6000 },
  starfield: { kind: 'twinkle', shape: 'dot', density: 1.2, periodMs: 3400 },
  skylineDrift: { kind: 'driftSide', shape: 'square', density: 0.6, periodMs: 9000 },
  currents: { kind: 'driftSide', shape: 'dot', density: 1, periodMs: 6400 },
  arcaneParticles: { kind: 'driftUp', shape: 'dot', density: 1, periodMs: 5600 },
  duskAsh: { kind: 'driftUp', shape: 'dot', density: 0.9, periodMs: 8200 },
  galleryDust: { kind: 'twinkle', shape: 'dot', density: 0.7, periodMs: 4800 },
};

export function ambientMotion(id: AmbientTreatmentId): AmbientMotionSpec {
  return REGISTRY[id];
}

/** Ambient screen tiers (UI-R7). HIGH is still restrained — this is mobile UI ambience. */
export type AmbientIntensity = 'low' | 'medium' | 'high';

const BASE_COUNT: Record<AmbientIntensity, number> = { low: 3, medium: 5, high: 8 };

/** Final bounded particle count for a given tier + world density multiplier. */
export function ambientParticleCount(intensity: AmbientIntensity, id: AmbientTreatmentId): number {
  return Math.max(2, Math.round(BASE_COUNT[intensity] * ambientMotion(id).density));
}
