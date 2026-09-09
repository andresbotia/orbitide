import { createGame } from '../createGame';
import { LAUNCH_SPACING, MAX_ACTIVE_CHARGES } from '../concurrency';
import { simulateEpoch, canJoinEpoch, planLaunch } from '../epoch';
import { resolvePass } from '../pass';
import { resolveAction } from '../resolveLaunch';
import { computeStatus } from '../winState';
import type { EpochLaunch, GameState, LevelDefinition, OrbColor } from '../types';

const level = (pixelArt: string[], tunnels: LevelDefinition['tunnels'], holdingCapacity = 3): LevelDefinition => ({
  id: 700, title: 'Concurrency', themeId: 'test', difficulty: 'easy', holdingCapacity, pixelArt, tunnels,
});

/** Build an explicit epoch launch list for unit-testing arbitration directly. */
const launch = (
  color: OrbColor, capacity: number, i: number, launchSequence = i,
): EpochLaunch => ({
  chargeId: `c${launchSequence}`, source: 'tunnel', originId: `tunnel-${i}`, color, capacity,
  insertionTime: i * LAUNCH_SPACING, launchSequence,
});

/** A settle-first launch (fresh epoch, M1 semantics). */
const T = (i: number) => ({ kind: 'tunnel' as const, id: `tunnel-${i}` });
/** A launch fired while charges are still on the rail (joins the epoch). */
const J = (i: number) => ({ kind: 'tunnel' as const, id: `tunnel-${i}`, join: true });

// ── 1 charge: behaviour is exactly M1 ────────────────────────────────────────
describe('one charge', () => {
  const single = level(['WWWWW', 'WWWWW', 'WWWWW', 'WWWWW', 'WWWWW'],
    [[{ color: 'white', capacity: 25 }], [{ color: 'blue', capacity: 1 }], [{ color: 'white', capacity: 3 }]]);

  test('a lone fresh launch resolves identically to the M1 one-pass resolver', () => {
    const state = createGame(single);
    const outcome = resolveAction(state, T(0));
    const m1 = resolvePass(state, state.tunnels[0]!.queue[0]!);
    expect(outcome.pass!.encounters).toEqual(m1.encounters);
    expect(outcome.pass!.charge.capacity).toBe(m1.charge.capacity);
    expect(outcome.state.epoch!.launches).toHaveLength(1);
    expect(outcome.joinedEpoch).toBe(false);
  });

  test('a lone miss takes one lap and parks, exactly like M1', () => {
    const outcome = resolveAction(createGame(single), T(1));
    expect(outcome.pass!.encounters).toEqual([]);
    expect(outcome.heldCharge).toEqual({ id: 'L700-t1-c0', color: 'blue', capacity: 1 });
    expect(outcome.state.holding).toHaveLength(1);
  });
});

// ── 2 charges ───────────────────────────────────────────────────────────────
describe('two charges', () => {
  test('different colours clear their own targets in one shared epoch', () => {
    // Blue on the left edge, red on the right edge — both reachable from the start.
    const base = createGame(level(['B...R', '.....', '.....', '.....', 'B...R'],
      [[{ color: 'blue', capacity: 2 }], [{ color: 'red', capacity: 2 }], [{ color: 'white', capacity: 1 }]]));
    const res = simulateEpoch(base, [launch('blue', 2, 0), launch('red', 2, 1)]);
    expect(res.charges[0]!.encounters.map((e) => e.pixelId).sort())
      .toEqual(['L700-p0-0', 'L700-p0-4']);
    expect(res.charges[1]!.encounters.map((e) => e.pixelId).sort())
      .toEqual(['L700-p4-0', 'L700-p4-4']);
    expect(res.pixels.filter((p) => !p.cleared)).toHaveLength(0);
  });

  test('the same colour cannot double-clear a target; the loser keeps its capacity', () => {
    // One reachable white pixel (top centre), two white charges after it.
    const base = createGame(level(['.W.', '...', '...'],
      [[{ color: 'white', capacity: 1 }], [{ color: 'white', capacity: 1 }], [{ color: 'white', capacity: 1 }]]));
    const res = simulateEpoch(base, [launch('white', 1, 0), launch('white', 1, 1)]);
    expect(res.charges[0]!.encounters.map((e) => e.pixelId)).toEqual(['L700-p1-0']);
    expect(res.charges[0]!.remainingCapacity).toBe(0);
    expect(res.charges[0]!.landed).toBe('consumed');
    expect(res.charges[1]!.encounters).toEqual([]);
    expect(res.charges[1]!.remainingCapacity).toBe(1);
    expect(res.charges[1]!.landed).toBe('holding');
  });

  test('a clear by one charge exposes a target the other reaches in the same epoch', () => {
    const def = level(['RRR', 'RWR', 'RRR'],
      [[{ color: 'red', capacity: 8 }], [{ color: 'white', capacity: 1 }], [{ color: 'white', capacity: 1 }]]);
    const base = createGame(def);
    // White centre is buried at the start.
    const res = simulateEpoch(base, [launch('red', 8, 0), launch('white', 1, 1)]);
    expect(res.charges[0]!.remainingCapacity).toBe(0);
    expect(res.charges[1]!.encounters.map((e) => e.pixelId)).toEqual(['L700-p1-1']);
    expect(res.pixels.every((p) => p.cleared)).toBe(true);
    // and end to end through resolveAction: launch red, then join white → win.
    const state = resolveAction(base, T(0)).state;
    const joined = resolveAction(state, J(1));
    expect(joined.joinedEpoch).toBe(true);
    expect(joined.state.status).toBe('won');
  });
});

