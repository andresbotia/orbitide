/**
 * M4A.2 — deadlock detection is join-aware.
 *
 * `isLost` must not declare a loss while an admitted player action — including
 * a `join: true` launch onto an open epoch — can still change the board.
 *
 * `legalActions(state, { includeJoin: !!state.epoch })` is the one shared
 * runtime deadlock predicate; every action it returns is progress-making (see
 * winState.ts), so "a legal action exists" ≡ "the board can still change".
 */
import { candidateActions, legalActions, type GameAction } from '../actions';
import { MAX_ACTIVE_CHARGES } from '../concurrency';
import { createGame } from '../createGame';
import { iceLayers } from '../frozen';
import { reachablePixels, remainingPixelCount } from '../pixels';
import { resolveAction } from '../resolveLaunch';
import { enumerateActions, solve, stateKey } from '../solver';
import { computeStatus, isLost, isWon } from '../winState';
import type { GameState, LevelDefinition } from '../types';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';

const T = (i: number): GameAction => ({ kind: 'tunnel', id: `tunnel-${i}` });

/**
 * The Level-5 comet head in its Level-5 board position — white frame · buried
 * cyan ring · buried centre-white pixel. The frame-clearing white charge sits
 * **behind** two cyan charges in tunnel 0, so the only way to reach it is to
 * launch those cyan charges first — and cyan is buried, so they strand. Three
 * cyan strands fill the tray; the epoch stays open. There is then NO plain
 * launch (the white tunnel would overflow the tray, the last cyan tunnel too,
 * the held cyan charges have no exposed target) — but joining the epoch with
 * the white charge clears the frame and re-floats the stranded cyan. That is a
 * legal, progress-making move, so the state must not be a loss, and
 * `sequential-compat` (which ignores joins) genuinely dead-ends.
 */
const JOIN_ONLY: LevelDefinition = {
  id: 9820, title: 'Join Only', themeId: 'fixture', difficulty: 'easy', holdingCapacity: 3,
  pixelArt: ['....WWWW', '...WCCCW', '...WCWCW', '...WCCCW', '...WWWWW'],
  legend: {},
  tunnels: [
    // Three cyan charges must be spent to reach the frame-clearing white one,
    // and cyan is buried — so by the time white is the front charge the tray is
    // already full and white can only go out as a join.
    [{ color: 'cyan', capacity: 2 }, { color: 'cyan', capacity: 2 }, { color: 'cyan', capacity: 2 }, { color: 'white', capacity: 16 }],
    [{ color: 'cyan', capacity: 2 }],
    [{ color: 'cyan', capacity: 2 }],
  ],
};

function drive(level: LevelDefinition, actions: GameAction[]): GameState {
  let s = createGame(level);
  for (const a of actions) {
    const out = resolveAction(s, a);
    if (!out.accepted) throw new Error(`setup action ${a.kind}:${a.id} rejected: ${out.rejection}`);
    s = out.state;
  }
  return s;
}

// ── the repro ──────────────────────────────────────────────────────────────

test('M4A.2 repro — a join-only escape is NOT a deadlock (fails before the fix)', () => {
  const s = drive(JOIN_ONLY, [T(0), T(0), T(0)]);

  // The board is untouched and the tray is full.
  expect(remainingPixelCount(s)).toBe(24);
  expect(s.holding).toHaveLength(3);
  expect(s.epoch).not.toBeNull();

  // No plain launch is available…
  expect(legalActions(s)).toHaveLength(0);

  // THE FIX — before it, `computeStatus` (plain-only) marked this state 'lost'
  // as the third cyan launch flushed, and `isLost` still agreed:
  expect(s.status).toBe('playing');
  expect(computeStatus(s)).toBe('playing');
  expect(isLost(s)).toBe(false);

  // …because a join into the open epoch is legal and makes real progress.
  const joinLaunch: GameAction = { ...T(0), join: true };
  const out = resolveAction(s, joinLaunch);
  expect(out.accepted).toBe(true);
  expect(remainingPixelCount(out.state)).toBeLessThan(24);
});

// ── test matrix A–J ────────────────────────────────────────────────────────

test('A · open epoch + only a join can progress → NOT lost', () => {
  const s = drive(JOIN_ONLY, [T(0), T(0), T(0)]);
  expect(legalActions(s, { includeJoin: true }).some((a) => a.join)).toBe(true);
  expect(isLost(s)).toBe(false);
});

test('B · a genuine deadlock (nothing — plain or join — can progress) → lost', () => {
  // The real campaign fail witness for the World-1 Hard finale ends in a
  // deadlock: an open epoch, pixels left, and no admitted move of any kind.
  const level = LEVEL_DEFINITIONS[9]!; // Ring Nebula
  const fail = solve(level).failPath;
  expect(fail).not.toBeNull();
  const s = drive(level, fail!);
  expect(s.status).toBe('lost');
  expect(remainingPixelCount(s)).toBeGreaterThan(0);
  // join-aware, there is still nothing to do — this is a true loss.
  const alive = legalActions({ ...s, status: 'playing' }, { includeJoin: s.epoch !== null });
  expect(alive).toHaveLength(0);
  expect(isLost(s)).toBe(true);
});

