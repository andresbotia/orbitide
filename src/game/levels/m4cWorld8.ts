import type { LevelDefinition } from '../engine/types';
import { aerate, linked, makeM4CLevel as level, ventRows } from './m4cLevelFactory';

export const M4C_WORLD_8: LevelDefinition[] = [
  // L71 — tutorial: keep ventRows so all pixels are immediately visible during teaching.
  level({ id: 71, title: 'Twin Diving Bell', themeId: 'tidal-depths', difficulty: 'easy',
    tutorial: 'Linked pixels clear together — activate both.',
    art: ventRows(['..AAAAA..','.AWWWWYA.','AWWCCCYYA','AWCBBBCYA','AWCBTBCYA','AWCTTTCYA','.AWWWWYA.','..RRRRR..','...R.R...']),
    queues: [['red','teal'],['blue','cyan'],['white','yellow','gold']],
    modifiers: linked([['2,0','6,0']]) }),

  // L72 — dense (no ventRows): manta silhouette exposes outer blue wings first;
  // inner teal/green core and tail (gold/red) peel inward, creating exposure depth.
  level({ id: 72, title: 'Azure Manta', themeId: 'tidal-depths', difficulty: 'medium',
    art: ['BB......BB','BBB....BBB','BBBBCCBBBB','.BBCTTCBB.','..CTGGTC..','...TYYT...','...RRRR...','...AAA....'],
    queues: [['gold','red'],['yellow','green','teal'],['cyan','blue']],
    modifiers: linked([['0,0','9,0']]) }),

  // L73 — aerate preserves the crown silhouette with inward-peel exposure.
  level({ id: 73, title: 'Coral Crown', themeId: 'tidal-depths', difficulty: 'medium',
    art: aerate(['D..D.D..D','DD.DDD.DD','DDDDDDDDD','.DDWWWDD.','..WAAAW..','.WATTAW.','WWTBBBTWW','.CCCCCCC.','..GGGGG..']),
    queues: [['green','cyan','blue'],['teal','gold','white'],['coral']],
    modifiers: linked([['0,0','16,0']]) }),

  // L74 — dense (no ventRows): submarine hull (indigo) buries cyan body, teal/green engine.
  // Yellow periscope fires before white interior (queue fix: yellow before white).
  // Linked pair: both periscope tips (top Y ↔ bottom Y) clear together.
  level({ id: 74, title: 'Pocket Submarine', themeId: 'tidal-depths', difficulty: 'medium',
    art: ['....YYY...','...YWWY...','..NNNNNN..','.NCCCCCCN.','NNCTTTTCNN','NNCGGGGCNN','.NNNNNNNN.','...BBBB...','....Y.....'],
    queues: [['blue','indigo'],['green','teal'],['cyan','yellow','white']],
    modifiers: linked([['4,0','4,8']]) }),

  // L75 — dense (no ventRows): angler fish with bioluminescent lure (yellow tip) linked
  // cross-color to cyan base — two separate body regions that resolve together.
  level({ id: 75, title: 'Lantern Angler', themeId: 'tidal-depths', difficulty: 'medium',
    art: ['......Y..', '.....YYY.','....Y.YY.','..BBBBB..','.BNNNNNB.','BNPWWWPNB','BNPRRRPBN','.BPPPPPB.','..CCCCC..'],
    queues: [['cyan','purple','red'],['white','indigo'],['blue','yellow']],
    modifiers: linked([['6,0','4,8']]) }),

  // L76 — dense (no ventRows): turtle shell (green) peels to reveal lime, teal, yellow,
  // white, cyan, blue layers. Outer green pair links the two top shell scutes.
  level({ id: 76, title: 'Emerald Sea Turtle', themeId: 'tidal-depths', difficulty: 'medium',
    art: ['...GGGG...','..GLLLLG..','.GLTTTTLG.','GLTYYYYTLG','GLYWWWWYLG','.GLCCCCLG.','..GBBBBG..','...G..G...','..BB..BB..'],
    queues: [['blue','cyan'],['white','yellow'],['teal','lime','green']],
    modifiers: linked([['3,0','6,0']]) }),

  // L77 — dense (no ventRows): pearl oyster with purple outer shell exposed first,
  // yellow nacre at base. Queue reordered so purple (outer, accessible) leads its tunnel.
  level({ id: 77, title: 'Moon Pearl Oyster', themeId: 'tidal-depths', difficulty: 'medium',
    art: ['..PPPPP..','.PBBBBBP.','PBNNNNNBP','PBCWWWCBP','PBCWYWCBP','.PCTTTCP.','..PTTTP..','...YYY...'],
    queues: [['yellow','teal'],['white','cyan'],['purple','blue','indigo']],
    modifiers: linked([['2,0','6,0']]) }),

  // L78 — keep ventRows: dense board causes solver node explosion (>100k).
  level({ id: 78, title: 'Crimson Kraken', themeId: 'tidal-depths', difficulty: 'medium',
    art: ventRows(['...RRRR...','..RDDDDR..','.RDDOODDR.','RDDYYYYDDR','RDYWWWWYDR','.RDDOODDR.','..RPPPR...','.RR.P.RR..','RR..B..RR.']),
    queues: [['blue','purple'],['white','yellow','orange'],['coral','red']],
    modifiers: linked([['3,0','6,0'],['0,16','8,16']]) }),

  // L79 — dense (no ventRows): layered helm — yellow outer ring, white+indigo mid,
  // cyan body, teal/green/blue deep core. Authored queues preserved exactly: inner colors
  // come first in each tunnel, forcing the solver to plan deep exposure before it can
  // peel inward. Score 61 / Hard, held=3, peak=2, failPath=3.
  level({ id: 79, title: 'Sunken Admiral Helm', themeId: 'tidal-depths', difficulty: 'hard',
    art: ['..YYYYYY..', '.YYYYYYYY.','YYWWNNWWYY','YYWNNNNWYY','YYNCCCCNYY','.YNTTTTNY.','..NGGGGN..','..NBBBBN..','.NNNNNNNN.'],
    queues: [['blue','green'],['teal','cyan','indigo'],['white','yellow']],
    modifiers: linked([['2,0','7,0'],['1,8','8,8']]) }),

  // L80 — dense 10-row art (ventRows removed): gate arch with solid bottom foundation.
  // Bottom rows filled (no gaps) so blue core is only accessible after cyan+teal peel.
  // Cyan is the only accessible first-move, forcing a strict outer→inner solve order.
  // Three linked pairs mark the gate's structural symmetry (top arch, base, center arch).
  level({ id: 80, title: 'The Leviathan Gate', themeId: 'tidal-depths', difficulty: 'hard',
    art: ['C..C..C..C','C..CCCC..C','.CTTTTTTC.','CTGLLLLGT.','.TGLYYLGT.','.TGLYYLGT.','.TGLLLLGT.','CCTBBBBTCC','CCNNNNNNCC','NNNNNNNNNN'],
    queues: [['blue','indigo'],['lime','yellow'],['cyan','teal','green']],
    modifiers: linked([['0,0','9,0'],['0,9','9,9'],['3,2','7,2']]) }),
];
