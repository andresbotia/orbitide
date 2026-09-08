import type { LevelDefinition } from '../engine/types';
import { LEVEL_DEFINITIONS } from './levelDefinitions';

export { LEVEL_DEFINITIONS };

/** Total number of handcrafted levels available in Milestone 1. */
export const TOTAL_LEVELS = LEVEL_DEFINITIONS.length;

/** First level, always unlocked. */
export const FIRST_LEVEL = 1;

/** Look up a level definition by its 1-based number. */
export function getLevel(levelId: number): LevelDefinition | undefined {
  return LEVEL_DEFINITIONS.find((level) => level.id === levelId);
}

/** Like {@link getLevel} but throws if the level does not exist. */
export function requireLevel(levelId: number): LevelDefinition {
  const level = getLevel(levelId);
  if (!level) throw new Error(`Unknown level: ${levelId}`);
  return level;
}

/** Whether a level number exists in the M1 campaign. */
export function levelExists(levelId: number): boolean {
  return getLevel(levelId) !== undefined;
}

/**
 * The next level to play after `levelId`, or `undefined` when `levelId` is the
 * last handcrafted level (Milestone 1 complete).
 */
export function nextLevelId(levelId: number): number | undefined {
  return levelExists(levelId + 1) ? levelId + 1 : undefined;
}

/** Colors used anywhere in the M1 campaign, in first-appearance order. */
export const CAMPAIGN_COLORS = Array.from(
  new Set(
    LEVEL_DEFINITIONS.flatMap((level) =>
      level.coreTargets.map((target) => target.color),
    ),
  ),
);
