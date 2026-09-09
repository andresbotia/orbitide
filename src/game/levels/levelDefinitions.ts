import type { LevelDefinition } from '../engine/types';

/**
 * Pixel Arcadia — the production campaign. Three worlds of ten handcrafted
 * levels. Authored through the Level Studio data structures (`LevelDefinition`);
 * grouped into worlds by `src/game/levels/campaign.ts`.
 *
 *   World 1  FIRST LIGHT   L1–10   celestial — teaches the core game
 *   World 2  WILD GARDEN   L11–20  nature — deeper queue sequencing
 *   World 3  DEEP FROST    L21–30  winter — introduces the Frozen mechanic
 *
 * Non-default art characters: A gold · D coral · M magenta · N indigo · T teal
 * · L lime (each forces an explicit `legend`).
 */
export const LEVEL_DEFINITIONS: LevelDefinition[] = [
  // ══ WORLD 1 · FIRST LIGHT ═══════════════════════════════════════════════
  {
    id: 1, title: 'First Light', themeId: 'first-light',
    difficulty: 'easy', holdingCapacity: 3,
    pixelArt: [
      '.WWWW..',
      'WW..W..',
      'WW.....',
      'WW.....',
      'WW.....',
      'WW..W..',
      '.WWWW..',
    ],
    tunnels: [
      [{ color: 'white', capacity: 7 }],
      [{ color: 'white', capacity: 7 }],
      [{ color: 'white', capacity: 6 }],
    ],
    reveal: {
      name: 'THE CRESCENT',
      nodes: [
        { x: 1, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 },
        { x: 1, y: 6 }, { x: 4, y: 6 },
      ],
      lines: [[1, 0], [0, 2], [2, 3], [3, 4]],
      accentNodes: [2],
      collectionId: 'first-light',
    },
  },
  {
    id: 2, title: 'The Guiding Star', themeId: 'first-light',
    difficulty: 'easy', holdingCapacity: 3,
    pixelArt: [
      '...W...',
      '.W.W.W.',
      '..WWW..',
      'WWWAWWW',
      '..WWW..',
      '.W.W.W.',
      '...W...',
    ],
    legend: { A: 'gold' },
    tunnels: [
      [{ color: 'white', capacity: 7 }, { color: 'gold', capacity: 1 }],
      [{ color: 'white', capacity: 7 }],
      [{ color: 'white', capacity: 6 }],
    ],
    reveal: {
      name: 'THE GUIDING STAR',
      nodes: [
        { x: 3, y: 3 }, { x: 3, y: 0 }, { x: 6, y: 3 },
        { x: 3, y: 6 }, { x: 0, y: 3 },
      ],
      lines: [[1, 0], [2, 0], [3, 0], [4, 0]],
      accentNodes: [0],
      collectionId: 'first-light',
    },
  },
  {
    id: 3, title: 'Sunrise', themeId: 'first-light',
    difficulty: 'easy', holdingCapacity: 3,
    pixelArt: [
      '..AAAAA..',
      '.AYYYYYA.',
      '.AYYYYYA.',
      '..YYYYY..',
      '..OOOOO..',
    ],
    legend: { A: 'gold' },
    tunnels: [
      [{ color: 'gold', capacity: 5 }],
      [{ color: 'gold', capacity: 4 }, { color: 'yellow', capacity: 15 }],
      [{ color: 'orange', capacity: 5 }],
    ],
  },
  {
    id: 4, title: 'Saturn', themeId: 'first-light',
    difficulty: 'easy', holdingCapacity: 3,
    pixelArt: [
      '...PPP...',
      '..PPPPP..',
      '.PPPPPPP.',
      'CCCPAPCCC',
      '.PPPPPPP.',
      '..PPPPP..',
      '...PPP...',
    ],
    legend: { A: 'gold' },
    tunnels: [
      [{ color: 'gold', capacity: 1 }, { color: 'purple', capacity: 12 }],
      [{ color: 'purple', capacity: 12 }, { color: 'cyan', capacity: 6 }],
      [{ color: 'purple', capacity: 8 }],
    ],
  },
  {
    id: 5, title: 'The Long Comet', themeId: 'first-light',
    difficulty: 'easy', holdingCapacity: 3,
    pixelArt: [
      '....WWWW',
      '...WCCCW',
      '...WCWCW',
      '...WCCCW',
      '...WWWWW',
      '..KPP...',
      '.KKP....',
      'KKP.....',
    ],
    tunnels: [
      [{ color: 'white', capacity: 16 }, { color: 'cyan', capacity: 2 }],
      [{ color: 'cyan', capacity: 2 }, { color: 'cyan', capacity: 2 }, { color: 'pink', capacity: 5 }],
      [{ color: 'purple', capacity: 4 }, { color: 'cyan', capacity: 2 }],
    ],
  },
  {
    id: 6, title: 'Solar Halo', themeId: 'first-light',
    difficulty: 'easy', holdingCapacity: 3,
    pixelArt: [
      '.OOOOO.',
      'OWWWWWO',
      'OWWAWWO',
      'OWWWWWO',
      '.OOOOO.',
    ],
    legend: { A: 'gold' },
    tunnels: [
      [{ color: 'gold', capacity: 1 }, { color: 'white', capacity: 7 }],
      [{ color: 'orange', capacity: 8 }, { color: 'white', capacity: 7 }],
      [{ color: 'orange', capacity: 8 }],
    ],
  },
  {
    id: 7, title: 'The Pole Star', themeId: 'first-light',
    difficulty: 'easy', holdingCapacity: 3,
    pixelArt: [
      '....Y....',
      '....Y....',
      '..Y.O.Y..',
      '...OOO...',
      'YYOOAOOYY',
      '...OOO...',
      '..Y.O.Y..',
      '....Y....',
      '....Y....',
    ],
    legend: { A: 'gold' },
    tunnels: [
      [{ color: 'yellow', capacity: 8 }, { color: 'orange', capacity: 8 }],
      [{ color: 'gold', capacity: 1 }, { color: 'orange', capacity: 4 }],
      [{ color: 'yellow', capacity: 4 }],
    ],
  },
  {
    id: 8, title: 'Falling Star', themeId: 'first-light',
    difficulty: 'easy', holdingCapacity: 3,
    pixelArt: [
      '..OOO..',
      '.ORRRO.',
      'ORRRRRO',
      'ORRYRRO',
      'ORRRRRO',
      '.ORRRO.',
      '..OOO..',
    ],
    tunnels: [
      [{ color: 'yellow', capacity: 1 }, { color: 'orange', capacity: 8 }],
      [{ color: 'orange', capacity: 8 }, { color: 'red', capacity: 10 }],
      [{ color: 'red', capacity: 10 }],
    ],
  },
  {
    id: 9, title: 'Total Eclipse', themeId: 'first-light',
    difficulty: 'medium', holdingCapacity: 3,
    pixelArt: [
      '.OOOOO.',
      'OOYYYOO',
      'OYKKYYO',
      'OOYYYOO',
      '.OOOOO.',
    ],
    tunnels: [
      [{ color: 'pink', capacity: 1 }, { color: 'yellow', capacity: 5 }, { color: 'orange', capacity: 8 }],
      [{ color: 'pink', capacity: 1 }, { color: 'orange', capacity: 12 }],
      [{ color: 'yellow', capacity: 4 }],
    ],
  },
  {
    id: 10, title: 'Ring Nebula', themeId: 'first-light',
    difficulty: 'hard', holdingCapacity: 3,
    pixelArt: [
      '..YYYY..',
      '.YWWWWY.',
      'YWWOOWWY',
      'YWOKKOWY',
      'YWWOOWWY',
      '.YWWWWY.',
      '..YYYY..',
    ],
    tunnels: [
      [{ color: 'pink', capacity: 1 }, { color: 'white', capacity: 6 }, { color: 'yellow', capacity: 18 }],
      [{ color: 'white', capacity: 8 }, { color: 'pink', capacity: 1 }],
      [{ color: 'orange', capacity: 6 }, { color: 'white', capacity: 4 }],
    ],
    reveal: {
      name: 'THE RING NEBULA',
      nodes: [
        { x: 3.5, y: 3 }, { x: 3.5, y: 0 }, { x: 7, y: 3 },
        { x: 3.5, y: 6 }, { x: 0, y: 3 },
      ],
      lines: [[1, 2], [2, 3], [3, 4], [4, 1], [0, 1], [0, 3]],
      accentNodes: [0],
      collectionId: 'first-light',
    },
  },
];
