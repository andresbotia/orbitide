import AsyncStorage from '@react-native-async-storage/async-storage';

import { FIRST_LEVEL, TOTAL_LEVELS } from '@/game/levels/levels';

const STORAGE_KEY = 'orbitide/progress/v1';

export interface Progress {
  /**
   * Highest level the player has unlocked. Level 1 is always unlocked; beating
   * level N unlocks N + 1 (capped at TOTAL_LEVELS for M1).
   */
  highestUnlockedLevel: number;
}

const DEFAULT_PROGRESS: Progress = { highestUnlockedLevel: FIRST_LEVEL };

function sanitize(raw: unknown): Progress {
  if (raw && typeof raw === 'object' && 'highestUnlockedLevel' in raw) {
    const value = (raw as { highestUnlockedLevel: unknown }).highestUnlockedLevel;
    if (typeof value === 'number' && Number.isFinite(value)) {
      const clamped = Math.min(
        Math.max(Math.floor(value), FIRST_LEVEL),
        TOTAL_LEVELS,
      );
      return { highestUnlockedLevel: clamped };
    }
  }
  return { ...DEFAULT_PROGRESS };
}

/** Load persisted progress, falling back to a fresh profile on any problem. */
export async function loadProgress(): Promise<Progress> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_PROGRESS };
    return sanitize(JSON.parse(stored));
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

async function writeProgress(progress: Progress): Promise<Progress> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Non-fatal: progress simply won't persist this session.
  }
  return progress;
}

/**
 * Record that `completedLevel` was beaten. Only ever raises
 * `highestUnlockedLevel` — it never moves it backwards, so replaying an early
 * level cannot lower saved progress.
 */
export async function unlockNext(completedLevel: number): Promise<Progress> {
  const current = await loadProgress();
  const target = Math.min(completedLevel + 1, TOTAL_LEVELS);
  if (target <= current.highestUnlockedLevel) return current;
  return writeProgress({ highestUnlockedLevel: target });
}

/**
 * Development helper: reset saved progress. Deliberately not wired to a button
 * in the production-facing home UI (see the dev-only long-press affordance and
 * the debug overlay).
 */
export async function resetProgress(): Promise<Progress> {
  return writeProgress({ ...DEFAULT_PROGRESS });
}

export function isLevelUnlocked(progress: Progress, levelId: number): boolean {
  return levelId >= FIRST_LEVEL && levelId <= progress.highestUnlockedLevel;
}
