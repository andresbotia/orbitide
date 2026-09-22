/**
 * FIRST LAUNCHED, FIRST SERVED — the engine guarantee.
 *
 *   A later Pal may participate in future gameplay, but it may never rewrite
 *   the logical history of an earlier Pal.
 *
 * Formally, the epoch is **idempotent under extension**: for any launch list
 * `L` and any admissible next launch `x`, simulating `[...L, x]` must reproduce
 * every charge of `L` exactly as simulating `L` did — same encounters, same
 * order, same progresses, same remaining capacity, same modifier transitions.
 *
 * That is stronger than "the presented prefix survives", and deliberately so:
 * it holds no matter how much of the earlier Pal the player has actually seen,
 * which is what keeps the outcome independent of tap cadence. See
 * `LAUNCH_SPACING` in concurrency.ts for why one lap of spacing produces it.
 *
 * Holding, terminals and overflow are NOT frozen here — a Pal still in flight
 * has not shown its landing yet, so a join may still change where it parks or
 * reject it outright. That case is pinned at the bottom.
 */
import { LAUNCH_SPACING } from '../concurrency';
import { resolveArrival } from '../holdingArrival';
import { createGame } from '../createGame';
import { simulateEpoch } from '../epoch';
import { resolveAction } from '../resolveLaunch';
import type { ActiveCharge, EpochLaunch, GameState, LevelDefinition, OrbColor } from '../types';

const lvl = (
  id: number, pixelArt: string[], tunnels: LevelDefinition['tunnels'],
  extra: Partial<LevelDefinition> = {},
): LevelDefinition => ({
  id, title: `fixture-${id}`, themeId: 'test', difficulty: 'easy',
  holdingCapacity: 3, ruleset: 'coreV2', pixelArt, tunnels, ...extra,
});

const launch = (color: OrbColor, capacity: number, i: number): EpochLaunch => ({
  chargeId: `c${i}`, source: 'tunnel', originId: `tunnel-${i}`, color, capacity,
  insertionTime: i * LAUNCH_SPACING, launchSequence: i,
});

/** The observable history of one charge: everything a player can be shown. */
function history(c: ActiveCharge) {
  return {
    encounters: c.encounters.map((e) => ({
      pixelId: e.pixelId, progress: e.progress, remaining: e.remaining,
      frozenBreak: e.frozenBreak ?? false, shieldBreak: e.shieldBreak ?? false,
      linkedPrime: e.linkedPrime ?? false, linkedGroupClear: e.linkedGroupClear ?? false,
    })),
    remainingCapacity: c.remainingCapacity,
  };
}

/**
 * The core assertion: adding launches one at a time never disturbs the charges
 * already in the list. Returns each step's resolutions for per-case checks.
 */
function expectIdempotentUnderExtension(
  baseline: GameState, launches: EpochLaunch[],
): ActiveCharge[][] {
  const steps: ActiveCharge[][] = [];
  for (let n = 1; n <= launches.length; n += 1) {
    steps.push(simulateEpoch(baseline, launches.slice(0, n)).charges);
  }
  for (let n = 1; n < steps.length; n += 1) {
    const before = steps[n - 1]!;
    const after = steps[n]!;
    for (let i = 0; i < before.length; i += 1) {
      expect({ join: n, charge: i, ...history(after[i]!) })
        .toEqual({ join: n, charge: i, ...history(before[i]!) });
    }
  }
  return steps;
}

// ── A/B · the synthetic case that motivated the rule ────────────────────────

/**
 * Board `BWY / YBB / BYY`. Alone, blue4 hits p0-2, p0-0, p2-1 and parks with 1
 * (blue p1-1 is hidden behind yellow p1-2). Under the OLD 0.18 spacing a later
 * yellow2 cleared p1-2 and inserted a blue hit at progress 0.25 — behind a Pal
 * the player was already watching at 0.398.
 */
const RETRO = lvl(9720, ['BWY', 'YBB', 'BYY'], [
  [{ color: 'blue', capacity: 4 }], [{ color: 'yellow', capacity: 2 }],
  [{ color: 'white', capacity: 1 }],
]);

test('A · a join never alters the earlier Pal, whenever it arrives', () => {
  const steps = expectIdempotentUnderExtension(createGame(RETRO), [
    launch('blue', 4, 0), launch('yellow', 2, 1),
  ]);
  // Pinned explicitly so a regression cannot "pass" by changing both sides.
  expect(steps[0]![0]!.encounters.map((e) => e.pixelId))
    .toEqual(['L9720-p0-2', 'L9720-p0-0', 'L9720-p2-1']);
  expect(steps[0]![0]!.remainingCapacity).toBe(1);
  expect(steps[1]![0]!.encounters.map((e) => e.pixelId))
    .toEqual(['L9720-p0-2', 'L9720-p0-0', 'L9720-p2-1']);
  expect(steps[1]![0]!.remainingCapacity).toBe(1);
});

test('B · no hit is ever inserted behind an earlier Pal', () => {
  const joined = simulateEpoch(createGame(RETRO), [
    launch('blue', 4, 0), launch('yellow', 2, 1),
  ]).charges;
  const blue = joined[0]!;
  // The old bug inserted p1-1 at progress 0.25, between hits at 0.05 and 0.303.
  expect(blue.encounters.map((e) => e.pixelId)).not.toContain('L9720-p1-1');
  const progresses = blue.encounters.map((e) => e.progress);
  expect([...progresses].sort((a, b) => a - b)).toEqual(progresses);
});

