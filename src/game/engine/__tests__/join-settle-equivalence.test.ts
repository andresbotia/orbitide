/**
 * JOIN ≡ SETTLE-FIRST — the logical half of FIRST LAUNCHED, FIRST SERVED.
 *
 * With `LAUNCH_SPACING` = one lap, launch `i` owns logical time `[i, i+1]` and is
 * retired before launch `i+1` acts. So joining the open epoch must resolve the
 * new Pal exactly as launching it after the board settled would: same hits,
 * same order, same progresses, same remaining capacity, same committed board,
 * Holding and status. Only absolute logical times differ, by the insertion
 * offset, and those are normalised below by shifting the settle-first
 * resolution forward.
 *
 * The regression: Core V2 marked an attack-line bin as consumed for EVERY
 * cursor that nominated it in the simulation step where it was resolved. A
 * later launch nominates the same bin exactly one lap after the earlier Pal
 * that wins it (bins are fixed geometry), so the later Pal silently lost every
 * bin the earlier Pal had shot — e.g. on Level 7's opening join it fired zero
 * shots instead of eight. A bin is spent only by a cursor that actually
 * reaches it at the winning logical time.
 */
import { legalActions, type GameAction } from '../actions';
import { LAUNCH_SPACING } from '../concurrency';
import { createGame } from '../createGame';
import { simulateEpoch } from '../epoch';
import { boardFingerprint } from '../frozen';
import { resolveAction } from '../resolveLaunch';
import { stateKey } from '../solver';
import { requireLevel } from '@/game/levels/levels';
import type { ActiveCharge, EpochLaunch, GameState, LevelDefinition } from '../types';

const lvl = (id: number, pixelArt: string[], tunnels: LevelDefinition['tunnels']): LevelDefinition => ({
  id, title: `fixture-${id}`, themeId: 'test', difficulty: 'easy',
  holdingCapacity: 3, ruleset: 'coreV2', pixelArt, tunnels,
});

/** Everything the next decision depends on — no epoch residue, no timing. */
function committed(s: GameState) {
  return {
    board: boardFingerprint(s.pixels),
    tunnels: s.tunnels.map((t) => t.queue.map((c) => `${c.id}:${c.color}:${c.capacity}`)),
    holding: s.holding.map((c) => `${c.id}:${c.color}:${c.capacity}`),
    status: s.status,
    movesApplied: s.movesApplied,
  };
}

/** A charge's full resolution, with absolute logical times shifted by `offset`. */
function shifted(c: ActiveCharge, offset: number) {
  return {
    id: c.id, color: c.color, capacity: c.capacity,
    remainingCapacity: c.remainingCapacity, landed: c.landed, passCount: c.passCount,
    insertionTime: c.insertionTime + offset,
    finishTime: c.finishTime + offset,
    encounters: c.encounters.map((e) => ({ ...e, time: e.time + offset })),
  };
}

/** Resolve `action` both as a join and settle-first from `s`; assert equivalence. */
function expectJoinEqualsSettle(s: GameState, action: GameAction) {
  const joined = resolveAction(s, { ...action, join: true });
  const settled = resolveAction(s, { kind: action.kind, id: action.id });
  expect(joined.accepted && settled.accepted).toBe(true);
  expect(joined.joinedEpoch).toBe(true);

  expect(committed(joined.state)).toEqual(committed(settled.state));

  const mine = joined.epochCharges![joined.epochCharges!.length - 1]!;
  const alone = settled.epochCharges![0]!;
  expect(shifted(mine, 0)).toEqual(shifted(alone, mine.insertionTime));

  // …and the earlier Pals are untouched (FIRST LAUNCHED, FIRST SERVED).
  expect(joined.epochCharges!.slice(0, -1).map((c) => shifted(c, 0)))
    .toEqual(s.activeCharges.map((c) => shifted(c, 0)));
  return { joined, settled };
}

// ── minimal fixtures ────────────────────────────────────────────────────────

/**
 *   Y Y Y     blue p1-1 is reachable only up bin b:1, and only once blue p1-2
 *   Y B Y     in front of it has cleared. Pal A (blue1) clears p1-2 on b:1.
 *   Y B Y     Pal B (blue1) must then clear p1-1 on the same bin one lap later.
 *
 * Before the fix a joined B had b:1 marked consumed the moment A won it, fired
 * nothing, and parked — while settle-first B cleared p1-1 and was consumed.
 */
