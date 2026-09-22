/**
 * Core V2 authoring/solver fixtures for M5.6. Not campaign content.
 * Every definition uses `ruleset: 'coreV2'` and exactly 3 tunnels.
 */
import type { LevelDefinition } from '@/game/engine/types';

const v2 = (
  extra: Partial<LevelDefinition> & Pick<LevelDefinition, 'id' | 'title' | 'pixelArt' | 'tunnels'>,
): LevelDefinition => {
  const tunnels = [...extra.tunnels];
  while (tunnels.length < 3) tunnels.push([]);
  return {
    themeId: 'fixture',
    difficulty: 'easy',
    holdingCapacity: 3,
    ...extra,
    tunnels,
    ruleset: 'coreV2',
  };
};

/** 2×2 white, one tunnel — deterministic one-line win. */
export const V2_DETERMINISTIC: LevelDefinition = v2({
  id: 9601,
  title: 'V2 Deterministic',
  pixelArt: ['WW', 'WW'],
  tunnels: [[{ color: 'white', capacity: 4 }], [], []],
});

/**
 * Buried white behind a blue shell; the white charge sits in front of the
 * only blue source, so it must miss → Holding, then relaunch.
 * `activeCapacity: 1` blocks same-epoch rescue: the miss completes its
 * one pass before blue can fly, so the white charge must be relaunched.
 */
export const V2_HOLDING_RELAUNCH: LevelDefinition = v2({
  id: 9602,
  title: 'V2 Holding Relaunch',
  difficulty: 'medium',
  activeCapacity: 1,
  pixelArt: ['BBB', 'BWB', 'BBB'],
  tunnels: [[{ color: 'white', capacity: 1 }, { color: 'blue', capacity: 8 }], [], []],
});

/** Two opposite-colour pixels, two tunnels — concurrent launches are legal. */
export const V2_MULTI_ACTIVE: LevelDefinition = v2({
  id: 9603,
  title: 'V2 Multi Active',
  pixelArt: ['R.B'],
  tunnels: [
    [{ color: 'red', capacity: 1 }],
    [{ color: 'blue', capacity: 1 }],
    [],
  ],
});

/** 3×3 solid block: 8 first-visible edge pixels, 1 buried centre. */
export const V2_LAYERED_BLOCK: LevelDefinition = v2({
  id: 9604,
  title: 'V2 Layered Block',
  pixelArt: ['BBB', 'BRB', 'BBB'],
  tunnels: [[{ color: 'blue', capacity: 8 }, { color: 'red', capacity: 1 }], [], []],
});

/** Four isolated corners — every occupied cell is first-visible. */
export const V2_EXPOSED_CORNERS: LevelDefinition = v2({
  id: 9605,
  title: 'V2 Exposed Corners',
  pixelArt: ['R.R', '...', 'R.R'],
  tunnels: [[{ color: 'red', capacity: 4 }], [], []],
});

/** Only tunnel 0 is launchable — every decision is forced. */
export const V2_FORCED: LevelDefinition = v2({
  id: 9606,
  title: 'V2 Forced',
  pixelArt: ['WW'],
  tunnels: [[{ color: 'white', capacity: 2 }], [], []],
});

/** Two equivalent winning first tunnels. */
export const V2_MULTI_OPTION: LevelDefinition = v2({
  id: 9607,
  title: 'V2 Multi Option',
  pixelArt: ['WW'],
  tunnels: [
    [{ color: 'white', capacity: 2 }],
    [{ color: 'white', capacity: 2 }],
    [],
  ],
});

/**
 * Trap first move: a miss that fills Holding and blocks the leftover-parking
 * winning charge. The other first move wins immediately.
 */
export const V2_TRAP: LevelDefinition = v2({
  id: 9608,
  title: 'V2 Trap',
  difficulty: 'hard',
  holdingCapacity: 1,
  pixelArt: ['B'],
  tunnels: [
    [{ color: 'white', capacity: 2 }],
    [{ color: 'blue', capacity: 2 }],
    [],
  ],
});

/** All-white, three loaded tunnels — round-robin spam wins. */
export const V2_SPAM_WINS: LevelDefinition = v2({
  id: 9609,
  title: 'V2 Spam Wins',
  pixelArt: ['WWW', 'WWW'],
  tunnels: [
    [{ color: 'white', capacity: 2 }],
    [{ color: 'white', capacity: 2 }],
    [{ color: 'white', capacity: 2 }],
  ],
});

/** Round-robin starts on the trap tunnel and loses; the other opening wins. */
export const V2_SPAM_FAILS: LevelDefinition = v2({
  id: 9610,
  title: 'V2 Spam Fails',
  difficulty: 'hard',
  holdingCapacity: 1,
  pixelArt: ['B'],
  tunnels: [
    [{ color: 'white', capacity: 2 }],
    [{ color: 'blue', capacity: 2 }],
    [],
  ],
});