test('C · an earlier Pal with several hits keeps every one of them', () => {
  const base = createGame(lvl(9941, ['BBBB', 'BYYB', 'BYYB', 'BBBB'], [
    [{ color: 'blue', capacity: 12 }], [{ color: 'yellow', capacity: 4 }],
    [{ color: 'blue', capacity: 1 }],
  ]));
  const steps = expectIdempotentUnderExtension(base, [
    launch('blue', 12, 0), launch('yellow', 4, 1),
  ]);
  expect(steps[0]![0]!.encounters.length).toBeGreaterThan(1);
});

test('D · two earlier Pals at different frontiers both keep their histories', () => {
  // Same board as A/B: the third launch (yellow) is the one that, under the old
  // spacing, reached back and rewrote the blue Pal two launches earlier.
  const steps = expectIdempotentUnderExtension(createGame(RETRO), [
    launch('blue', 4, 0), launch('white', 1, 1), launch('yellow', 2, 2),
  ]);
  expect(steps[2]!).toHaveLength(3);
  expect(steps[2]![0]!.encounters.map((e) => e.pixelId))
    .toEqual(['L9720-p0-2', 'L9720-p0-0', 'L9720-p2-1']);
});

test('E · forward help still works — an earlier Pal exposes a target for a later one', () => {
  // The white centre is buried until the red ring clears. Legacy V1: 3 tunnels.
  const base = createGame(lvl(9943, ['RRR', 'RWR', 'RRR'], [
    [{ color: 'red', capacity: 8 }], [{ color: 'white', capacity: 1 }],
    [{ color: 'white', capacity: 1 }],
  ], { ruleset: 'legacyV1' }));
  const charges = simulateEpoch(base, [launch('red', 8, 0), launch('white', 1, 1)]).charges;
  expect(charges[1]!.encounters.map((e) => e.pixelId)).toEqual(['L9943-p1-1']);
});

test('F · a contested pixel goes to the earlier launch; the later one keeps its capacity', () => {
  const base = createGame(lvl(9944, ['.W.', '...', '...'], [
    [{ color: 'white', capacity: 1 }], [{ color: 'white', capacity: 1 }],
    [{ color: 'white', capacity: 1 }],
  ], { ruleset: 'legacyV1' }));
  const charges = simulateEpoch(base, [launch('white', 1, 0), launch('white', 1, 1)]).charges;
  expect(charges[0]!.encounters.map((e) => e.pixelId)).toEqual(['L9944-p1-0']);
  expect(charges[0]!.landed).toBe('consumed');
  expect(charges[1]!.encounters).toEqual([]);
  expect(charges[1]!.remainingCapacity).toBe(1);
  expect(charges[1]!.landed).toBe('holding');
});

test('G · Frozen/Shielded shells: an earlier Pal keeps its exact break sequence', () => {
  const base = createGame(lvl(9945, ['BBB', 'BBB', 'BBB'], [
    [{ color: 'blue', capacity: 6 }], [{ color: 'blue', capacity: 3 }],
    [{ color: 'blue', capacity: 1 }],
  ], { modifiers: { '0,0': { kind: 'frozen', level: 2 }, '2,0': { kind: 'shielded', level: 1 } } }));
  const steps = expectIdempotentUnderExtension(base, [
    launch('blue', 6, 0), launch('blue', 3, 1),
  ]);
  expect(steps[0]![0]!.encounters.some((e) => e.frozenBreak || e.shieldBreak)).toBe(true);
});

test('H · a consumed Pal can never be resurrected by a later join', () => {
  const steps = expectIdempotentUnderExtension(createGame(RETRO), [
    launch('yellow', 5, 0), launch('blue', 4, 1), launch('white', 1, 2),
  ]);
  const alone = steps[0]![0]!;
  for (const step of steps) {
    expect(step[0]!.landed).toBe(alone.landed);
    expect(step[0]!.remainingCapacity).toBe(alone.remainingCapacity);
  }
});

test('I · deterministic replay — the same launches always give a byte-equal result', () => {
  const launches = [launch('blue', 4, 0), launch('yellow', 2, 1), launch('white', 1, 2)];
  const a = simulateEpoch(createGame(RETRO), launches);
  const b = simulateEpoch(createGame(RETRO), launches);
  expect(JSON.stringify(b.charges)).toEqual(JSON.stringify(a.charges));
  expect(b.pixels.map((p) => p.cleared)).toEqual(a.pixels.map((p) => p.cleared));
});

// ── what a join MAY still change: the unpresented terminal ──────────────────

test('a join may still change where an in-flight Pal parks — that is future, not past', () => {
  // Three misses fill a 3-slot tray; the fourth has nowhere to land.
  const OVERFLOW = lvl(9946, ['WWW', 'WWW', 'WWW'], [
    [{ color: 'blue', capacity: 1 }, { color: 'cyan', capacity: 1 }],
    [{ color: 'red', capacity: 1 }],
    [{ color: 'green', capacity: 1 }],
  ]);
  let s = createGame(OVERFLOW);
  for (const id of ['tunnel-0', 'tunnel-1', 'tunnel-2']) {
    s = resolveAction(s, { kind: 'tunnel', id, join: true }).state;
  }
  expect(s.holding).toHaveLength(3);
  expect(s.status).toBe('playing');

  const out = resolveAction(s, { kind: 'tunnel', id: 'tunnel-0', join: true });
  expect(out.accepted).toBe(true);
  // Its encounters are still empty (history intact) but it cannot park.
  const cyan = out.epochCharges!.find((c) => c.color === 'cyan')!;
  expect(cyan.encounters).toEqual([]);
  // Provisional overflow: playing while the Pal flies, decided at the Gate.
  expect(out.state.status).toBe('playing');
  expect(resolveArrival(out.state).state.status).toBe('lost');
  // The three that already parked keep their slots, in launch order.
  expect(out.state.holding.map((c) => c.color)).toEqual(['blue', 'red', 'green']);
});
