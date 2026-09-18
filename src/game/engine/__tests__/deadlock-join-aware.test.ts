/**
 * Deadlock detection.
 *
 * `isLost` must not declare a loss while an admitted player action can still
 * change the board. `legalActions(state)` is the one shared runtime deadlock
 * predicate; every action it returns is progress-making (see winState.ts), so
 * "a legal action exists" ≡ "the board can still change".
 *
 * Joins used to need a separate look (M4A.2). They no longer do: a `join: true`
 * launch is only ever offered next to its settle-first twin and never admitted
 * where that twin is refused, so it cannot change whether any move exists —
 * pinned below as a property over whole reachable graphs.
 */
import { candidateActions, legalActions, type GameAction } from '../actions';
import { MAX_ACTIVE_CHARGES } from '../concurrency';
import { createGame } from '../createGame';
import { iceLayers } from '../frozen';
import { reachablePixels, remainingPixelCount } from '../pixels';
import { resolveAction } from '../resolveLaunch';
import { enumerateActions, solve, stateKey } from '../solver';
import { isLost, isWon } from '../winState';
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

/** A small Core V2 board with joins available from the first launch on. */
const OPEN_V2: LevelDefinition = {
  id: 9824, title: 'Open V2', themeId: 'fixture', difficulty: 'easy', holdingCapacity: 3, ruleset: 'coreV2',
  pixelArt: ['BWB', 'WYW', 'BWB'],
  tunnels: [
    [{ color: 'white', capacity: 2 }, { color: 'blue', capacity: 2 }],
    [{ color: 'blue', capacity: 3 }],
    [{ color: 'yellow', capacity: 1 }, { color: 'white', capacity: 2 }],
    [{ color: 'white', capacity: 1 }],
  ],
};

// ── the predicate ──────────────────────────────────────────────────────────

test('a join never changes whether any move exists, over whole reachable graphs', () => {
  const key = (a: GameAction) => `${a.kind}:${a.id}`;
  for (const def of [JOIN_ONLY, OPEN_V2]) {
    const seen = new Set<string>();
    const stack: GameState[] = [createGame(def)];
    let states = 0;
    while (stack.length && states < 5000) {
      const s = stack.pop()!;
      const k = stateKey(s);
      if (seen.has(k)) continue;
      seen.add(k);
      states += 1;
      const plain = legalActions({ ...s, status: 'playing' });
      const withJoin = legalActions({ ...s, status: 'playing' }, { includeJoin: true });
      expect({ k, anyMove: plain.length > 0 }).toEqual({ k, anyMove: withJoin.length > 0 });
      // every admitted join has its settle-first twin admitted too
      for (const j of withJoin.filter((a) => a.join)) expect(plain.map(key)).toContain(key(j));
      if (s.status !== 'playing') continue;
      for (const a of legalActions(s, { includeJoin: true })) stack.push(resolveAction(s, a).state);
    }
    expect({ level: def.id, exhausted: stack.length === 0 }).toEqual({ level: def.id, exhausted: true });
    expect(states).toBeGreaterThan(10);
  }
});

// ── test matrix A–J ────────────────────────────────────────────────────────

test('A · open epoch + only a join can progress → NOT lost', () => {
  const s = drive(JOIN_ONLY, [T(0), T(0), T(0)]);
  expect(legalActions(s, { includeJoin: true }).some((a) => a.join)).toBe(true);
  expect(isLost(s)).toBe(false);
});

test('B · a genuine deadlock (nothing — plain or join — can progress) → lost', () => {
  // White clears its pixel; the blue one has no charge left anywhere. The epoch
  // is open, pixels remain, and no move of any kind is admitted.
  const level: LevelDefinition = {
    id: 9825, title: 'Stranded Blue', themeId: 'fixture', difficulty: 'easy', holdingCapacity: 3,
    pixelArt: ['WB'], tunnels: [[{ color: 'white', capacity: 1 }], [], []],
  };
  const s = drive(level, [T(0)]);
  expect(s.epoch).not.toBeNull();
  expect(remainingPixelCount(s)).toBe(1);
  expect(legalActions({ ...s, status: 'playing' }, { includeJoin: true })).toHaveLength(0);
  expect(s.status).toBe('lost');
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

test('sequential-compat dead-ends on JOIN_ONLY without crashing', () => {
  // `sequential-compat` ignores joins and dead-ends here. The property under
  // test is that it does so cleanly — it must NOT throw "Runtime failed to mark
  // a deadlock".
  expect(() => solve(JOIN_ONLY, { mode: 'sequential-compat' })).not.toThrow();
  expect(solve(JOIN_ONLY, { mode: 'sequential-compat' }).solved).toBe(false);
});

/**
 * JOIN_ONLY's escape was retroactive, and is gone on purpose.
 *
 * This fixture used to be winnable ONLY by joining: white16 joined the open
 * epoch, cleared the frame, and a cyan charge that was already on the rail —
 * and had already resolved zero hits — retroactively gained two, clearing
 * enough of the ring to expose the buried centre white so white could spend its
 * 16th capacity. That is precisely the rewrite of an earlier Pal's history that
 * FIRST LAUNCHED, FIRST SERVED forbids.
 *
 * Under the new rule white's lap runs alone: it clears the 15 frame whites, the
 * centre is still buried, and its leftover capacity has no free tray slot (the
 * three stranded cyans filled it) — so the epoch overflows and the level is
 * lost. The level is genuinely unsolvable now, and deliberately NOT special
 * cased. It is kept as a fixture because the deadlock predicates above still
 * need a state where the tray is full and every queue is stuck.
 */
test('JOIN_ONLY is unsolvable under first-launched-first-served, and runtime agrees', () => {
  const con = solve(JOIN_ONLY, { mode: 'metrics' });
  expect(con.solved).toBe(false);
  expect(con.complete).toBe(true);

  // Solver and runtime must agree — an unsolvable level is not a crash, and the
  // runtime must reach a state it marks lost rather than stranding the player.
  let s = createGame(JOIN_ONLY);
  for (const a of con.failPath ?? []) {
    const out = resolveAction(s, a);
    expect(out.accepted).toBe(true);
    s = out.state;
  }
  expect(s.status).toBe('lost');
  expect(isLost(s)).toBe(true);
  expect(legalActions(s, { includeJoin: s.epoch !== null })).toHaveLength(0);
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
