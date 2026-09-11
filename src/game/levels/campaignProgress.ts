import type { CampaignManifest, CampaignWorld } from '@/game/studio/campaign/types';
import { isLevelUnlocked, type Progress } from '@/storage/progress';

/**
 * Consumer-facing campaign progress (world/level-select, M4C.11.3). Pure,
 * derived entirely from {@link CampaignManifest} + {@link Progress} — no new
 * persisted state, no engine/solver involvement.
 */

export type LevelSlotState = 'locked' | 'current' | 'complete';

/** Per-level state for the level-select grid. */
export function levelSlotState(progress: Progress, levelId: number): LevelSlotState {
  if (levelId > progress.highestUnlockedLevel) return 'locked';
  if (levelId < progress.highestUnlockedLevel) return 'complete';
  return 'current';
}

export type WorldSlotState = 'locked' | 'active' | 'complete';

export interface WorldSummary {
  world: CampaignWorld;
  /** 1-based position for display ("WORLD 3"). */
  displayIndex: number;
  completedCount: number;
  totalCount: number;
  state: WorldSlotState;
}

/**
 * One summary per world, in campaign order. A world is `locked` until its
 * first level is unlocked, `complete` once every one of its levels has been
 * surpassed, otherwise `active`. (The final campaign level can never show as
 * `complete` this way — `highestUnlockedLevel` caps at `TOTAL_LEVELS` — the
 * same pre-existing limit Home's own "cleared" count already has.)
 */
export function summarizeWorlds(manifest: CampaignManifest, progress: Progress): WorldSummary[] {
  const worlds = [...manifest.worlds].sort((a, b) => a.order - b.order);
  return worlds.map((world, index) => {
    const completedCount = world.levelIds.filter((id) => id < progress.highestUnlockedLevel).length;
    const totalCount = world.levelIds.length;
    const firstLevel = world.levelIds[0];
    const firstUnlocked = firstLevel !== undefined && isLevelUnlocked(progress, firstLevel);
    const state: WorldSlotState = !firstUnlocked
      ? 'locked'
      : completedCount >= totalCount
        ? 'complete'
        : 'active';
    return { world, displayIndex: index + 1, completedCount, totalCount, state };
  });
}

/** The world containing the player's current (next-to-play) level, if any. */
export function currentWorldId(manifest: CampaignManifest, progress: Progress): string | undefined {
  return manifest.worlds.find((w) => w.levelIds.includes(progress.highestUnlockedLevel))?.id;
}
