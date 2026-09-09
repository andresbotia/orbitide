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

  // ══ WORLD 2 · WILD GARDEN ═══════════════════════════════════════════════
  {
    id: 11, title: 'Ladybird', themeId: 'wild-garden',
    difficulty: 'easy', holdingCapacity: 3,
    pixelArt: [
      '...NNN...',
      '..RRRRR..',
      '.RNRRRNR.',
      '.RRRNRRR.',
      '.RNRRRNR.',
      '..RRRRR..',
      '...GGG...',
    ],
    legend: { N: 'indigo' },
    tunnels: [
      [{ color: 'indigo', capacity: 5 }, { color: 'red', capacity: 13 }],
      [{ color: 'red', capacity: 13 }],
      [{ color: 'indigo', capacity: 3 }, { color: 'green', capacity: 3 }],
    ],
  },
  {
    id: 12, title: 'Tulip', themeId: 'wild-garden',
    difficulty: 'easy', holdingCapacity: 3,
    pixelArt: [
      'M.M.M.M',
      'MMMMMMM',
      'MMMMMMM',
      '.MMMMM.',
      '..MGM..',
      '...G...',
      '..GGG..',
    ],
    legend: { M: 'magenta' },
    tunnels: [
      [{ color: 'magenta', capacity: 13 }],
      [{ color: 'magenta', capacity: 12 }, { color: 'green', capacity: 3 }],
      [{ color: 'green', capacity: 2 }],
    ],
  },
  {
    id: 13, title: 'Honeybee', themeId: 'wild-garden',
    difficulty: 'easy', holdingCapacity: 3,
    pixelArt: [
      '..W...W..',
      '.WW...WW.',
      '..YYYYY..',
      '..NNNNN..',
      '..YYYYY..',
      '..NNNNN..',
      '..YYYYY..',
      '...N.N...',
    ],
    legend: { N: 'indigo' },
    tunnels: [
      [{ color: 'white', capacity: 3 }, { color: 'indigo', capacity: 12 }, { color: 'yellow', capacity: 8 }],
      [{ color: 'yellow', capacity: 7 }],
      [{ color: 'white', capacity: 3 }],
    ],
  },
  {
    id: 14, title: 'Toadstool', themeId: 'wild-garden',
    difficulty: 'medium', holdingCapacity: 3,
    pixelArt: [
      '..RRRRR..',
      '.RRWRRWR.',
      'RRWRRRWRR',
      'RRRRWRRRR',
      '.RRRRRRR.',
      '...WWW...',
      '...WDW...',
      '...WWW...',
    ],
    legend: { D: 'coral' },
    tunnels: [
      [{ color: 'coral', capacity: 1 }, { color: 'white', capacity: 5 }, { color: 'red', capacity: 20 }],
      [{ color: 'red', capacity: 12 }],
      [{ color: 'white', capacity: 8 }],
    ],
  },
  {
    id: 15, title: 'Dragonfly', themeId: 'wild-garden',
    difficulty: 'medium', holdingCapacity: 3,
    pixelArt: [
      'CCC.T.CCC',
      'CCCCTCCCC',
      'CCCCTCCCC',
      'CCCMTMCCC',
      'CCCCTCCCC',
      '....T....',
      '....T....',
      '...LLL...',
      '....L....',
    ],
    legend: { T: 'teal', L: 'lime', M: 'magenta' },
    tunnels: [
      [{ color: 'magenta', capacity: 2 }, { color: 'teal', capacity: 7 }, { color: 'cyan', capacity: 18 }],
      [{ color: 'cyan', capacity: 18 }],
      [{ color: 'lime', capacity: 4 }],
    ],
  },
  {
    id: 16, title: 'Monarch', themeId: 'wild-garden',
    difficulty: 'medium', holdingCapacity: 3,
    pixelArt: [
      'OOO.N.OOO',
      'ONOONOONO',
      'OOWONWOOW',
      'OOOONOOOO',
      'OOWONWOOW',
      'ONOONOONO',
      'OOO.N.OOO',
    ],
    legend: { N: 'indigo' },
    tunnels: [
      [{ color: 'white', capacity: 6 }, { color: 'indigo', capacity: 11 }, { color: 'orange', capacity: 20 }],
      [{ color: 'orange', capacity: 12 }],
      [{ color: 'orange', capacity: 10 }],
    ],
  },
  {
    id: 17, title: 'Koi Pond', themeId: 'wild-garden',
    difficulty: 'medium', holdingCapacity: 3,
    pixelArt: [
      'BBBBBBBBB',
      'B.OOO.B.B',
      'BOOWOOBBB',
      'BOOOOOB.B',
      'B.OWO.BBB',
      'BB.O.BB.B',
      'BBBBBBBBB',
    ],
    tunnels: [
      [{ color: 'white', capacity: 2 }, { color: 'orange', capacity: 15 }, { color: 'blue', capacity: 15 }],
      [{ color: 'blue', capacity: 15 }],
      [{ color: 'blue', capacity: 7 }],
    ],
  },
  {
    id: 18, title: 'Hummingbird', themeId: 'wild-garden',
    difficulty: 'medium', holdingCapacity: 3,
    pixelArt: [
      '......GGG',
      '.....GGGG',
      'M...GGTGG',
      'MM.GGGGTG',
      'MMGGGGGG.',
      'M.GGTGG..',
      '...GG....',
      '..LL.....',
      '.LL......',
    ],
    legend: { M: 'magenta', T: 'teal', L: 'lime' },
    tunnels: [
      [{ color: 'teal', capacity: 3 }, { color: 'green', capacity: 18 }],
      [{ color: 'green', capacity: 10 }],
      [{ color: 'magenta', capacity: 6 }, { color: 'lime', capacity: 4 }],
    ],
  },
  {
    id: 19, title: 'Red Fox', themeId: 'wild-garden',
    difficulty: 'medium', holdingCapacity: 3,
    pixelArt: [
      'O.......O',
      'OO.....OO',
      'OWO...OWO',
      'OOWOWOWOO',
      'OOOWNWOOO',
      'OOOOWOOOO',
      '.OOWWWOO.',
      '..OOOOO..',
      '...WWW...',
    ],
    legend: { N: 'indigo' },
    tunnels: [
      [{ color: 'indigo', capacity: 1 }, { color: 'white', capacity: 6 }, { color: 'orange', capacity: 22 }],
      [{ color: 'orange', capacity: 17 }],
      [{ color: 'white', capacity: 8 }],
    ],
  },
  {
    id: 20, title: 'The Great Oak', themeId: 'wild-garden',
    difficulty: 'hard', holdingCapacity: 3,
    pixelArt: [
      '...GGG...',
      '.GLGGGLG.',
      '.GGDDDGG.',
      'GGDAGADGG',
      '.GGDDDGG.',
      '.GLGGGLG.',
      '...GGG...',
    ],
    legend: { A: 'gold', D: 'coral', L: 'lime' },
    tunnels: [
      [{ color: 'gold', capacity: 2 }, { color: 'coral', capacity: 8 }, { color: 'green', capacity: 20 }],
      [{ color: 'lime', capacity: 4 }, { color: 'green', capacity: 5 }],
      [{ color: 'green', capacity: 4 }],
    ],
    reveal: {
      name: 'THE WORLD TREE',
      nodes: [
        { x: 4, y: 3 }, { x: 1, y: 1 }, { x: 7, y: 1 }, { x: 4, y: 0 },
        { x: 4, y: 6 }, { x: 2, y: 5 }, { x: 6, y: 5 },
      ],
      lines: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]],
      accentNodes: [0],
      collectionId: 'wild-garden',
    },
  },
];
