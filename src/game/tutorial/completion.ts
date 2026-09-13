import { TUTORIAL_IDS, type TutorialId } from './types';

/**
 * Persistence port. Production uses AsyncStorage (`src/storage/tutorials.ts`);
 * tests inject a memory store. Campaign progress is a different key.
 */
export interface TutorialCompletionStore {
  read(): Promise<readonly string[]>;
  write(ids: readonly string[]): Promise<void>;
}

export function createMemoryTutorialStore(
  seed: readonly string[] = [],
): TutorialCompletionStore {
  let ids = sanitizeIds(seed);
  return {
    async read() {
      return [...ids];
    },
    async write(next) {
      ids = sanitizeIds(next);
    },
  };
}

export function sanitizeIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    const id = value.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export async function loadCompletedTutorialIds(
  store: TutorialCompletionStore,
): Promise<Set<string>> {
  try {
    return new Set(sanitizeIds(await store.read()));
  } catch {
    return new Set();
  }
}

export async function markTutorialComplete(
  store: TutorialCompletionStore,
  id: TutorialId = TUTORIAL_IDS.coreLevel1,
): Promise<Set<string>> {
  const current = await loadCompletedTutorialIds(store);
  if (current.has(id)) return current;
  const next = new Set(current);
  next.add(id);
  try {
    await store.write([...next]);
  } catch {
    // Non-fatal: completion simply won't persist this session.
  }
  return next;
}

/** Future “Replay Tutorial” path. Not wired to any settings UI. */
export async function clearTutorialComplete(
  store: TutorialCompletionStore,
  id: TutorialId = TUTORIAL_IDS.coreLevel1,
): Promise<Set<string>> {
  const current = await loadCompletedTutorialIds(store);
  if (!current.has(id)) return current;
  const next = new Set(current);
  next.delete(id);
  try {
    await store.write([...next]);
  } catch {
    // Non-fatal.
  }
  return next;
}
