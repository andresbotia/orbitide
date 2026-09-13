import { useCallback, useEffect, useState } from 'react';

import {
  clearTutorialComplete,
  loadCompletedTutorialIds,
  markTutorialComplete,
  TUTORIAL_IDS,
  type TutorialId,
} from '@/game/tutorial';
import { asyncTutorialStore } from '@/storage/tutorials';

let cached = new Set<string>();
let loaded = false;
const listeners = new Set<(ids: Set<string>) => void>();

function broadcast(ids: Set<string>) {
  cached = ids;
  for (const listener of listeners) listener(ids);
}

export interface TutorialCompletionApi {
  completed: ReadonlySet<string>;
  ready: boolean;
  markComplete: (id?: TutorialId) => Promise<void>;
  /** Future “Replay Tutorial” path. Not wired to settings UI. */
  replay: (id?: TutorialId) => Promise<void>;
}

export function useTutorialCompletion(): TutorialCompletionApi {
  const [completed, setCompleted] = useState<Set<string>>(cached);
  const [ready, setReady] = useState(loaded);

  useEffect(() => {
    const listener = (ids: Set<string>) => setCompleted(ids);
    listeners.add(listener);
    if (!loaded) {
      void loadCompletedTutorialIds(asyncTutorialStore).then((ids) => {
        loaded = true;
        broadcast(ids);
        setReady(true);
      });
    }
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const markComplete = useCallback(async (id: TutorialId = TUTORIAL_IDS.coreLevel1) => {
    const next = await markTutorialComplete(asyncTutorialStore, id);
    broadcast(next);
  }, []);

  const replay = useCallback(async (id: TutorialId = TUTORIAL_IDS.coreLevel1) => {
    const next = await clearTutorialComplete(asyncTutorialStore, id);
    broadcast(next);
  }, []);

  return { completed, ready, markComplete, replay };
}
