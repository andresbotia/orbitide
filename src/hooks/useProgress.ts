import { useCallback, useEffect, useState } from 'react';

import {
  loadProgress,
  resetProgress,
  unlockNext,
  type Progress,
} from '@/storage/progress';
import { FIRST_LEVEL } from '@/game/levels/levels';

export interface ProgressApi {
  progress: Progress;
  loading: boolean;
  /** Persist that `levelId` was completed; unlocks the next level. */
  completeLevel: (levelId: number) => Promise<void>;
  /** Dev-only: wipe progress back to level 1. */
  reset: () => Promise<void>;
  reload: () => Promise<void>;
}

export function useProgress(): ProgressApi {
  const [progress, setProgress] = useState<Progress>({
    highestUnlockedLevel: FIRST_LEVEL,
  });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const loaded = await loadProgress();
    setProgress(loaded);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    loadProgress()
      .then((loaded) => {
        if (active) {
          setProgress(loaded);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const completeLevel = useCallback(async (levelId: number) => {
    const updated = await unlockNext(levelId);
    setProgress(updated);
  }, []);

  const reset = useCallback(async () => {
    const updated = await resetProgress();
    setProgress(updated);
  }, []);

  return { progress, loading, completeLevel, reset, reload };
}
