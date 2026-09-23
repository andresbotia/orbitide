import type { LevelDefinition, OrbColor } from '../engine/types';
import { COMPILED_LEVELS } from './compiledLevels';
import { COMPILED_LEVELS as CORE_V2_WORLD_1 } from './compiledWorld1';
import { COMPILED_LEVELS as CORE_V2_WORLD_2 } from './compiledWorld2';
import { COMPILED_LEVELS as CORE_V2_WORLD_3 } from './compiledWorld3';
import { COMPILED_LEVELS as CORE_V2_WORLD_4 } from './compiledWorld4';
import { LEVEL_DEFINITIONS as LEGACY_LEVEL_DEFINITIONS } from './levelDefinitions';

/**
 * Combines legacy handcrafted levels with compiled authored levels.
 *
 * Safety requirements:
 * - Accidental collisions without 'replacesLegacy: true' fail with an error.
 * - Explicit replacements ('replacesLegacy: true') must exist in legacy definitions.
 * - Duplicate authored IDs fail.
 * - Replaced legacy levels are completely excluded so each ID has exactly one definition.
 * - Neighboring legacy levels remain untouched.
 * - Unified list is strictly unique and sorted by ID.
 */
export function combineLevelDefinitions(
  legacy: LevelDefinition[],
  compiled: LevelDefinition[],
): LevelDefinition[] {
  // 1. Ensure compiled levels have unique IDs within themselves
  const seenCompiled = new Set<number>();
  for (const lvl of compiled) {
    if (seenCompiled.has(lvl.id)) {
      throw new Error(`Duplicate level ID ${lvl.id} found in compiled levels.`);
    }
    seenCompiled.add(lvl.id);
  }

  // 2. Index legacy levels and check collision / replacement validity
  const legacyMap = new Map<number, LevelDefinition>();
  for (const lvl of legacy) {
    legacyMap.set(lvl.id, lvl);
  }

  const replacementIds = new Set<number>();
  const accidentalCollisions: number[] = [];
  const invalidReplacements: number[] = [];

  for (const lvl of compiled) {
    if (lvl.replacesLegacy === true) {
      if (!legacyMap.has(lvl.id)) {
        invalidReplacements.push(lvl.id);
      } else {
        replacementIds.add(lvl.id);
      }
    } else if (legacyMap.has(lvl.id)) {
      accidentalCollisions.push(lvl.id);
    }
  }

  if (accidentalCollisions.length > 0) {
    throw new Error(
      `Level ID collision detected: Authored level ID(s) [${accidentalCollisions.join(', ')}] collide with legacy levelDefinitions.ts. Set 'replacesLegacy: true' if this is an intentional replacement.`,
    );
  }

  if (invalidReplacements.length > 0) {
    throw new Error(
      `Invalid replacement: Authored level ID(s) [${invalidReplacements.join(', ')}] declared 'replacesLegacy: true', but do not exist in legacy levelDefinitions.ts.`,
    );
  }

  // 3. Exclude replaced legacy levels and combine with compiled
  const retainedLegacy = legacy.filter((lvl) => !replacementIds.has(lvl.id));
  const unified = [...retainedLegacy, ...compiled].sort((a, b) => a.id - b.id);

  // 4. Verify invariant: strictly unique IDs in unified definitions
  const unifiedSeen = new Set<number>();
  for (const lvl of unified) {
    if (unifiedSeen.has(lvl.id)) {
      throw new Error(`Critical invariant failure: duplicate level ID ${lvl.id} in unified definitions.`);
    }
    unifiedSeen.add(lvl.id);
  }

  return unified;
}

export const LEVEL_DEFINITIONS: LevelDefinition[] = combineLevelDefinitions(
  LEGACY_LEVEL_DEFINITIONS,
  [
    ...CORE_V2_WORLD_1,
    ...CORE_V2_WORLD_2,
    ...CORE_V2_WORLD_3,
    ...CORE_V2_WORLD_4,
    ...COMPILED_LEVELS.filter((l) => l.id > 40),
  ],
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
