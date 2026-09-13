import { createGame } from '@/game/engine/createGame';
import { resolveLaunch } from '@/game/engine/resolveLaunch';
import type { LevelDefinition } from '@/game/engine/types';
import {
  clearTutorialComplete,
  createMemoryTutorialStore,
  createTutorial,
  loadCompletedTutorialIds,
  markTutorialComplete,
  shouldActivateCoreLevel1Tutorial,
  TUTORIAL_IDS,
} from '@/game/tutorial';
function coreV2Level1(): LevelDefinition {
  return {
    id: 1,
    title: 'First Light',
    themeId: 'first-light',
    difficulty: 'easy',
    holdingCapacity: 4,
    pixelArt: ['BBB', 'BRB', 'BRB'],
    tunnels: [
      [{ color: 'red', capacity: 2 }],
      [{ color: 'blue', capacity: 8 }],
      [],
      [],
    ],
    ruleset: 'coreV2',
  };
}

describe('tutorial completion persistence', () => {
  test('survives a new session/load on the same store', async () => {
    const store = createMemoryTutorialStore();
    expect(shouldActivateCoreLevel1Tutorial({
      levelId: 1, ruleset: 'coreV2', completed: await loadCompletedTutorialIds(store),
    })).toBe(true);

    await markTutorialComplete(store, TUTORIAL_IDS.coreLevel1);

    const reloaded = await loadCompletedTutorialIds(store);
    expect(reloaded.has(TUTORIAL_IDS.coreLevel1)).toBe(true);
    expect(shouldActivateCoreLevel1Tutorial({
      levelId: 1, ruleset: 'coreV2', completed: reloaded,
    })).toBe(false);
    expect(createTutorial(coreV2Level1(), reloaded).active).toBe(false);
    expect(createTutorial(coreV2Level1(), reloaded).completed).toBe(true);
  });

  test('is independent of campaign level completion', async () => {
    const store = createMemoryTutorialStore();
    await markTutorialComplete(store);

    // Campaign progress uses a different module/key. Tutorial completion must
    // not be inferred from beating Level 1, and beating Level 1 must not be
    // inferred from the tutorial flag. This test keeps them on separate APIs.
    expect((await loadCompletedTutorialIds(store)).has(TUTORIAL_IDS.coreLevel1)).toBe(true);
    const t = createTutorial(coreV2Level1(), await loadCompletedTutorialIds(store));
    expect(t.completed).toBe(true);

    const outcome = resolveLaunch(createGame(coreV2Level1()), 'tunnel-0');
    expect(outcome.state.status).toBe('playing');
  });

  test('Replay Tutorial clears only that id', async () => {
    const store = createMemoryTutorialStore([TUTORIAL_IDS.coreLevel1, 'frozen-intro']);
    const after = await clearTutorialComplete(store, TUTORIAL_IDS.coreLevel1);
    expect(after.has(TUTORIAL_IDS.coreLevel1)).toBe(false);
    expect(after.has('frozen-intro')).toBe(true);
    expect(createTutorial(coreV2Level1(), after).active).toBe(true);
  });
});
