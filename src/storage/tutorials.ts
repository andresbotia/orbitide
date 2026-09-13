import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  sanitizeIds,
  type TutorialCompletionStore,
} from '@/game/tutorial/completion';

const STORAGE_KEY = 'orbitide/tutorials/v1';

/**
 * One-time tutorial completion, stored separately from campaign progress
 * (`orbitide/progress/v1`). Replaying Level 1 after the core tutorial is done
 * must not force it again; resetting campaign progress does not clear this.
 */
export const asyncTutorialStore: TutorialCompletionStore = {
  async read() {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return sanitizeIds(JSON.parse(stored));
  },
  async write(ids) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeIds(ids)));
  },
};
