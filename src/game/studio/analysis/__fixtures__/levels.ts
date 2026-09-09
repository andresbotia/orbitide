/**
 * Deterministic fixture levels for the difficulty formula, warning rules and
 * first-move classification. These are NOT campaign levels — they exist to
 * exercise specific analysis behaviours so the formula is not tuned only
 * against Levels 1–10.
 */
import type { LevelDefinition } from '@/game/engine/types';

/** One tunnel that clears the whole board in a single obvious move. */
export const OBVIOUS_EASY: LevelDefinition = {
  id: 8001, title: 'Obvious Easy', themeId: 'fixture', difficulty: 'easy', holdingCapacity: 3,
  pixelArt: ['WWWW', 'WWWW', 'WWWW', 'WWWW'],
  tunnels: [
    [{ color: 'white', capacity: 8 }],
    [{ color: 'white', capacity: 8 }],
    [{ color: 'white', capacity: 8 }],
  ],
};

/** Several wide-open, calm, equivalent first moves. */
export const BRANCHING_EASY: LevelDefinition = {
  id: 8002, title: 'Branching Easy', themeId: 'fixture', difficulty: 'easy', holdingCapacity: 3,
  pixelArt: ['WWWWW', 'WWWWW', 'WWWWW', 'WWWWW', 'WWWWW'],
  tunnels: [
    [{ color: 'white', capacity: 9 }],
    [{ color: 'white', capacity: 8 }],
    [{ color: 'white', capacity: 8 }],
  ],
};

/**
 * A dead-centre white pixel. Its only charge sits in front of tunnel 0's red,
 * and tunnels 1+2 cannot strip enough red to expose it — so white MUST be
 * launched (missing → Holding), then manually relaunched once tunnel 0's red
 * finishes the job.
 */
export const HOLDING_MEDIUM: LevelDefinition = {
  id: 8003, title: 'Holding Medium', themeId: 'fixture', difficulty: 'medium', holdingCapacity: 3,
  pixelArt: ['WWWWW', 'WWBWW', 'WWWWW'],
  tunnels: [
    // Blue is buried and its charge sits in front of the ONLY white source, so
    // blue must be launched (missing → Holding) before the white clears the
    // cover, then relaunched. Every winning line needs one held relaunch.
    [{ color: 'blue', capacity: 1 }, { color: 'white', capacity: 14 }],
    [],
    [],
  ],
};

/** Authored hard, but forced and almost linear. */
export const NARROW_HARD: LevelDefinition = {
  id: 8004, title: 'Narrow Hard', themeId: 'fixture', difficulty: 'hard', holdingCapacity: 3,
  pixelArt: ['WBWBW'],
  tunnels: [
    [{ color: 'white', capacity: 3 }, { color: 'blue', capacity: 2 }],
    [],
    [],
  ],
};

/** Under-budget on green — cannot be completed. */
export const UNSOLVABLE: LevelDefinition = {
  id: 8005, title: 'Unsolvable', themeId: 'fixture', difficulty: 'medium', holdingCapacity: 3,
  pixelArt: ['GGGG', 'GGGG'],
  tunnels: [
    [{ color: 'green', capacity: 3 }],
    [{ color: 'green', capacity: 3 }],
    [],
  ],
};

/** Three colours, three full tunnels — a materially bigger search than the easy fixtures. */
export const SOLVER_HEAVY: LevelDefinition = {
  id: 8006, title: 'Solver Heavy', themeId: 'fixture', difficulty: 'hard', holdingCapacity: 3,
  pixelArt: ['BWCWB', 'WCBCW', 'CBWBC', 'WCBCW', 'BWCWB'],
  tunnels: [
    [{ color: 'blue', capacity: 4 }, { color: 'white', capacity: 5 }, { color: 'cyan', capacity: 4 }],
    [{ color: 'white', capacity: 4 }, { color: 'cyan', capacity: 3 }],
    [{ color: 'cyan', capacity: 1 }, { color: 'blue', capacity: 4 }],
  ],
};

export const ALL_FIXTURES: LevelDefinition[] = [
  OBVIOUS_EASY, BRANCHING_EASY, HOLDING_MEDIUM, NARROW_HARD, UNSOLVABLE, SOLVER_HEAVY,
];
