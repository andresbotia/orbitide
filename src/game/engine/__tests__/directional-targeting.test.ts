import { LAUNCH_SPACING, MAX_ACTIVE_CHARGES } from '../concurrency';
import { createGame } from '../createGame';
import { listAttackBins, pickDirectionalEncounter } from '../directionalTargeting';
import { simulateEpoch } from '../epoch';
import { iceLayers, shieldLayers } from '../frozen';
import { firstOccupiedOnRay } from '../gridRay';
import { isLinkedPrimed } from '../linked';
import { resolvePass } from '../pass';
import { resolveAction } from '../resolveLaunch';
import { resolveHoldingLaunch } from '../resolveHolding';
import type { EpochLaunch, LevelDefinition, OrbColor } from '../types';

const v2 = (
  pixelArt: string[],
  tunnels: LevelDefinition['tunnels'],
  extra: Partial<LevelDefinition> = {},
): LevelDefinition => {
  const queues = [...(extra.tunnels ?? tunnels)];
  while (queues.length < 4) queues.push([]);
  return {
    id: extra.id ?? 8210,
    title: extra.title ?? 'CoreV2',
    themeId: 'test',
    difficulty: 'easy',
    holdingCapacity: extra.holdingCapacity ?? 4,
    pixelArt,
    ...extra,
    tunnels: queues,
    ruleset: extra.ruleset ?? 'coreV2',
  };
};

const T = (i: number) => ({ kind: 'tunnel' as const, id: `tunnel-${i}` });
const J = (i: number) => ({ kind: 'tunnel' as const, id: `tunnel-${i}`, join: true });

const raw = (color: OrbColor, capacity: number, i: number, seq = i): EpochLaunch => ({
  chargeId: `c${seq}`, source: 'tunnel', originId: `tunnel-${i}`, color, capacity,
  insertionTime: i * LAUNCH_SPACING, launchSequence: seq,
});

const emptyTunnels = (front: { color: OrbColor; capacity: number }): LevelDefinition['tunnels'] => [
  [front], [], [],
];

describe('grid DDA', () => {
  const occ = (...cells: [number, number][]) => {
    const set = new Set(cells.map(([x, y]) => `${x},${y}`));
    return (x: number, y: number) => set.has(`${x},${y}`);
  };

  test('skips empty cells and returns the first occupied', () => {
    expect(firstOccupiedOnRay({ x: 1.5, y: 4 }, { x: 0, y: -1 }, 3, 4, occ([1, 0]))).toEqual({ x: 1, y: 0 });
    expect(firstOccupiedOnRay({ x: 1.5, y: 4 }, { x: 0, y: -1 }, 3, 4, occ([1, 2], [1, 0]))).toEqual({ x: 1, y: 2 });
  });

  test('does not skip to a cell behind the first occupied', () => {
    expect(firstOccupiedOnRay({ x: 1.5, y: 5 }, { x: 0, y: -1 }, 3, 5, occ([1, 3], [1, 1]))).toEqual({ x: 1, y: 3 });
  });

  test('returns null when the ray exits without a hit', () => {
    expect(firstOccupiedOnRay({ x: 1.5, y: 3 }, { x: 0, y: -1 }, 3, 3, occ([0, 0]))).toBeNull();
  });

  test('corner tie steps X first (horizontal neighbour, then diagonal; not the vertical neighbour)', () => {
    // From the origin through a grid corner: (0,0) → X to (1,0) → Y to (1,1).
    expect(firstOccupiedOnRay({ x: 0, y: 0 }, { x: 1, y: 1 }, 3, 3, occ([1, 0], [0, 1]))).toEqual({ x: 1, y: 0 });
    expect(firstOccupiedOnRay({ x: 0, y: 0 }, { x: 1, y: 1 }, 3, 3, occ([0, 1]))).toBeNull();
    expect(firstOccupiedOnRay({ x: 0, y: 0 }, { x: 1, y: 1 }, 3, 3, occ([1, 1]))).toEqual({ x: 1, y: 1 });
  });
});

describe('basic first-hit targeting', () => {
  test('matching front cell: one hit, capacity -1', () => {
    const state = createGame(v2(['R'], emptyTunnels({ color: 'red', capacity: 2 })));
    const pass = resolvePass(state, { id: 'c', color: 'red', capacity: 2 });
    expect(pass.encounters).toHaveLength(1);
    expect(pass.encounters[0]!.pixelId).toBe('L8210-p0-0');
    expect(pass.charge.capacity).toBe(1);
  });

  test('wrong-color front cell blocks; rear matching pixel is untouched', () => {
    const def = v2(['BBB', 'BRB', 'BBB'], emptyTunnels({ color: 'red', capacity: 3 }));
    const state = createGame(def);
    const pass = resolvePass(state, { id: 'c', color: 'red', capacity: 3 });
    expect(pass.encounters).toEqual([]);
    expect(pass.charge.capacity).toBe(3);
    expect(state.pixels.find((p) => p.id === 'L8210-p1-1')!.cleared).toBe(false);
    expect(pass.state.pixels.find((p) => p.color === 'red' && !p.cleared)).toBeTruthy();
  });

  test('empty cells do not block a matching pixel behind them', () => {
    const def = v2(['.R.', '...', '...'], emptyTunnels({ color: 'red', capacity: 1 }));
    const pass = resolvePass(createGame(def), { id: 'c', color: 'red', capacity: 1 });
    expect(pass.encounters.map((e) => e.pixelId)).toEqual(['L8210-p1-0']);
    expect(pass.charge.capacity).toBe(0);
  });
});

