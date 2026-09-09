import type { LevelDifficulty } from '@/game/engine/types';

/** The five authored difficulty tiers, in ascending order. */
export const LEVEL_DIFFICULTIES: LevelDifficulty[] = [
  'easy', 'medium', 'hard', 'super-hard', 'extreme',
];

/** Default holding-tray size for a new level. Not edited in M3A. */
export const DEFAULT_HOLDING_CAPACITY = 3;

/** Grid size a brand-new blank level starts at. */
export const DEFAULT_GRID_SIZE = 9;

/** Next unused level id, given the ids already in the campaign. */
export function nextFreeLevelId(existingIds: number[]): number {
  const max = existingIds.reduce((m, id) => Math.max(m, id), 0);
  return max + 1;
}
