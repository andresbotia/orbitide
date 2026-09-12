import type { LevelDefinition, OrbColor } from '../engine/types';
import { COMPILED_LEVELS } from './compiledLevels';
import { LEVEL_DEFINITIONS as LEGACY_LEVEL_DEFINITIONS } from './levelDefinitions';

/**
 * Combines legacy handcrafted levels with compiled authored levels.
 * Detects duplicate level IDs and fails clearly to prevent silent overrides.
 */
export function combineLevelDefinitions(
  legacy: LevelDefinition[],
  compiled: LevelDefinition[],
): LevelDefinition[] {
  const seen = new Set<number>();
  const collisions: number[] = [];

  for (const lvl of legacy) {
    seen.add(lvl.id);
  }

  for (const lvl of compiled) {
    if (seen.has(lvl.id)) {
      collisions.push(lvl.id);
    }
  }

  if (collisions.length > 0) {
    throw new Error(
      `Level ID collision detected between legacy levelDefinitions.ts and compiledLevels.ts for ID(s): ${collisions.join(', ')}. Each level ID must be unique across legacy and authored levels.`,
    );
  }

  return [...legacy, ...compiled].sort((a, b) => a.id - b.id);
}

export const LEVEL_DEFINITIONS: LevelDefinition[] = combineLevelDefinitions(
  LEGACY_LEVEL_DEFINITIONS,
  COMPILED_LEVELS,
);

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

/** Every color used by any pixel in any campaign level, in first-seen order. */
export const CAMPAIGN_COLORS: OrbColor[] = (() => {
  const seen = new Set<OrbColor>();
  for (const level of LEVEL_DEFINITIONS) {
    for (const tunnel of level.tunnels) {
      for (const spec of tunnel) seen.add(spec.color);
    }
  }
  return [...seen];
})();