describe('no drill-through', () => {
  const stacked = v2(
    ['BBB', 'BRB', 'BRB'],
    emptyTunnels({ color: 'red', capacity: 2 }),
    { id: 8211 },
  );

  test('one attack line hits the front red only; the rear red remains', () => {
    const pass = resolvePass(createGame(stacked), { id: 'c', color: 'red', capacity: 2 });
    expect(pass.encounters.map((e) => e.pixelId)).toEqual(['L8211-p1-2']);
    expect(pass.state.pixels.find((p) => p.id === 'L8211-p1-1')!.cleared).toBe(false);
    expect(pass.charge.capacity).toBe(1);
    expect(pass.progress).toBe(1);
  });

  test('relaunch on a later pass may hit the newly exposed rear red', () => {
    const first = resolveAction(createGame(stacked), T(0));
    expect(first.heldCharge).toEqual({ id: 'L8211-t0-c0', color: 'red', capacity: 1 });
    expect(first.state.pixels.find((p) => p.id === 'L8211-p1-1')!.cleared).toBe(false);
    const relaunch = resolveHoldingLaunch(first.state, first.heldCharge!.id);
    expect(relaunch.accepted).toBe(true);
    expect(relaunch.pass!.encounters.map((e) => e.pixelId)).toEqual(['L8211-p1-1']);
    expect(relaunch.state.pixels.find((p) => p.id === 'L8211-p1-1')!.cleared).toBe(true);
  });
});

describe('wrong-color occlusion after mutation', () => {
  test('after the front red clears, blue becomes first occupied on that line', () => {
    const def = v2(
      ['BBB', 'BRB', 'BBB', 'BRB'],
      emptyTunnels({ color: 'red', capacity: 3 }),
      { id: 8212 },
    );
    const pass = resolvePass(createGame(def), { id: 'c', color: 'red', capacity: 3 });
    expect(pass.encounters.map((e) => e.pixelId)).toEqual(['L8212-p1-3']);
    expect(pass.state.pixels.find((p) => p.id === 'L8212-p1-1')!.cleared).toBe(false);
    expect(pass.state.pixels.find((p) => p.id === 'L8212-p1-2')!.cleared).toBe(false);
    expect(pass.charge.capacity).toBe(2);
  });
});

describe('Frozen / Shielded', () => {
  test('matching Frozen front: one layer, same bin does not immediately re-hit', () => {
    const def = v2(
      ['BBB', 'BWB'],
      emptyTunnels({ color: 'white', capacity: 2 }),
      { id: 8213, modifiers: { '1,1': { kind: 'frozen', level: 1 } } },
    );
    const first = resolveAction(createGame(def), T(0));
    const frozen = first.state.pixels.find((p) => p.id === 'L8213-p1-1')!;
    expect(first.pass!.encounters).toHaveLength(1);
    expect(first.pass!.encounters[0]!.frozenBreak).toBe(true);
    expect(frozen.cleared).toBe(false);
    expect(iceLayers(frozen)).toBe(0);
    expect(first.heldCharge?.capacity).toBe(1);
    const relaunch = resolveHoldingLaunch(first.state, first.heldCharge!.id);
    expect(relaunch.pass!.encounters[0]!.frozenBreak).toBeFalsy();
    expect(relaunch.state.pixels.find((p) => p.id === 'L8213-p1-1')!.cleared).toBe(true);
  });

  test('matching Shielded front: one layer, cell still blocks the same bin', () => {
    const def = v2(
      ['BBB', 'BWB'],
      emptyTunnels({ color: 'white', capacity: 2 }),
      { id: 8214, modifiers: { '1,1': { kind: 'shielded', level: 1 } } },
    );
    const first = resolveAction(createGame(def), T(0));
    const cell = first.state.pixels.find((p) => p.id === 'L8214-p1-1')!;
    expect(first.pass!.encounters[0]!.shieldBreak).toBe(true);
    expect(cell.cleared).toBe(false);
    expect(shieldLayers(cell)).toBe(0);
    expect(first.heldCharge?.capacity).toBe(1);
  });
});

