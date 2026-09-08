import type { LevelDefinition } from '../engine/types';

/**
 * The ten handcrafted Milestone 1 levels for the pixel-clearing mechanic.
 *
 * Each level is a recognizable space silhouette. They teach through structure:
 * outer pixels clear first, inner colors become reachable as layers peel, and
 * over-large charges park in Holding until their color is exposed again.
 *
 * Authoring invariants (checked in `levelDefinitions.test.ts`):
 *  - exactly 3 tunnels per level
 *  - for every color, the sum of tunnel-charge capacities is >= the number of
 *    pixels of that color (so the picture can be fully cleared)
 *  - every level is winnable (BFS/DFS solver proof)
 *
 * Legend: B blue · C cyan · W white · P purple · K pink · Y yellow · O orange
 *         R red · G green · '.' empty
 */
export const LEVEL_DEFINITIONS: LevelDefinition[] = [
  // L1 - MOON. Three equal white charges; every launch order wins; brief leftover auto-resolution is harmless.
  {
    id: 1,
    title: 'Moon',
    themeId: 'first-light',
    difficulty: 'easy',
    holdingCapacity: 3,
    pixelArt: [
      '.WWW.',
      'WWWWW',
      'WWWWW',
      'WWWWW',
      '.WWW.',
    ],
    tunnels: [
      [{ color: 'white', capacity: 7 }],
      [{ color: 'white', capacity: 7 }],
      [{ color: 'white', capacity: 7 }],
    ],
  },

  // L2 - STAR. Unchanged: white arms teach capacity, then the yellow heart.
  {
    id: 2,
    title: 'Star',
    themeId: 'first-light',
    difficulty: 'easy',
    holdingCapacity: 3,
    pixelArt: [
      '..W..',
      '.WWW.',
      'WWYWW',
      '.WWW.',
      '..W..',
    ],
    tunnels: [
      [{ color: 'white', capacity: 4 }, { color: 'yellow', capacity: 1 }],
      [{ color: 'white', capacity: 4 }],
      [{ color: 'white', capacity: 4 }],
    ],
  },

  // L3 - SMALL PLANET. Buried white at T1: peel cyan first or safely park white.
  {
    id: 3,
    title: 'Small Planet',
    themeId: 'first-light',
    difficulty: 'easy',
    holdingCapacity: 3,
    pixelArt: [
      '.CCC.',
      'CCCCC',
      'CCWCC',
      'CCCCC',
      '.CCC.',
    ],
    tunnels: [
      [{ color: 'white', capacity: 1 }, { color: 'cyan', capacity: 14 }],
      [{ color: 'cyan', capacity: 4 }],
      [{ color: 'cyan', capacity: 2 }],
    ],
  },

  // L4 - ROCKET. Blue must park to unlock the white hull; one safe Holding slot.
  {
    id: 4,
    title: 'Rocket',
    themeId: 'first-light',
    difficulty: 'easy',
    holdingCapacity: 3,
    pixelArt: [
      '..R..',
      '.RRR.',
      '.WWW.',
      '.WBW.',
      '.WWW.',
      '.O.O.',
    ],
    tunnels: [
      [{ color: 'blue', capacity: 1 }, { color: 'white', capacity: 4 }, { color: 'white', capacity: 4 }],
      [{ color: 'red', capacity: 4 }],
      [{ color: 'orange', capacity: 2 }],
    ],
  },

  // L5 - COMET. Clear white between cyan launches; purple provides a forgiving first tap.
  {
    id: 5,
    title: 'Comet',
    themeId: 'first-light',
    difficulty: 'easy',
    holdingCapacity: 3,
    pixelArt: [
      '....WWW',
      '...WCCW',
      '...WCCW',
      '...WWWW',
      '..KP...',
      '.KP....',
      'KP.....',
    ],
    tunnels: [
      [{ color: 'cyan', capacity: 1 }, { color: 'white', capacity: 5 }, { color: 'pink', capacity: 3 }],
      [{ color: 'cyan', capacity: 1 }, { color: 'white', capacity: 4 }],
      [{ color: 'purple', capacity: 3 }, { color: 'cyan', capacity: 2 }, { color: 'white', capacity: 2 }],
    ],
  },

  // L6 - RINGED PLANET. Blue fronts and an oversized cyan front; interleave shell clears.
  {
    id: 6,
    title: 'Ringed Planet',
    themeId: 'first-light',
    difficulty: 'easy',
    holdingCapacity: 3,
    pixelArt: [
      '..PPP..',
      '.PBBBP.',
      'COCCCOC',
      '.PBKBP.',
      '..PPP..',
    ],
    tunnels: [
      [{ color: 'blue', capacity: 3 }, { color: 'purple', capacity: 5 }, { color: 'pink', capacity: 1 }],
      [{ color: 'cyan', capacity: 3 }, { color: 'purple', capacity: 3 }, { color: 'orange', capacity: 2 }],
      [{ color: 'blue', capacity: 2 }, { color: 'purple', capacity: 2 }, { color: 'cyan', capacity: 2 }],
    ],
  },

  // L7 - SATELLITE. Pink then white in T1 creates a second Holding commitment.
  {
    id: 7,
    title: 'Satellite',
    themeId: 'first-light',
    difficulty: 'easy',
    holdingCapacity: 3,
    pixelArt: [
      'BBBBB',
      'BKKKB',
      'BKWKB',
      'BKKKB',
      'BBBBB',
    ],
    tunnels: [
      [{ color: 'pink', capacity: 3 }, { color: 'white', capacity: 1 }, { color: 'blue', capacity: 6 }],
      [{ color: 'pink', capacity: 3 }, { color: 'blue', capacity: 6 }],
      [{ color: 'pink', capacity: 2 }, { color: 'blue', capacity: 4 }],
    ],
  },

  // L8 - NEBULA. Two buried colors in T3 require planning around the purple opener.
  {
    id: 8,
    title: 'Nebula',
    themeId: 'first-light',
    difficulty: 'easy',
    holdingCapacity: 3,
    pixelArt: [
      'CPPPC',
      'PKGKP',
      'PGYGP',
      'PKGKP',
      'CPPPC',
    ],
    tunnels: [
      [{ color: 'pink', capacity: 2 }, { color: 'purple', capacity: 6 }, { color: 'yellow', capacity: 1 }],
      [{ color: 'green', capacity: 2 }, { color: 'cyan', capacity: 2 }, { color: 'purple', capacity: 6 }],
      [{ color: 'pink', capacity: 2 }, { color: 'green', capacity: 2 }, { color: 'cyan', capacity: 2 }],
    ],
  },

  // L9 - CONSTELLATION. Medium: interleaved white, core and stars delay blue access.
  {
    id: 9,
    title: 'Constellation',
    themeId: 'first-light',
    difficulty: 'medium',
    holdingCapacity: 3,
    pixelArt: [
      'G.....C',
      '.BBBBB.',
      '.BWWWB.',
      '.BWKWB.',
      '.BWWWB.',
      '.BBBBB.',
      'O.....P',
    ],
    tunnels: [
      [{ color: 'white', capacity: 3 }, { color: 'pink', capacity: 1 }, { color: 'green', capacity: 1 }, { color: 'blue', capacity: 6 }],
      [{ color: 'white', capacity: 4 }, { color: 'cyan', capacity: 1 }, { color: 'blue', capacity: 6 }],
      [{ color: 'orange', capacity: 1 }, { color: 'white', capacity: 1 }, { color: 'blue', capacity: 4 }, { color: 'purple', capacity: 1 }],
    ],
  },

  // L10 - ECLIPSE. Hard: buried pink and white precede corona clears in multiple tunnels.
  {
    id: 10,
    title: 'Eclipse',
    themeId: 'first-light',
    difficulty: 'hard',
    holdingCapacity: 3,
    pixelArt: [
      '.YYYY.',
      'YWWWWY',
      'OWKKWO',
      'YWKKWY',
      'YWWWWY',
      '.YYYY.',
    ],
    tunnels: [
      [{ color: 'pink', capacity: 2 }, { color: 'white', capacity: 5 }, { color: 'yellow', capacity: 6 }],
      [{ color: 'white', capacity: 4 }, { color: 'orange', capacity: 1 }, { color: 'yellow', capacity: 5 }],
      [{ color: 'pink', capacity: 2 }, { color: 'white', capacity: 3 }, { color: 'yellow', capacity: 3 }, { color: 'orange', capacity: 1 }],
    ],
  },
];
