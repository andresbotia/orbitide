import type { GameState, LevelDefinition, Orb } from './types';

/**
 * Build a fresh {@link GameState} from a {@link LevelDefinition}.
 *
 * Deterministic: the same level definition always produces an identical state
 * (same orb ids, same ordering), which is what makes "restart" a simple call to
 * this function and what test #10 relies on.
 */
export function createGame(level: LevelDefinition): GameState {
  const lanes: Orb[][] = level.lanes.map((lane, laneIndex) =>
    lane.map((color, position) => ({
      id: `L${level.id}-lane${laneIndex}-pos${position}`,
      color,
    })),
  );

  return {
    levelId: level.id,
    holdingCapacity: level.holdingCapacity,
    lanes,
    holding: [],
    targets: level.coreTargets.map((target) => ({ ...target })),
    activeTargetIndex: 0,
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