test('the only line to a pixel an earlier Pal exposed is not stolen from a joining Pal', () => {
  const level = lvl(9810, ['YYY', 'YBY', 'YBY'], [
    [{ color: 'blue', capacity: 1 }], [{ color: 'blue', capacity: 1 }], [{ color: 'yellow', capacity: 9 }],
  ]);
  const a = resolveAction(createGame(level), { kind: 'tunnel', id: 'tunnel-0' });
  expect(a.pass!.encounters.map((e) => e.pixelId)).toEqual(['L9810-p1-2']);

  const { joined } = expectJoinEqualsSettle(a.state, { kind: 'tunnel', id: 'tunnel-1' });
  const b = joined.epochCharges![1]!;
  expect(b.encounters.map((e) => e.pixelId)).toEqual(['L9810-p1-1']);
  expect(b.landed).toBe('consumed');
  expect(joined.state.holding).toEqual([]);
});

/**
 *   B     A (blue1) clears p0-1 on bin b:0 at progress 0. B (blue1) must take
 *   B     p0-0 on that same bin at ITS progress 0 — not skip ahead to another
 *         line at 0.1066 because A "used" b:0 a lap earlier.
 */
test('a joining Pal fires on the same line at the same lap-progress as settle-first', () => {
  const level = lvl(9811, ['B', 'B'], [[{ color: 'blue', capacity: 1 }], [{ color: 'blue', capacity: 1 }], []]);
  const a = resolveAction(createGame(level), { kind: 'tunnel', id: 'tunnel-0' });
  const { joined } = expectJoinEqualsSettle(a.state, { kind: 'tunnel', id: 'tunnel-1' });
  expect(joined.epochCharges![1]!.encounters.map((e) => [e.pixelId, e.progress]))
    .toEqual([['L9811-p0-0', 0]]);
});

test('simulateEpoch: a later launch resolves exactly as it would alone on the board the earlier one left', () => {
  const s0 = createGame(lvl(9812, ['YYY', 'YBY', 'YBY'], [
    [{ color: 'blue', capacity: 1 }], [{ color: 'blue', capacity: 1 }], [{ color: 'yellow', capacity: 9 }],
  ]));
  const launch = (i: number, at: number): EpochLaunch => ({
    chargeId: `c${i}`, source: 'tunnel', originId: `tunnel-${i}`, color: 'blue', capacity: 1,
    insertionTime: at, launchSequence: i,
  });
  const first = simulateEpoch(s0, [launch(0, 0)]);
  const both = simulateEpoch(s0, [launch(0, 0), launch(1, LAUNCH_SPACING)]);
  const alone = simulateEpoch({ ...s0, pixels: first.pixels }, [launch(1, 0)]);

  expect(shifted(both.charges[1]!, 0)).toEqual(shifted(alone.charges[0]!, LAUNCH_SPACING));
  expect(boardFingerprint(both.pixels)).toBe(boardFingerprint(alone.pixels));
});

// ── real content ────────────────────────────────────────────────────────────

/**
 * Level 7's opening: blue26 then blue10 on the same tunnel. Every bin blue26
 * shoots is one blue10 needs a lap later (the pixel behind), so the old rule
 * left a joined blue10 with zero hits instead of eight.
 */
test('Level 7 opening — blue10 joining behind blue26 resolves exactly as settle-first', () => {
  const a = resolveAction(createGame(requireLevel(7)), { kind: 'tunnel', id: 'tunnel-0' });
  const { joined } = expectJoinEqualsSettle(a.state, { kind: 'tunnel', id: 'tunnel-0' });
  expect(joined.epochCharges![1]!.encounters.length).toBeGreaterThan(0);
});

/**
 * Property, over a whole reachable graph: every admissible join resolves to
 * the same committed state and the same (time-shifted) Pal history as the
 * settle-first launch of the same charge. Level 2's join-inclusive graph is
 * small enough to exhaust; Level 7 is bounded.
 */
describe.each([[2, Infinity], [7, 300]])('join ≡ settle-first across the reachable graph of Level %i', (id, cap) => {
  test('every join pair is equivalent', () => {
    const seen = new Set<string>();
    const stack: GameState[] = [createGame(requireLevel(id))];
    let states = 0;
    let pairs = 0;
    while (stack.length && states < cap) {
      const s = stack.pop()!;
      if (s.status !== 'playing') continue;
      const key = stateKey(s);
      if (seen.has(key)) continue;
      seen.add(key);
      states += 1;
      for (const action of legalActions(s, { includeJoin: true })) {
        stack.push(resolveAction(s, action).state);
        if (!action.join) continue;
        pairs += 1;
        expectJoinEqualsSettle(s, action);
      }
    }
    if (cap === Infinity) expect(stack.length).toBe(0);
    expect(pairs).toBeGreaterThan(50);
  });
});