test('C · open epoch + a plain launch works → NOT lost', () => {
  const s = drive(LEVEL_DEFINITIONS[9]!, [T(0)]); // Ring Nebula, mid-solve
  expect(s.status).toBe('playing');
  expect(legalActions(s).length).toBeGreaterThan(0);
  expect(isLost(s)).toBe(false);
});

test('D · no epoch + no plain action → lost', () => {
  const base = createGame(LEVEL_DEFINITIONS[0]!);
  const stuck: GameState = {
    ...base, epoch: null, activeCharges: [],
    tunnels: base.tunnels.map((t) => ({ ...t, queue: [] })),
    holding: [{ id: 'h', color: 'red', capacity: 3 }], // red — no red pixels
  };
  expect(remainingPixelCount(stuck)).toBeGreaterThan(0);
  expect(legalActions(stuck)).toHaveLength(0);
  expect(isLost(stuck)).toBe(true);
});

test('E · full Holding + a legal held relaunch → NOT lost', () => {
  // Strand a white charge with buried targets, then expose them.
  const level: LevelDefinition = {
    id: 9822, title: 'Held Rescue', themeId: 'fixture', difficulty: 'easy', holdingCapacity: 3,
    pixelArt: ['WWWWW', 'WBWBW', 'WWWWW'],
    legend: {},
    tunnels: [
      [{ color: 'white', capacity: 2 }, { color: 'white', capacity: 11 }],
      [{ color: 'white', capacity: 2 }],
      [{ color: 'blue', capacity: 2 }],
    ],
  };
  // white2 strands only if white buried — it isn't here, so build the state by
  // hand: full tray, one held white with an exposed white target.
  const g = createGame(level);
  const full: GameState = {
    ...g,
    holding: [
      { id: 'a', color: 'red', capacity: 1 },
      { id: 'b', color: 'red', capacity: 1 },
      { id: 'w', color: 'white', capacity: 4 },
    ],
    epoch: { baseline: { ...g, epoch: null, activeCharges: [] }, launches: [], clock: 0 },
  };
  expect(full.holding).toHaveLength(full.holdingCapacity);
  expect(reachablePixels(full).some((p) => p.color === 'white')).toBe(true);
  expect(legalActions(full, { includeJoin: true }).some((a) => a.kind === 'holding' && a.id === 'w')).toBe(true);
  expect(isLost(full)).toBe(false);
});

test('F · full Holding + a legal join tunnel launch → NOT lost', () => {
  const s = drive(JOIN_ONLY, [T(0), T(0), T(0)]);
  expect(s.holding).toHaveLength(3);
  const joinKeys = legalActions(s, { includeJoin: true }).filter((a) => a.kind === 'tunnel' && a.join);
  expect(joinKeys.length).toBeGreaterThan(0);
  expect(isLost(s)).toBe(false);
});

test('G · five active charges (a sixth join denied) is not a loss on its own', () => {
  // Build a state with a full five-charge rail, a tunnel charge still queued and
  // pixels still reachable.
  const g = createGame(LEVEL_DEFINITIONS[9]!); // Ring Nebula — many white charges
  const baseline: GameState = { ...g, epoch: null, activeCharges: [] };
  const launches = Array.from({ length: MAX_ACTIVE_CHARGES }, (_, i) => ({
    chargeId: `epoch-${i}`, source: 'tunnel' as const, originId: 'tunnel-0',
    color: 'white' as const, capacity: 1, insertionTime: i * 0.18, launchSequence: i,
  }));
  const railFull: GameState = { ...g, epoch: { baseline, launches, clock: MAX_ACTIVE_CHARGES * 0.18 } };

  expect(railFull.epoch!.launches).toHaveLength(MAX_ACTIVE_CHARGES);
  // canJoinEpoch is false at the cap → no join variant is even a candidate…
  expect(candidateActions(railFull, true).some((a) => a.join)).toBe(false);
  // …but plain launches remain, so the board is not deadlocked.
  expect(legalActions(railFull, { includeJoin: true }).length).toBeGreaterThan(0);
  expect(isLost(railFull)).toBe(false);
});

test('H · all queues exhausted + held charges useless + pixels remain → lost', () => {
  const g = createGame(LEVEL_DEFINITIONS[0]!);
  const stuck: GameState = {
    ...g,
    tunnels: g.tunnels.map((t) => ({ ...t, queue: [] })),
    holding: [{ id: 'h', color: 'blue', capacity: 5 }], // blue — no blue pixels
    epoch: { baseline: { ...g, epoch: null, activeCharges: [] }, launches: [], clock: 0 },
  };
  expect(remainingPixelCount(stuck)).toBeGreaterThan(0);
  expect(legalActions(stuck, { includeJoin: true })).toHaveLength(0);
  expect(isLost(stuck)).toBe(true);
});