// ── target competition timing ───────────────────────────────────────────────
describe('target competition', () => {
  const oneTarget = createGame(level(['.W.', '...', '...'],
    [[{ color: 'white', capacity: 1 }], [{ color: 'white', capacity: 1 }], [{ color: 'white', capacity: 1 }]]));

  test('identical encounter time is broken by launch sequence', () => {
    const a: EpochLaunch = { ...launch('white', 1, 0), insertionTime: 0, launchSequence: 0 };
    const b: EpochLaunch = { ...launch('white', 1, 1), insertionTime: 0, launchSequence: 1 };
    const res = simulateEpoch(oneTarget, [a, b]);
    expect(res.charges[0]!.encounters).toHaveLength(1);
    expect(res.charges[1]!.encounters).toHaveLength(0);
  });

  test('a target cleared before the second charge arrives is simply gone', () => {
    const res = simulateEpoch(oneTarget, [launch('white', 1, 0), launch('white', 3, 1)]);
    expect(res.charges[1]!.encounters).toEqual([]);
    expect(res.charges[1]!.remainingCapacity).toBe(3);
  });
});

// ── 5 charges ───────────────────────────────────────────────────────────────
describe('five charges', () => {
  // A white board with only blue charges: every charge flies a full lap without
  // hitting anything, so all five stay "in the air" across the whole epoch.
  const missBoard = level(
    ['WWWWWWW', 'WWWWWWW', 'WWWWWWW'],
    [
      [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
      [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
      [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
    ],
    8);

  test('up to five launches share one epoch; the sixth opens a fresh one', () => {
    let state = resolveAction(createGame(missBoard), T(0)).state;
    for (const a of [J(1), J(2), J(0), J(1)]) state = resolveAction(state, a).state;
    expect(state.epoch!.launches).toHaveLength(MAX_ACTIVE_CHARGES);
    expect(state.activeCharges).toHaveLength(MAX_ACTIVE_CHARGES);
    expect(canJoinEpoch(state, state.tunnels[2]!.queue[0]!.id)).toBe(false);
    const sixth = resolveAction(state, J(2));
    expect(sixth.joinedEpoch).toBe(false);
    expect(sixth.state.epoch!.launches).toHaveLength(1);
  });

  test('each charge keeps its own capacity and resolves deterministically', () => {
    const wide = level(
      ['WWWWWWWWW', 'WWWWWWWWW', 'WWWWWWWWW', 'WWWWWWWWW', 'WWWWWWWWW'],
      [[{ color: 'white', capacity: 25 }], [{ color: 'white', capacity: 10 }], [{ color: 'white', capacity: 10 }]]);
    const base = createGame(wide);
    const launches = [
      launch('white', 3, 0), launch('white', 4, 1), launch('white', 5, 2),
      launch('white', 3, 3), launch('white', 4, 4),
    ];
    const a = simulateEpoch(base, launches);
    const b = simulateEpoch(base, launches);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const cleared = a.charges.reduce((n, c) => n + (c.capacity - c.remainingCapacity), 0);
    expect(cleared).toBe(a.pixels.filter((p) => p.cleared).length);
    expect(a.charges.map((c) => c.capacity)).toEqual([3, 4, 5, 3, 4]);
    expect(a.charges.map((c) => c.remainingCapacity)).toEqual([0, 0, 0, 0, 0]);
  });
});

// ── Holding interaction ─────────────────────────────────────────────────────
describe('Holding with active charges', () => {
  test('a held charge can be relaunched into a running epoch', () => {
    const def = level(['WW'],
      [[{ color: 'white', capacity: 1 }], [{ color: 'white', capacity: 1 }], [{ color: 'white', capacity: 1 }]]);
    const state: GameState = {
      ...createGame(def),
      holding: [{ id: 'held-w', color: 'white', capacity: 1 }],
    };
    const first = resolveAction(state, T(0)).state; // one tunnel charge, epoch open
    const relaunch = resolveAction(first, { kind: 'holding', id: 'held-w', join: true });
    expect(relaunch.joinedEpoch).toBe(true);
    expect(relaunch.state.epoch!.launches).toHaveLength(2);
    expect(relaunch.state.holding).toHaveLength(0);
    expect(relaunch.state.status).toBe('won');
  });

  test('a charge already in the epoch can never join it a second time', () => {
    const def = level(['WW'],
      [[{ color: 'white', capacity: 1 }, { color: 'white', capacity: 1 }], [], []]);
    const state = resolveAction(createGame(def), T(0)).state;
    expect(canJoinEpoch(state, 'L700-t0-c0')).toBe(false); // the charge that just launched
    expect(canJoinEpoch(state, 'L700-t0-c1')).toBe(true); // a different charge
  });

  test('a full tray plus a still-useful launch is never a loss', () => {
    const def = level(['WW'], [[{ color: 'white', capacity: 2 }], [], []]);
    const state: GameState = {
      ...createGame(def),
      holding: [
        { id: 'h0', color: 'pink', capacity: 1 },
        { id: 'h1', color: 'green', capacity: 1 },
        { id: 'h2', color: 'orange', capacity: 1 },
      ],
    };
    expect(computeStatus(state)).toBe('playing');
    expect(resolveAction(state, T(0)).state.status).toBe('won');
  });
});

// ── win / fail / deadlock ───────────────────────────────────────────────────
describe('win and fail', () => {
  test('the board clears the instant the last pixel goes, even mid-epoch', () => {
    const def = level(['RB'], [
      [{ color: 'red', capacity: 5 }], [{ color: 'blue', capacity: 1 }], [{ color: 'white', capacity: 1 }],
    ]);
    const state = resolveAction(createGame(def), T(0)).state; // red clears its pixel, cap to spare
    const finish = resolveAction(state, J(1)); // blue joins and clears the last pixel
    expect(finish.joinedEpoch).toBe(true);
    expect(finish.state.status).toBe('won');
    // the red charge still had capacity, but the win stands
    expect(finish.state.activeCharges.some((c) => c.color === 'red' && c.remainingCapacity > 0)).toBe(true);
  });

  test('no loss while a tunnel front can still legally progress', () => {
    const def = level(['WB'], [
      [{ color: 'white', capacity: 1 }], [{ color: 'blue', capacity: 1 }], [{ color: 'white', capacity: 1 }],
    ]);
    const state = resolveAction(createGame(def), T(0)).state;
    expect(state.status).toBe('playing');
  });

  test('a true deadlock is still detected under the epoch model', () => {
    const def = level(['WB'], [[{ color: 'white', capacity: 1 }], [], []]);
    const state: GameState = {
      ...createGame(def),
      holding: [{ id: 'h0', color: 'green', capacity: 1 }],
      tunnels: createGame(def).tunnels.map((t) => ({ ...t, queue: [] })),
    };
    expect(computeStatus(state)).toBe('lost');
  });
});

// ── determinism & frame independence ────────────────────────────────────────
describe('determinism', () => {
  const def = level(['WWWW', 'WBWW', 'WWCW', 'WWWW'],
    [
      [{ color: 'white', capacity: 6 }, { color: 'blue', capacity: 1 }],
      [{ color: 'white', capacity: 6 }, { color: 'cyan', capacity: 1 }],
      [{ color: 'white', capacity: 2 }],
    ]);
  const run = () => {
    let state = createGame(def);
    for (const a of [T(0), J(1), J(2), J(0), J(1)]) state = resolveAction(state, a).state;
    return state;
  };

  test('the same action sequence produces a byte-equivalent logical result', () => {
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  test('the engine takes no time input, so presentation frame rate cannot change truth', () => {
    // resolveAction's signature is (state, action) only — there is nowhere for a
    // clock, fps or timestamp to enter. Encounter times are logical lap fractions.
    const base = createGame(def);
    const res = simulateEpoch(base, [launch('white', 6, 0), launch('white', 6, 1)]);
    for (const c of res.charges) {
      for (const e of c.encounters) {
        expect(e.time).toBeGreaterThanOrEqual(0);
        expect(e.time - e.progress).toBeCloseTo(c.insertionTime, 10);
      }
    }
  });
});

// ── planning helper ─────────────────────────────────────────────────────────
test('planLaunch spaces joined insertions by exactly LAUNCH_SPACING', () => {
  const def = level(['WWWWWW', 'WWWWWW', 'WWWWWW'],
    [[{ color: 'white', capacity: 3 }, { color: 'white', capacity: 3 }], [{ color: 'white', capacity: 6 }], [{ color: 'white', capacity: 6 }]]);
  let state = createGame(def);
  state = resolveAction(state, T(0)).state;
  const plan = planLaunch(state, {
    chargeId: state.tunnels[1]!.queue[0]!.id, source: 'tunnel', originId: 'tunnel-1',
    color: 'white', capacity: 6, launchSequence: state.movesApplied,
  }, true);
  expect(plan.joined).toBe(true);
  expect(plan.insertionTime).toBeCloseTo(LAUNCH_SPACING, 10);
  expect(plan.launches.map((l) => l.insertionTime)).toEqual([0, LAUNCH_SPACING]);
});
