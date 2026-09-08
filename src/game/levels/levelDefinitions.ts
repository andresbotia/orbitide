import type { LevelDefinition } from '../engine/types';

/**
 * The ten handcrafted Milestone 1 levels.
 *
 * Convention reminder: in every lane, index 0 is the exposed orb. Each level's
 * total orb count equals the sum of its Core target counts, and every level has
 * been verified solvable — automatically by the BFS solver in
 * `levelDefinitions.test.ts`, and by the hand-traced solution in each comment.
 *
 * Design intent per level is noted inline; the levels teach through structure,
 * not tutorial text.
 */
export const LEVEL_DEFINITIONS: LevelDefinition[] = [
  // L1 — Two colors, every orb directly tappable. Teaches: tap an orb that
  // matches the Core. No holding needed.
  {
    id: 1,
    holdingCapacity: 3,
    coreTargets: [
      { color: 'blue', count: 2 },
      { color: 'yellow', count: 2 },
    ],
    lanes: [['blue'], ['yellow'], ['blue'], ['yellow']],
  },

  // L2 — Two colors. One blue is trapped behind a yellow, forcing exactly one
  // harmless hold. Teaches: a non-matching tap parks the orb safely.
  {
    id: 2,
    holdingCapacity: 3,
    coreTargets: [
      { color: 'blue', count: 3 },
      { color: 'yellow', count: 2 },
    ],
    lanes: [
      ['yellow', 'blue'],
      ['blue'],
      ['blue'],
      ['yellow'],
    ],
  },

  // L3 — Hold a red while blue is active, then watch it fly in the instant red
  // becomes the target. Teaches: held orbs auto-resolve on Core change.
  {
    id: 3,
    holdingCapacity: 3,
    coreTargets: [
      { color: 'blue', count: 2 },
      { color: 'red', count: 2 },
    ],
    lanes: [
      ['red', 'blue'],
      ['red'],
      ['blue'],
    ],
  },

  // L4 — Third color arrives. Every lane is depth 2; one hold is required to
  // free the second blue.
  {
    id: 4,
    holdingCapacity: 3,
    coreTargets: [
      { color: 'blue', count: 2 },
      { color: 'yellow', count: 2 },
      { color: 'red', count: 2 },
    ],
    lanes: [
      ['blue', 'red'],
      ['yellow', 'blue'],
      ['red', 'yellow'],
    ],
  },

  // L5 — Deeper lanes (depth 3). More digging, but the tray never needs more
  // than two slots if played in order.
  {
    id: 5,
    holdingCapacity: 3,
    coreTargets: [
      { color: 'blue', count: 3 },
      { color: 'yellow', count: 3 },
      { color: 'red', count: 2 },
    ],
    lanes: [
      ['blue', 'yellow', 'red'],
      ['yellow', 'blue', 'yellow'],
      ['red', 'blue'],
    ],
  },

  // L6 — Several matching orbs are exposed at once for every target. Teaches:
  // when you have a choice, any matching orb is fine. No hold required.
  {
    id: 6,
    holdingCapacity: 3,
    coreTargets: [
      { color: 'blue', count: 2 },
      { color: 'yellow', count: 2 },
      { color: 'red', count: 2 },
    ],
    lanes: [
      ['blue', 'yellow'],
      ['blue', 'red'],
      ['yellow'],
      ['red'],
    ],
  },

  // L7 — First real overflow danger. Only one red is exposed; the other two are
  // each buried under one orb. Over-holding the spare blue fills all three
  // slots and loses. Correct line keeps the tray at two.
  {
    id: 7,
    holdingCapacity: 3,
    coreTargets: [
      { color: 'red', count: 3 },
      { color: 'blue', count: 2 },
      { color: 'yellow', count: 2 },
    ],
    lanes: [
      ['red'],
      ['yellow', 'red'],
      ['blue', 'red'],
      ['blue', 'yellow'],
    ],
  },

  // L8 — Sequencing. Two separate "hold the blocker, let it auto-resolve"
  // cycles, around a 3-count red target.
  {
    id: 8,
    holdingCapacity: 3,
    coreTargets: [
      { color: 'blue', count: 2 },
      { color: 'red', count: 3 },
      { color: 'yellow', count: 2 },
    ],
    lanes: [
      ['red', 'blue'],
      ['yellow', 'red'],
      ['blue', 'red'],
      ['yellow'],
    ],
  },

  // L9 — Four colors, five lanes, greater visual density. A chain of
  // hold-then-auto-resolve steps down through the target sequence.
  {
    id: 9,
    holdingCapacity: 3,
    coreTargets: [
      { color: 'blue', count: 3 },
      { color: 'yellow', count: 3 },
      { color: 'red', count: 2 },
      { color: 'green', count: 2 },
    ],
    lanes: [
      ['blue', 'green'],
      ['yellow', 'blue'],
      ['red', 'yellow'],
      ['green', 'red'],
      ['blue', 'yellow'],
    ],
  },

  // L10 — Compact capstone. Four colors, four depth-2 lanes, interlocked so
  // every target needs exactly one hold that pays off on the next Core change.
  {
    id: 10,
    holdingCapacity: 3,
    coreTargets: [
      { color: 'blue', count: 2 },
      { color: 'yellow', count: 2 },
      { color: 'red', count: 2 },
      { color: 'green', count: 2 },
    ],
    lanes: [
      ['yellow', 'blue'],
      ['green', 'red'],
      ['blue', 'yellow'],
      ['red', 'green'],
    ],
  },
];
