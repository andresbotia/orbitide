import { attachModifiers, DEFAULT_ART_LEGEND, parsePixelArt } from './art';
import { DEFAULT_ACTIVE_CAPACITY } from './concurrency';
import {
  defaultHoldingCapacity,
  expectedTunnelCount,
  LEGACY_TUNNEL_COUNT,
  resolveRuleset,
} from './ruleset';
import type { Charge, GameState, LevelDefinition, TunnelState } from './types';

/** Legacy V1 tunnel count. Prefer {@link expectedTunnelCount} for ruleset-aware code. */
export const TUNNEL_COUNT = LEGACY_TUNNEL_COUNT;

// Charge-id uniqueness is a hard invariant the presentation layer relies on to
// track a Pal from tunnel to Holding. The check is DEV-only so it never costs
// anything in a release build or in the solver's bulk `createGame` calls.
// No import: `typeof` keeps this safe in ts-jest's plain-Node environment,
// where the RN-injected `__DEV__` global doesn't exist.
const DEV = typeof __DEV__ !== 'undefined' && __DEV__;

/** Every charge id createGame just produced must be globally unique across all tunnels. */
function assertUniqueChargeIds(levelId: number, tunnels: TunnelState[]): void {
  if (!DEV) return;
  const seen = new Map<string, { tunnelIndex: number; chargeIndex: number; color: string; capacity: number }>();
  tunnels.forEach((tunnel, tunnelIndex) => {
    tunnel.queue.forEach((charge, chargeIndex) => {
      const prior = seen.get(charge.id);
      const here = { tunnelIndex, chargeIndex, color: charge.color, capacity: charge.capacity };
      if (prior) {
        console.error('[DUPLICATE_CHARGE_ID]', `level ${levelId}`, charge.id, { first: prior, duplicate: here });
      }
      seen.set(charge.id, here);
    });
  });
}

/**
 * Build a fresh {@link GameState} from a {@link LevelDefinition}.
 *
 * Deterministic: the same level definition always produces an identical state
 * (same pixel ids, same charge ids, same ordering). That is what makes "restart"
 * a plain call to this function and what the restart test relies on.
 */
export function createGame(level: LevelDefinition): GameState {
  const legend = { ...DEFAULT_ART_LEGEND, ...(level.legend ?? {}) };
  const parsed = parsePixelArt(level.id, level.pixelArt, legend);
  const { width, height } = parsed;
  // Additive: attach authored presentation modifiers by cell. Render-state only —
  // no gameplay rule reads `pixel.modifier`.
  const pixels = attachModifiers(parsed.pixels, level.modifiers);

  const tunnelCount = expectedTunnelCount(level.ruleset);
  if (level.tunnels.length !== tunnelCount) {
    throw new Error(
      `Level ${level.id}: expected exactly ${tunnelCount} tunnels, got ${level.tunnels.length}`,
    );
  }

  const tunnels: TunnelState[] = level.tunnels.map((specs, tunnelIndex) => {
    const queue: Charge[] = specs.map((spec, chargeIndex) => ({
      id: `L${level.id}-t${tunnelIndex}-c${chargeIndex}`,
      color: spec.color,
      capacity: spec.capacity,
    }));
    return { id: `tunnel-${tunnelIndex}`, queue };
  });
  assertUniqueChargeIds(level.id, tunnels);

  return {
    levelId: level.id,
    holdingCapacity: resolveHoldingCapacity(level),
    width,
    height,
    pixels,
    tunnels,
    holding: [],
    status: 'playing',
    movesApplied: 0,
    activeCharges: [],
    epoch: null,
    ruleset: resolveRuleset(level.ruleset),
    activeCapacity: resolveActiveCapacity(level.activeCapacity),
  };
}

function resolveHoldingCapacity(level: LevelDefinition): number {
  return typeof level.holdingCapacity === 'number' && level.holdingCapacity > 0
    ? level.holdingCapacity
    : defaultHoldingCapacity(level.ruleset);
}

function resolveActiveCapacity(value: number | undefined): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  return DEFAULT_ACTIVE_CAPACITY;
}

/**
 * Restart a level. Alias of {@link createGame} kept as a named export so call
 * sites read clearly and so a future implementation can diverge if needed.
 */
export function restartGame(level: LevelDefinition): GameState {
  return createGame(level);
}