describe('primed Linked blocker', () => {
  test('a primed Linked member stays occupied and is not skipped', () => {
    const def = v2(
      ['RBB', 'BGB', 'BRB'],
      [[{ color: 'red', capacity: 1 }], [{ color: 'green', capacity: 1 }], []],
      {
        id: 8215,
        modifiers: {
          '0,0': { kind: 'linked', group: 'pair' },
          '1,2': { kind: 'linked', group: 'pair' },
        },
      },
    );
    const primed = resolveAction(createGame(def), T(0)).state;
    const front = primed.pixels.find((p) => p.id === 'L8215-p1-2')!;
    expect(isLinkedPrimed(front)).toBe(true);
    expect(front.cleared).toBe(false);
    const green = resolveAction(primed, T(1));
    expect(green.pass!.encounters.filter((e) => e.pixelId === 'L8215-p1-1')).toEqual([]);
    expect(green.state.pixels.find((p) => p.id === 'L8215-p1-1')!.cleared).toBe(false);
  });
});

describe('rectangular boards', () => {
  test('square, wide, and tall boards all hit the first occupied matching cell', () => {
    const square = resolvePass(
      createGame(v2(['.R.', '...', '...'], emptyTunnels({ color: 'red', capacity: 1 }), { id: 8216 })),
      { id: 'c', color: 'red', capacity: 1 },
    );
    expect(square.encounters.map((e) => e.pixelId)).toEqual(['L8216-p1-0']);

    const wide = resolvePass(
      createGame(v2(['....R'], emptyTunnels({ color: 'red', capacity: 1 }), { id: 8217 })),
      { id: 'c', color: 'red', capacity: 1 },
    );
    expect(wide.encounters.map((e) => e.pixelId)).toEqual(['L8217-p4-0']);
    expect(wide.encounters[0]!.progress).toBeGreaterThan(0);

    const tall = resolvePass(
      createGame(v2(['R', '.', '.', '.', '.'], emptyTunnels({ color: 'red', capacity: 1 }), { id: 8218 })),
      { id: 'c', color: 'red', capacity: 1 },
    );
    expect(tall.encounters.map((e) => e.pixelId)).toEqual(['L8218-p0-0']);
  });
});

describe('corner ray', () => {
  test('a top-right pixel is selected deterministically from a rounded-corner / edge line', () => {
    const def = v2(
      ['..R', '...', '...'],
      emptyTunnels({ color: 'red', capacity: 1 }),
      { id: 8219 },
    );
    const a = resolvePass(createGame(def), { id: 'c', color: 'red', capacity: 1 });
    const b = resolvePass(createGame(def), { id: 'c', color: 'red', capacity: 1 });
    expect(a.encounters).toEqual(b.encounters);
    expect(a.encounters.map((e) => e.pixelId)).toEqual(['L8219-p2-0']);
    expect(a.encounters[0]!.binId).toBeDefined();
  });
});

