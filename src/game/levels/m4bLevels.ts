import type {
  LevelDefinition,
  LevelDifficulty,
  LevelReveal,
  OrbColor,
  PixelModifierMap,
} from '../engine/types';

const LEGEND: Record<string, OrbColor> = {
  W: 'white', Y: 'yellow', A: 'gold', O: 'orange', R: 'red', D: 'coral',
  K: 'pink', M: 'magenta', P: 'purple', N: 'indigo', B: 'blue', C: 'cyan',
  T: 'teal', G: 'green', L: 'lime',
};

interface AuthoredLevel {
  id: number;
  title: string;
  themeId: 'curio-cabinet' | 'prism-works' | 'frostglass-forge';
  difficulty: LevelDifficulty;
  art: string[];
  queues: OrbColor[][];
  modifiers?: PixelModifierMap;
  tutorial?: string;
}

function revealFor(rows: string[], name: string, collectionId: string): LevelReveal {
  const occupied: { x: number; y: number }[] = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.' && ch !== ' ') occupied.push({ x, y }); }));
  const top = occupied.reduce((a, b) => b.y < a.y ? b : a);
  const right = occupied.reduce((a, b) => b.x > a.x ? b : a);
  const bottom = occupied.reduce((a, b) => b.y > a.y ? b : a);
  const left = occupied.reduce((a, b) => b.x < a.x ? b : a);
  const center = occupied[Math.floor(occupied.length / 2)]!;
  return {
    name: name.toUpperCase(),
    nodes: [top, right, bottom, left, center],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 2]],
    accentNodes: [4],
    collectionId,
  };
}

function makeLevel(a: AuthoredLevel): LevelDefinition {
  const needs = new Map<OrbColor, number>();
  a.art.forEach((row) => [...row].forEach((ch) => {
    const color = LEGEND[ch];
    if (color) needs.set(color, (needs.get(color) ?? 0) + 1);
  }));
  for (const [key, modifier] of Object.entries(a.modifiers ?? {})) {
    if (modifier.kind !== 'frozen' && modifier.kind !== 'shielded') continue;
    const [x, y] = key.split(',').map(Number);
    const color = LEGEND[a.art[y!]?.[x!] ?? ''];
    if (color) needs.set(color, (needs.get(color) ?? 0) + Math.max(1, Math.trunc(modifier.level ?? 1)));
  }
  const seen = new Set<OrbColor>();
  const tunnels = a.queues.map((queue) => queue.map((color) => {
    if (seen.has(color)) throw new Error(`Level ${a.id}: duplicate authored charge color ${color}`);
    seen.add(color);
    const capacity = needs.get(color) ?? 0;
    if (capacity <= 0) throw new Error(`Level ${a.id}: ${color} charge has no pixels`);
    return { color, capacity };
  }));
  if (tunnels.length !== 3 || tunnels.some((q) => q.length === 0)) throw new Error(`Level ${a.id}: malformed queues`);
  for (const color of needs.keys()) if (!seen.has(color)) throw new Error(`Level ${a.id}: missing ${color} charge`);
  return {
    id: a.id, title: a.title, themeId: a.themeId, difficulty: a.difficulty,
    holdingCapacity: 3, pixelArt: a.art, legend: LEGEND, tunnels,
    reveal: revealFor(a.art, a.title, a.themeId),
    ...(a.modifiers ? { modifiers: a.modifiers } : {}),
    ...(a.tutorial ? { tutorial: a.tutorial } : {}),
  };
}

const F = (coords: string[]): PixelModifierMap => Object.fromEntries(coords.map((key) => [key, { kind: 'frozen', level: 1 }]));
const S = (coords: string[]): PixelModifierMap => Object.fromEntries(coords.map((key) => [key, { kind: 'shielded', level: 1 }]));
const MIX = (frozen: string[], shielded: string[]): PixelModifierMap => ({ ...F(frozen), ...S(shielded) });

