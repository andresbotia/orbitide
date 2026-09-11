import type { LevelDefinition } from '../engine/types';
import {
  combineModifiers, frozen, linked, makeM4CLevel as level, shielded,
  ventRows, ventRowsCapped,
} from './m4cLevelFactory';

export const M4C_WORLD_10: LevelDefinition[] = [
  // L91 — Satellite dish: clean Medium opener with Solar wing Linked pair (0,0 ↔ 9,0)
  // and shielded Gold battery, introducing final-world scale under safe 5.5k node cap.
  level({ id: 91, title: 'Signal Satellite', themeId: 'starforge', difficulty: 'medium',
    art: ventRows(['BBB....YYY','BBBB..YYYY','BBBBWWYYYY','...NWWN...','...NCCN...','...NCCN...','..RRNNRR..','.RR.AA.RR','GGG.AA.GGG']),
    queues: [['green','gold','red'],['cyan','indigo'],['white','yellow','blue']],
    modifiers: combineModifiers(linked([['0,0','9,0']]), shielded(['4,8'])) }),

  // L92 — Aurora Rocket: Medium transition with nose cone linked to exhaust plume
  // (4,0 ↔ 2,16) and frozen payload core; scores 21 with 3k nodes.
  level({ id: 92, title: 'Aurora Rocket', themeId: 'starforge', difficulty: 'medium',
    art: ventRows(['...WWW...','..WWWWW..','..WCCCW..','.WCBBBCW.','WCBNNNBCW','WCBRRRBCW','.WBAAABW.','..BYY YB..'.replace(' ',''),'.GGG.GGG.']),
    queues: [['green','yellow','gold'],['red','indigo'],['blue','cyan','white']],
    modifiers: combineModifiers(linked([['4,0','2,16']]), frozen(['4,8'])) }),

  // L93 — Ringed World: Medium planetary silhouette with polar linked pair
  // (3,0 ↔ 6,0) and dual shielded core pixels; scores 23 with 11k nodes.
  level({ id: 93, title: 'Ringed World', themeId: 'starforge', difficulty: 'medium',
    art: ventRows(['...YYYY...','..YAAAAY..','.YANNNNAY.','YYNBBBBNYY','CCBWWWWBCC','TTBCGGBCTT','.TTCCCC TT.'.replace(' ',''),'..RRRRRR..','...PPPP...']),
    queues: [['purple','red','teal'],['green','white','blue'],['indigo','gold','yellow','cyan']],
    modifiers: combineModifiers(linked([['3,0','6,0']]), shielded(['4,8','5,8'])) }),

  // L94 — Lunar Rover: Medium surface rover with 2 linked pairs (roof 2,0 ↔ 7,0;
  // wheels 0,16 ↔ 9,16) and frozen engine; scores 21 with 2.7k nodes.
  level({ id: 94, title: 'Lunar Rover', themeId: 'starforge', difficulty: 'medium',
    art: ventRows(['..WWWWWW..','.WYYYYYYW.','WWCCCCCCWW','WCBNNNNBCW','WCBRRRRBCW','.WBAAAABW.','..BBBBBB..','.NN....NN.','GGG....GGG']),
    queues: [['green','gold','red'],['indigo','blue'],['cyan','yellow','white']],
    modifiers: combineModifiers(linked([['2,0','7,0'],['0,16','9,16']]), frozen(['4,8'])) }),

  // L95 — Nebula Turbine: Hard multi-ring turbine with 73 pixels, 2 linked pairs,
  // and shielded core; deliberate holding pressure.
  level({ id: 95, title: 'Nebula Turbine', themeId: 'starforge', difficulty: 'hard',
    art: ventRows(['N..NNNN..N','NN.PPPP.NN','.NPPCCPPN.','NPCYYYYCPN','NPCYWWYCPN','NPCTTTC P N'.replace(/ /g,''),'.NBBBBBBN.','NN.RRRR.NN','A..AAAA..A']),
    queues: [['gold','red','blue'],['teal','yellow','white'],['cyan','purple','indigo']],
    modifiers: combineModifiers(linked([['0,0','9,0'],['0,16','9,16']]), shielded(['4,8'])) }),

  // L96 — Celestial Compass: Hard dense compass rose synthesizing Frozen (3,4),
  // Linked (4,0 ↔ 4,4), and Shielded (5,4) side-by-side in center needle; score 28, 19k nodes.
  level({ id: 96, title: 'Celestial Compass', themeId: 'starforge', difficulty: 'hard',
    art: ['...YYY...','Y..AAA..Y','YY.BAB.YY','.YYWAWYY.','AAAWWWAAA','.YYCWCYY.','YY.GCG.YY','YY..C..YY','..NNRNN..'],
    queues: [['red','indigo','green'],['blue','cyan','white'],['gold','yellow']],
    modifiers: combineModifiers(linked([['4,0','4,4']]), frozen(['3,4']), shielded(['5,4'])) }),

  // L97 — Orbital Citadel: Hard fortress with 2 linked pairs, frozen battlement,
  // and shielded turret; 72 pixels.
  level({ id: 97, title: 'Orbital Citadel', themeId: 'starforge', difficulty: 'hard',
    art: ventRows(['A..AAAA..A','AA.YYYY.AA','.AYWWWWYA.','AYWCCCCWYA','AYCB BB CYA'.replace(/ /g,''),'AYCN NNCYA'.replace(/ /g,''),'.AYRRRRYA.','AA.PPPP.AA','G..GGGG..G']),
    queues: [['green','purple','red'],['indigo','blue','cyan'],['white','yellow','gold']],
    modifiers: combineModifiers(linked([['0,0','9,0'],['0,16','9,16']]), frozen(['4,6']), shielded(['5,6'])) }),

  // L98 — Helios Engine: Hard late pinnacle with 78 pixels, 2 linked pairs,
  // 2 frozen cells, 2 shielded cells, and 2 held launches; score 28, 27k nodes.
  level({ id: 98, title: 'Helios Engine', themeId: 'starforge', difficulty: 'hard',
    art: ventRows(['Y..YYYY..Y','YY.AAAA.YY','YAAWWWWAAY','YAWCCCCWAY','YACBBBB CAY'.replace(' ',''),'YACBRRBCAY','YAATTTTAAY','YY.NNNN.YY','P..PPPP..P']),
    queues: [['purple','indigo','teal'],['red','blue','cyan'],['white','gold','yellow']],
    modifiers: combineModifiers(linked([['0,0','9,0'],['0,16','9,16']]), frozen(['4,8','5,8']), shielded(['4,10','5,10'])) }),

  // L99 — Galactic Core: Hard penultimate trial with 76 pixels, 2 linked pairs,
  // frozen and shielded inner core; score 22, 6.7k nodes.
  level({ id: 99, title: 'Galactic Core', themeId: 'starforge', difficulty: 'hard',
    art: ventRows(['P..PPPP..P','PP.NNNN.PP','PNBBBBBBNP','PNBCC CBNP'.replace(' ',''),'PNBCWWCBNP','PNBCYYCBNP','PNBCC CBNP'.replace(' ',''),'PP.RRRR.PP','A..AAAA..A']),
    queues: [['gold','red','yellow'],['white','cyan','blue'],['indigo','purple']],
    modifiers: combineModifiers(linked([['0,0','9,0'],['0,16','9,16']]), frozen(['4,8']), shielded(['5,8'])) }),

  // L100 — The Starforge: Monumental 90-pixel Hard campaign finale synthesizing all 3 mechanics
  // (3 Linked pairs, 2 Frozen, 2 Shielded) across different functional zones of the cosmic forge.
  level({ id: 100, title: 'The Starforge', themeId: 'starforge', difficulty: 'hard',
    art: ventRowsCapped(['A..AAAA..A','.AYYYYYYA.','AYWWWWWWYA','AYWCCCCWYA','AYWCBBBWYA','AYWCRRCWYA','AYWCCC CWYA'.replace(' ',''),'AYWNNNNWYA','AAPPPPPPAA','A..AAAA..A']),
    queues: [['cyan','red'],['purple','indigo','blue'],['white','yellow','gold']],
    modifiers: combineModifiers(
      linked([['0,0','9,0'],['2,15','7,15'],['0,16','9,16']]),
      frozen(['3,6','6,6']),
      shielded(['4,10','5,10']),
    ) }),
];