describe('concurrency', () => {
  const stacked = v2(
    ['BBB', 'BRB', 'BRB'],
    [
      [{ color: 'red', capacity: 2 }],
      [{ color: 'red', capacity: 2 }],
      [],
    ],
    { id: 8220 },
  );

  test('same-line race: winner takes the front; loser does not chain to the rear', () => {
    const base = createGame(stacked);
    const a: EpochLaunch = {
      chargeId: 'c0', source: 'tunnel', originId: 'tunnel-0', color: 'red', capacity: 2,
      insertionTime: 0, launchSequence: 0,
    };
    const b: EpochLaunch = {
      chargeId: 'c1', source: 'tunnel', originId: 'tunnel-1', color: 'red', capacity: 2,
      insertionTime: 0, launchSequence: 1,
    };
    const res = simulateEpoch(base, [a, b]);
    expect(res.charges[0]!.encounters.map((e) => e.pixelId)).toEqual(['L8220-p1-2']);
    expect(res.charges[1]!.encounters.map((e) => e.pixelId)).toEqual([]);
    expect(res.charges[1]!.remainingCapacity).toBe(2);
    expect(res.pixels.find((p) => p.id === 'L8220-p1-1')!.cleared).toBe(false);
  });

  test('different-line: two colours on different columns both resolve in one epoch', () => {
    const def = v2(
      ['R.B'],
      [[{ color: 'red', capacity: 1 }], [{ color: 'blue', capacity: 1 }], []],
      { id: 8221 },
    );
    const base = createGame(def);
    const res = simulateEpoch(base, [raw('red', 1, 0), raw('blue', 1, 1)]);
    expect(res.charges[0]!.encounters.map((e) => e.pixelId)).toEqual(['L8221-p0-0']);
    expect(res.charges[1]!.encounters.map((e) => e.pixelId)).toEqual(['L8221-p2-0']);
    expect(res.pixels.every((p) => p.cleared)).toBe(true);
    const joined = resolveAction(resolveAction(base, T(0)).state, J(1));
    expect(joined.joinedEpoch).toBe(true);
    expect(joined.state.status).toBe('won');
  });

  test('five charges still share one epoch under Core V2', () => {
    const def = v2(
      ['WWW', 'WWW', 'WWW'],
      [
        [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
        [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
        [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
      ],
      { id: 8222, holdingCapacity: 8 },
    );
    let state = resolveAction(createGame(def), T(0)).state;
    for (const a of [J(1), J(2), J(0), J(1)]) state = resolveAction(state, a).state;
    expect(state.epoch!.launches).toHaveLength(MAX_ACTIVE_CHARGES);
    expect(state.activeCharges).toHaveLength(MAX_ACTIVE_CHARGES);
    const sixth = resolveAction(state, J(2));
    expect(sixth.accepted).toBe(false);
    expect(sixth.rejection).toBe('activeSlotsFull');
    expect(sixth.joinedEpoch).toBeUndefined();
  });
});

describe('Legacy V1 compatibility', () => {
  test('omitted ruleset is legacyV1 and still immediately chains same-ray pixels', () => {
    const def: LevelDefinition = {
      id: 8223, title: 'Legacy', themeId: 'test', difficulty: 'easy', holdingCapacity: 3,
      pixelArt: ['WWWWW', 'WWWWW', 'WWWWW', 'WWWWW', 'WWWWW'],
      tunnels: [[{ color: 'white', capacity: 3 }], [], []],
    };
    const state = createGame(def);
    expect(state.ruleset).toBe('legacyV1');
    const pass = resolvePass(state, { id: 'c', color: 'white', capacity: 3 });
    expect(pass.encounters.map((e) => e.pixelId)).toEqual(['L8223-p2-4', 'L8223-p2-3', 'L8223-p2-2']);
    expect(pass.encounters.map((e) => e.progress)).toEqual([0, 0, 0]);
  });

  test('explicit legacyV1 keeps immediate four-compass clear; coreV2 does not', () => {
    const art = ['.W.', 'W.W', '.W.'];
    const tunnels: LevelDefinition['tunnels'] = [[{ color: 'white', capacity: 4 }], [], []];
    const legacy = resolvePass(
      createGame({
        id: 8224, title: 'L', themeId: 'test', difficulty: 'easy', holdingCapacity: 3,
        pixelArt: art, tunnels, ruleset: 'legacyV1',
      }),
      { id: 'c', color: 'white', capacity: 4 },
    );
    expect(legacy.encounters).toHaveLength(4);
    expect(legacy.encounters.map((e) => e.progress)).toEqual([0, 0, 0, 0]);

    const core = resolvePass(
      createGame(v2(art, tunnels, { id: 8225 })),
      { id: 'c', color: 'white', capacity: 4 },
    );
    expect(core.encounters.length).toBeGreaterThan(0);
    expect(core.encounters.some((e) => e.progress > 0)).toBe(true);
    expect(new Set(core.encounters.map((e) => e.binId)).size).toBe(core.encounters.length);
  });
});

describe('determinism', () => {
  test('same level, ruleset, and launches reproduce encounters exactly', () => {
    const def = v2(
      ['R.B', '.R.', 'B.R'],
      [[{ color: 'red', capacity: 4 }], [{ color: 'blue', capacity: 4 }], []],
      { id: 8226 },
    );
    const base = createGame(def);
    const launches = [raw('red', 4, 0), raw('blue', 4, 1)];
    expect(JSON.stringify(simulateEpoch(base, launches)))
      .toBe(JSON.stringify(simulateEpoch(base, launches)));
  });

  test('attack bins are finite, ordered, and start at bottom-center', () => {
    const bins = listAttackBins(5, 3);
    expect(bins.length).toBeGreaterThan(0);
    expect(bins.every((b, i) => i === 0 || b.passProgress >= bins[i - 1]!.passProgress)).toBe(true);
    const firstBottom = bins.find((b) => b.id.startsWith('b:'));
    expect(firstBottom).toBeDefined();
    const center = bins.find((b) => b.id === 'b:2');
    expect(center!.passProgress).toBeCloseTo(0, 8);
  });

  test('directional pick uses the next unused bin ahead of pass progress', () => {
    const state = createGame(v2(['.R.', '...', '...'], emptyTunnels({ color: 'red', capacity: 1 }), { id: 8227 }));
    const hit = pickDirectionalEncounter(state, 'red', 0, new Set());
    expect(hit?.pixelId).toBe('L8227-p1-0');
    expect(hit?.binId).toBeDefined();
    const again = pickDirectionalEncounter(state, 'red', 0, new Set([hit!.binId]));
    expect(again?.binId).not.toBe(hit!.binId);
  });
});
