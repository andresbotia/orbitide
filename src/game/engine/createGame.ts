import { DEFAULT_ART_LEGEND, parsePixelArt } from './art';
import type { Charge, GameState, LevelDefinition, TunnelState } from './types';

export const TUNNEL_COUNT = 3;

/**
 * Build a fresh {@link GameState} from a {@link LevelDefinition}.
 *
 * Deterministic: the same level definition always produces an identical state
 * (same pixel ids, same charge ids, same ordering). That is what makes "restart"
 * a plain call to this function and what the restart test relies on.
 */
export function createGame(level: LevelDefinition): GameState {
  const legend = { ...DEFAULT_ART_LEGEND, ...(level.legend ?? {}) };
  const { width, height, pixels } = parsePixelArt(level.id, level.pixelArt, legend);

  if (level.tunnels.length !== TUNNEL_COUNT) {
    throw new Error(
      `Level ${level.id}: expected exactly ${TUNNEL_COUNT} tunnels, got ${level.tunnels.length}`,
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

  return {
    levelId: level.id,
    holdingCapacity: level.holdingCapacity,
    width,
    height,
    pixels,
    tunnels,
    holding: [],
    status: 'playing',
    movesApplied: 0,
  };
}

/**
 * Restart a level. Alias of {@link createGame} kept as a named export so call
 * sites read clearly and so a future implementation can diverge if needed.
 */
export function restartGame(level: LevelDefinition): GameState {
  return createGame(level);
}