test('I · Frozen board with a legal Frozen hit still available → NOT lost', () => {
  const s = drive(LEVEL_DEFINITIONS[20]!, [T(0)]); // First Frost, after one launch
  expect(s.status).toBe('playing');
  const icedRemain = s.pixels.some((p) => iceLayers(p) > 0);
  expect(icedRemain || remainingPixelCount(s) > 0).toBe(true);
  expect(legalActions(s, { includeJoin: true }).length).toBeGreaterThan(0);
  expect(isLost(s)).toBe(false);
});

test('J · the final pixel cleared mid-epoch → won, never lost', () => {
  // Level 1 is white-only; its solver witness finishes inside one epoch.
  let s = createGame(LEVEL_DEFINITIONS[0]!);
  s = resolveAction(s, T(0)).state;
  s = resolveAction(s, { ...T(1), join: true }).state;
  s = resolveAction(s, { ...T(2), join: true }).state;
  expect(isWon(s)).toBe(true);
  expect(isLost(s)).toBe(false);
  expect(s.status).toBe('won');
});

test('sequential-compat is unchanged: a join-only escape is a dead end, not a crash', () => {
  // JOIN_ONLY is winnable only by joining the epoch. `sequential-compat`
  // ignores joins, so it dead-ends — it must NOT throw "Runtime failed to mark
  // a deadlock", and the concurrent solve still wins.
  expect(() => solve(JOIN_ONLY, { mode: 'sequential-compat' })).not.toThrow();
  expect(solve(JOIN_ONLY, { mode: 'sequential-compat' }).solved).toBe(false);
  const con = solve(JOIN_ONLY, { mode: 'metrics' });
  expect(con.solved).toBe(true);
  expect(con.moves.some((m) => m.join)).toBe(true);
});

// ── solver / runtime consistency ───────────────────────────────────────────

test('runtime deadlock, legalActions(includeJoin) and the concurrent solver agree', () => {
  // Sweep reachable states across a few structurally varied campaign levels.
  for (const idx of [4, 9, 19, 25, 29]) {
    const def = LEVEL_DEFINITIONS[idx]!;
    const seen = new Set<string>();
    const stack: GameState[] = [createGame(def)];
    let visited = 0;
    while (stack.length && visited < 2500) {
      const s = stack.pop()!;
      const k = stateKey(s);
      if (seen.has(k)) continue;
      seen.add(k);
      visited += 1;

      const lost = isLost(s);
      const joinAware = legalActions(s, { includeJoin: s.epoch !== null });
      const concurrentEnum = enumerateActions(s, 'metrics');

      // the three views of "is there a move" cannot disagree
      expect(lost).toBe(joinAware.length === 0 && remainingPixelCount(s) > 0);
      if (s.epoch !== null) {
        expect(concurrentEnum.map((a) => `${a.kind}:${a.id}:${a.join ? 'J' : '-'}`).sort())
          .toEqual(joinAware.map((a) => `${a.kind}:${a.id}:${a.join ? 'J' : '-'}`).sort());
      }
      // a state the runtime calls 'lost' really has no accepted progress move
      if (s.status === 'lost') {
        for (const a of [...candidateActions(s, true)]) {
          const out = resolveAction(s, a);
          expect(out.accepted).toBe(false);
        }
      }

      if (s.status !== 'playing') continue;
      for (const a of concurrentEnum) {
        const out = resolveAction(s, a);
        if (out.accepted && stack.length < 1800) stack.push(out.state);
      }
    }
    expect(visited).toBeGreaterThan(1);
  }
}, 180_000);

test('every admitted action makes progress — no keep-alive loop', () => {
  // For a sample of reachable states, every accepted action changes the
  // committed board fingerprint OR shrinks a tunnel queue OR reduces total ice.
  const fingerprint = (s: GameState) =>
    s.pixels.map((p) => (p.cleared ? '1' : iceLayers(p) > 0 ? `f${iceLayers(p)}` : '0')).join('')
    + '|' + s.tunnels.map((t) => t.queue.length).join(',');

  for (const idx of [4, 26, 29]) {
    const def = LEVEL_DEFINITIONS[idx]!;
    const seen = new Set<string>();
    const stack: GameState[] = [createGame(def)];
    let checked = 0;
    while (stack.length && checked < 900) {
      const s = stack.pop()!;
      const k = stateKey(s);
      if (seen.has(k) || s.status !== 'playing') continue;
      seen.add(k);
      checked += 1;
      const before = fingerprint(s);
      for (const a of enumerateActions(s, 'metrics')) {
        const out = resolveAction(s, a);
        if (!out.accepted) continue;
        expect(fingerprint(out.state)).not.toBe(before); // real change every time
        if (stack.length < 700) stack.push(out.state);
      }
    }
    expect(checked).toBeGreaterThan(1);
  }
}, 180_000);