export const M4B_LEVELS: LevelDefinition[] = [
  // WORLD 4 · CURIO CABINET — Frozen mastery among readable collected objects.
  makeLevel({ id: 31, title: 'Old Hourglass', themeId: 'curio-cabinet', difficulty: 'medium',
    art: ['AARRRRAA','.OOYYOO.','..WYYW..','..CWW...','...WW...','..CYYC..','AARRRRAA'],
    queues: [['white','cyan'],['yellow','orange'],['red','gold']] }),
  makeLevel({ id: 32, title: 'Silver Key', themeId: 'curio-cabinet', difficulty: 'medium',
    art: ['.WWWWW...','.WCCCW...','.WCBBC...','.WCCCW...','.WWWWW...','...W.....','..WWGGGG.','...W.G.G.'],
    queues: [['blue'],['green'],['cyan','white']] }),
  makeLevel({ id: 33, title: 'Music Box', themeId: 'curio-cabinet', difficulty: 'medium',
    art: ['..MMMM...','.MPPPPM..','MPRRRRPM.','MPYAYYPM.','MPOOOOPM.','MPCCCCPM.','.MMMMMM..','..W..W...'],
    queues: [['gold','yellow','white'],['red','orange'],['cyan','purple','magenta']] }),
  makeLevel({ id: 34, title: 'True Compass', themeId: 'curio-cabinet', difficulty: 'medium',
    art: ['...Y.....','..YYY....','.YWBWY...','YWWBWWY..','YYRARAY..','YWWCWWY..','.YWGWY...','..YYY....','...Y.....'],
    queues: [['blue','red','green'],['white'],['yellow','gold','cyan']] }),
  makeLevel({ id: 35, title: 'Keepsake Lantern', themeId: 'curio-cabinet', difficulty: 'medium',
    art: ['...AA....','..AAAA...','..WYYW...','.WYOYYW..','.WYRY YW.'.replace(' ',''),'.WYYYYW..','..CCCCC..','..C..C...'],
    queues: [['red','orange'],['yellow','white','cyan'],['gold']] , modifiers: F(['3,1','4,1']) }),
  makeLevel({ id: 36, title: 'Pocket Watch', themeId: 'curio-cabinet', difficulty: 'medium',
    art: ['...AAA...','..A.AA...','.WWWWWWW.','WWCCCCCWW','WCBYABCWW','WWGGGGGWW','.WWWWWWW.','..NNNNN..','...N.N...'],
    queues: [['blue','gold','indigo'],['cyan','green'],['white','yellow']] }),
  makeLevel({ id: 37, title: 'Snow Globe', themeId: 'curio-cabinet', difficulty: 'medium',
    art: ['..WWWWW..','.WBBBBBW.','WBBCCBBBW','WBCYWYCBW','WBGGGGGBW','.WB...BW.','..WWWWW..','..AAAAA..','.AAAAAAA.'],
    queues: [['yellow','green','gold'],['cyan','blue'],['white']] }),
  makeLevel({ id: 38, title: 'Moonlit Potion', themeId: 'curio-cabinet', difficulty: 'medium',
    art: ['...WWW...','...NWN...','..NNNNN..','..PCCCP..','.PCTLTCP.','.PCGGGCP.','..PPPPP..','...PPP...'],
    queues: [['lime','teal','green'],['cyan','purple'],['white','indigo']], modifiers: F(['3,4','5,4','4,5']) }),
  makeLevel({ id: 39, title: 'Velvet Crown', themeId: 'curio-cabinet', difficulty: 'hard',
    art: ['A..Y.Y..A','AA.YYY.AA','AAAAAAA.A','ARRPKRRAA','ARRPKRRAA','AAMMMMMAA','.AAAAAAA.','..WWWWW..'],
    queues: [['pink','purple','white'],['red','magenta'],['gold','yellow']] }),
  makeLevel({ id: 40, title: 'The Curio Chest', themeId: 'curio-cabinet', difficulty: 'hard',
    art: ['.AAAAAAAA.','ARRRRRRRRA','ARWCCCWCRA','ARWBGBWCRA','ARWBYBWCRA','ARWCCCWCRA','ARRRRRRRRA','AANNNNNAA.','.AAAAAAA..'],
    queues: [['yellow','blue','indigo'],['green','cyan','white'],['red','gold']], modifiers: F(['4,2','3,4','5,4','4,5']) }),

  // WORLD 5 · PRISM WORKS — luminous glass and the Shielded rollout.
  makeLevel({ id: 41, title: 'Glass Seed', themeId: 'prism-works', difficulty: 'medium',
    tutorial: 'Shielded pixels need an extra hit.',
    art: ['....C....','...CCC...','..CTTTC..','.CTGGGTC.','CTGLLLGTC','.CTGGGTC.','..CTTTC..','...CCC...'],
    queues: [['lime'],['green'],['teal','cyan']], modifiers: S(['4,4']) }),
  makeLevel({ id: 42, title: 'Light Bulb', themeId: 'prism-works', difficulty: 'medium',
    art: ['..YYYYY..','.YYWWWYY.','YYWOOOWYY','YWORROWYY','YYWOOOWYY','.YYWWWYY.','..AAAAA..','...AAA...'],
    queues: [['red','orange'],['gold','white'],['yellow']], modifiers: S(['3,3','4,3']) }),
  makeLevel({ id: 43, title: 'Crystal Drop', themeId: 'prism-works', difficulty: 'medium',
    art: ['....C....','...CCC...','..CTTTC..','.CTBBBTC.','CTBNNBTTC','.CTPPPTC.','..CMMMC..','...CCC...'],
    queues: [['indigo','purple','magenta'],['blue','teal'],['cyan']], modifiers: S(['4,3','3,4','5,4']) }),
  makeLevel({ id: 44, title: 'Prism Kite', themeId: 'prism-works', difficulty: 'medium',
    art: ['....W....','...YYY...','..YOOOY..','.ORRRRRO.','RRRPPPRRR','.OPPPPO..','..PBBBP..','...CCC...','....T....'],
    queues: [['purple','teal'],['red','blue'],['white','yellow','orange','cyan']], modifiers: S(['4,4','3,5','5,5']) }),
  makeLevel({ id: 45, title: 'Stained Rose', themeId: 'prism-works', difficulty: 'medium',
    art: ['..G...G..','.GGRRRGG.','GRRKKKRRG','GRKYYYKRG','.RKYAYKR.','GRKYYYKRG','GRRKKKRRG','.GGRRRGG.','..G...G..'],
    queues: [['gold','yellow'],['pink','red'],['green']], modifiers: S(['4,4','2,4','6,4']) }),
  makeLevel({ id: 46, title: 'Neon Mirror', themeId: 'prism-works', difficulty: 'medium',
    art: ['.MMMMMMM.','M.NNNNN.M','M..WWW..M','MNWCCCWNM','MNWCRCWNM','MNWCCCWNM','M..WWW..M','M.NNNNN.M','.MMMMMMM.'],
    queues: [['red','cyan'],['white','indigo'],['magenta']], modifiers: S(['4,4','3,3','5,5','2,1']) }),
  makeLevel({ id: 47, title: 'Sun Catcher', themeId: 'prism-works', difficulty: 'medium',
    art: ['YY..A..YY','.Y..A..Y.','..YAAA Y..'.replace(' ',''),'AAAOYOAAA','..YRRRY..','.Y.PPP.Y.','Y..BBB..Y','...CCC...'],
    queues: [['orange','red','purple'],['blue','cyan'],['yellow','gold']], modifiers: S(['4,3','3,4','5,4','4,5']) }),
  makeLevel({ id: 48, title: 'Spectrum Vase', themeId: 'prism-works', difficulty: 'medium',
    art: ['..WWWWW..','...WWW...','..RRRRR..','.ROOOOOR.','.OYYYYYO.','.YGGGGGY.','.GGGGGGG.','..BBBBB..','...BBB...'],
    queues: [['yellow','green'],['orange','blue'],['white','red']], modifiers: S(['4,4','4,5','4,6','4,7']) }),
  makeLevel({ id: 49, title: 'Aurora Lens', themeId: 'prism-works', difficulty: 'hard',
    art: ['.BBBBBBB.','B.PPPPP.B','P.PPPPP.P','PPRRRRRPP','PPRYYYRPP','PPPOOOPPP','B.PCCCP.B','.BBBBBBB.','...CCC...'],
    queues: [['yellow','red'],['orange','cyan'],['blue','purple']], modifiers: S(['4,3','3,4','5,4','4,5','4,6']) }),
  makeLevel({ id: 50, title: 'The Grand Prism', themeId: 'prism-works', difficulty: 'hard',
    art: ['....W....','...YYY...','..RRRRR..','.PPPPPPP.','BBBBBBBBB','.CCCCCCC.','..YYYYY..','...RRR...','....P....'],
    queues: [['purple','red'],['blue','cyan'],['white','yellow']], modifiers: S(['4,0','3,1','4,2','3,3','4,4','4,5']) }),

  // WORLD 6 · FROSTGLASS FORGE — premium mixed-material objects.
  makeLevel({ id: 51, title: 'Frostglass Bell', themeId: 'frostglass-forge', difficulty: 'medium',
    art: ['...WWW...','..WCCCW..','.WCTTTCW.','WCTGGGTCW','WCGYY YGCW'.replace(' ',''),'WCCAAACCW','.WWWWWWW.','...RRR...'],
    queues: [['yellow','gold','red'],['teal','green'],['white','cyan']], modifiers: MIX(['4,3'],['3,5']) }),
  makeLevel({ id: 52, title: 'Arcane Shears', themeId: 'frostglass-forge', difficulty: 'medium',
    art: ['RRR...BBB','RRR...BBB','.RRR.BBB.','..RRWBB..','..WWWWW.','..GGWYY..','.GGG.YYY.','GG...YYYY'],
    queues: [['white','green'],['yellow','blue'],['red']], modifiers: MIX(['2,2','6,2'],['3,3','5,3']) }),
  makeLevel({ id: 53, title: 'Enchanter Flask', themeId: 'frostglass-forge', difficulty: 'medium',
    art: ['...WWW...','...PCP...','..PPPPP..','.PPPPPPP.','PPPGGGPPP','PPGGGGGPP','.PPYYYPP.','..AAAAA..'],
    queues: [['green','gold'],['purple','yellow'],['white','cyan']], modifiers: MIX(['3,3'],['4,4']) }),
  makeLevel({ id: 54, title: 'Runed Anvil', themeId: 'frostglass-forge', difficulty: 'medium',
    art: ['BBBBBBBBB','BBWWAWWBB','BBBWRWBBB','.BBBABBB.','..BBBBB..','..NNNNN..','..NCCC N..'.replace(' ',''),'..NNNNN..'],
    queues: [['red','gold','cyan'],['white','indigo'],['blue']], modifiers: MIX(['4,1','4,3','4,4'],['3,2','5,2','4,6']) }),
  makeLevel({ id: 55, title: 'Gilded Gear', themeId: 'frostglass-forge', difficulty: 'medium',
    art: ['A..AAA..A','AAAYYYAAA','.YRRRRRY.','AR RWWRRA'.replace(' ',''),'AYRWBRY A'.replace(' ',''),'ARRWWRRAA','.YGGGGGY.','AAAGGGAAA','A..AAA..A'],
    queues: [['blue','white'],['red','green'],['gold','yellow']], modifiers: MIX(['4,4','3,3'],['3,5','4,6']) }),
  makeLevel({ id: 56, title: 'Crystal Hammer', themeId: 'frostglass-forge', difficulty: 'hard',
    art: ['.CCCCCCC.','CBBBBBBBC','CBNNWNNBC','CBNWYW NBC'.replace(' ',''),'CBNNWNNBC','CBBBBBBBC','.CCCCCCC.','...RRR...','...AAA...'],
    queues: [['yellow','white','gold'],['indigo','red'],['cyan','blue']], modifiers: MIX(['4,2','4,3','4,4'],['3,3','5,3','4,5']) }),
  makeLevel({ id: 57, title: 'Frostbound Violin', themeId: 'frostglass-forge', difficulty: 'hard',
    art: ['..AAAAA..','.AARRRAA.','..RRRRR..','..RRRRR..','..PRRRP..','.PPPPPPP.','..PBBBP..','...NNN...','..CC.CC..'],
    queues: [['red','cyan'],['purple','blue'],['gold','indigo']], modifiers: MIX(['4,2','4,6'],['3,3','4,4','3,7']) }),
  makeLevel({ id: 58, title: 'The Rune Engine', themeId: 'frostglass-forge', difficulty: 'hard',
    art: ['.NNNNNNN.','N.BBBBB.N','NBCC.CCBN','NBCWWWCBN','NBCWYWCBN','NBCW.WCBN','NBCC.CCBN','N.BBBBB.N','.NNRRRNN.'],
    queues: [['yellow','white','red'],['cyan','blue'],['indigo']], modifiers: MIX(['4,3','3,4'],['4,4','3,5','5,5']) }),
  makeLevel({ id: 59, title: 'Prismatic Reliquary', themeId: 'frostglass-forge', difficulty: 'hard',
    art: ['.AAAAAAA.','A.RRRRR.A','AR.PPP.RA','ARPBWBPRA','ARPYPYPRA','ARPBWBPRA','AR.PPP.RA','A.RCCC.RA','.AACCCAA.'],
    queues: [['yellow','white','cyan'],['blue','purple'],['gold','red']], modifiers: MIX(['4,2','3,4'],['5,3','4,4']) }),
  makeLevel({ id: 60, title: 'The Frostglass Crown', themeId: 'frostglass-forge', difficulty: 'hard',
    art: ['C..C.C..C','CC.CCC.CC','CCCGGGCCC','CBBAAABBC','CBBBRBBBC','CPPBPBPPC','CPPPPPPPC','.PPAAAPP.','..AAAAA..'],
    queues: [['red','purple'],['gold','green'],['cyan','blue']], modifiers: MIX(['4,3','3,4','4,5'],['2,2','6,2','3,3']) }),
];
