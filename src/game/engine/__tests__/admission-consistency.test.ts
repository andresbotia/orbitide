/**
 * M4A.1 — the solver and the runtime must have ONE consistent view of which
 * player actions are legal.
 *
 *   • every action `enumerateActions` returns → `resolveAction` accepts it
 *   • every candidate `resolveAction` accepts → `enumerateActions` returns it
 *     (a `join: true` request that `canJoinEpoch` cannot honour is treated by
 *     the runtime as a plain settle-first launch, so those two keys are
 *     equivalent — the invariant is checked modulo that equivalence).
 *
 * Both directions of the mismatch M4A flagged ("Solver/runtime admission
 * mismatch") are pinned here: a full-Holding join that the old enumeration
 * emitted-but-`resolveAction`-rejected, and one it accepted-but-never-emitted.
 */
import { canJoinEpoch } from '../epoch';
import { candidateActions, legalActions, type GameAction } from '../actions';
import { createGame } from '../createGame';
import { enumerateActions, stateKey } from '../solver';
import { resolveAction } from '../resolveLaunch';
import type { GameState, LevelDefinition } from '../types';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';

const T = (i: number): GameAction => ({ kind: 'tunnel', id: `tunnel-${i}` });
const key = (a: GameAction) => `${a.kind}:${a.id}:${a.join ? 'J' : '-'}`;

/** Actions `resolveAction` would admit right now (plain + every join variant). */
function acceptedActions(s: GameState): GameAction[] {
  const plain: GameAction[] = [
    ...s.tunnels.filter((t) => t.queue.length).map((t) => ({ kind: 'tunnel' as const, id: t.id })),
    ...s.holding.map((c) => ({ kind: 'holding' as const, id: c.id })),
  ];
  const all = s.epoch ? plain.flatMap((a) => [a, { ...a, join: true } as GameAction]) : plain;
  return all.filter((a) => resolveAction(s, a).accepted);
}

/** Canonical key: a `join` that cannot be honoured is a plain launch. */
function canonical(s: GameState, a: GameAction): string {
  if (!a.join) return key(a);
  const chargeId = a.kind === 'tunnel'
    ? s.tunnels.find((t) => t.id === a.id)?.queue[0]?.id
    : a.id;
  return chargeId && canJoinEpoch(s, chargeId) ? key(a) : key({ ...a, join: false });
}

function assertConsistent(s: GameState, where: string) {
  if (s.status !== 'playing') return;
  const enumerated = enumerateActions(s, 'metrics');
  const enumKeys = new Set(enumerated.map((a) => canonical(s, a)));

  for (const a of enumerated) {
    expect(`${where} enum→accept ${key(a)}: ${resolveAction(s, a).rejection ?? 'ok'}`)
      .toBe(`${where} enum→accept ${key(a)}: ok`);
  }
  for (const a of acceptedActions(s)) {
    expect(`${where} accept→enum ${canonical(s, a)}: ${enumKeys.has(canonical(s, a))}`)
      .toBe(`${where} accept→enum ${canonical(s, a)}: true`);
  }
  // `legalActions` (runtime + deadlock check) and the concurrent enumeration
  // must agree on the plain actions.
  const plainRuntime = new Set(legalActions(s).map(key));
  const plainEnum = new Set(enumerated.filter((a) => !a.join).map(key));
  expect([...plainEnum].sort()).toEqual([...plainRuntime].sort());
}

// ── the M4A repro: a full Holding tray with an open epoch ───────────────────

/**
 * A white box with a buried cyan ring and a buried centre-white pixel. Three
 * cyan launches strand (cyan is buried) and fill the tray; the epoch stays open.
 * A fresh white launch then over-fills the tray (it cannot reach the centre
 * white), yet *joining* the epoch is admissible — the joined white charge clears
 * the frame and re-floats the stranded cyan. That is the exact shape the M4A
 * "Solver/runtime admission mismatch" note describes.
 */
const REPRO_LEVEL: LevelDefinition = {
  id: 9810, title: 'Admission Repro', themeId: 'fixture', difficulty: 'easy', holdingCapacity: 3,
  // The Level-5 comet head in its Level-5 board position (white frame · buried
  // cyan ring · buried centre white) plus one far-corner red so the tray-full
  // state never deadlocks — the join arbitration is what Level 5 actually hits.
  pixelArt: [
    '....WWWW',
    '...WCCCW',
    '...WCWCW',
    '...WCCCW',
    '...WWWWW',
    'R.......',
  ],
  legend: {},
  tunnels: [
    [{ color: 'white', capacity: 16 }, { color: 'cyan', capacity: 2 }],
    [{ color: 'cyan', capacity: 2 }, { color: 'cyan', capacity: 2 }],
    [{ color: 'cyan', capacity: 2 }, { color: 'red', capacity: 1 }],
  ],
};

function fullTrayState(): GameState {
  // Strand three cyan charges (cyan is buried inside the white box) → tray full,
  // epoch open. The lone edge-red keeps the level from deadlocking, so status
  // stays 'playing' and the T0 join can still be attempted.
  let s = createGame(REPRO_LEVEL);
  for (const a of [T(1), T(1), T(2)]) {
    const out = resolveAction(s, a);
    expect(out.accepted).toBe(true);
    s = out.state;
  }
  return s;
}


test('M4A repro — a full-Holding join onto the running epoch is both accepted and enumerated', () => {
  const s = fullTrayState();
  expect(s.status).toBe('playing');
  expect(s.holding.length).toBe(s.holdingCapacity); // tray is full
  expect(s.epoch).not.toBeNull();

  const joinLaunch: GameAction = { ...T(0), join: true };
  // The runtime accepts it (joining re-floats the stranded cyan charges)…
  expect(resolveAction(s, joinLaunch).accepted).toBe(true);
  // A settle-first launch is also a legal tap now: the player may take the
  // risky move. Overflow parks nobody extra and the pass loses.
  const settle = resolveAction(s, T(0));
  expect(settle.accepted).toBe(true);
  expect(settle.state.status).toBe('lost');
  expect(settle.state.holding.map((c) => c.id)).toEqual(s.holding.map((c) => c.id));
  expect(legalActions(s).map((a) => a.id)).toContain('tunnel-0');
  // The concurrent solver must still see the join — this is the fix.
  expect(enumerateActions(s, 'metrics').map(key)).toContain('tunnel:tunnel-0:J');

  assertConsistent(s, 'repro-full-tray');
});

test('M4A repro — the reverse: an enumerated join is never one resolveAction rejects', () => {
  // Drive a few more moves from the full-tray state and check the invariant at
  // every step — the old enumeration could emit a join that overflowed on the
  // joined re-simulation.
  let s = fullTrayState();
  const seen = new Set<string>();
  const stack: GameState[] = [s];
  let checked = 0;
  while (stack.length && checked < 400) {
    s = stack.pop()!;
    const k = stateKey(s);
    if (seen.has(k)) continue;
    seen.add(k);
    checked += 1;
    assertConsistent(s, `repro-deep#${checked}`);
    if (s.status !== 'playing') continue;
    for (const a of enumerateActions(s, 'metrics')) {
      const out = resolveAction(s, a);
      if (out.accepted && stack.length < 300) stack.push(out.state);
    }
  }
  expect(checked).toBeGreaterThan(5);
});

// ── parameterized coverage across representative states ─────────────────────

const FIXTURES: { name: string; level: LevelDefinition; setup: GameAction[] }[] = [
  { name: 'fresh board, no epoch', level: LEVEL_DEFINITIONS[0]!, setup: [] },
  { name: 'one charge orbiting', level: LEVEL_DEFINITIONS[4]!, setup: [T(1)] },
  { name: 'two stranded, epoch open', level: LEVEL_DEFINITIONS[4]!, setup: [T(1), T(1)] },
  { name: 'full Holding tray', level: LEVEL_DEFINITIONS[4]!, setup: [T(1), T(1), T(2), T(2)] },
  { name: 'Frozen board mid-solve', level: LEVEL_DEFINITIONS[25]!, setup: [T(0)] }, // The Frozen Lantern
  { name: 'Frozen board settled', level: LEVEL_DEFINITIONS[20]!, setup: [T(0), T(1)] }, // First Frost
];

test.each(FIXTURES)('admission is consistent — $name', ({ level, setup }) => {
  let s = createGame(level);
  for (const a of setup) {
    const out = resolveAction(s, a);
    if (!out.accepted) break;
    s = out.state;
  }
  assertConsistent(s, level.title);

  // enumerateActions is exactly legalActions(includeJoin) — no private logic.
  expect(enumerateActions(s, 'metrics').map(key).sort())
    .toEqual(legalActions(s, { includeJoin: true }).map(key).sort());
  expect(enumerateActions(s, 'sequential-compat').map(key).sort())
    .toEqual(legalActions(s).map(key).sort());
});

// ── whole-campaign reachable-state sweep ────────────────────────────────────

test.each(LEVEL_DEFINITIONS)('level $id — enumerate ⟺ accept on every reachable state', (def) => {
  const seen = new Set<string>();
  const stack: GameState[] = [createGame(def)];
  let visited = 0;
  while (stack.length && visited < 3500) {
    const s = stack.pop()!;
    const k = stateKey(s);
    if (seen.has(k)) continue;
    seen.add(k);
    visited += 1;
    assertConsistent(s, `L${def.id}#${visited}`);
    if (s.status !== 'playing') continue;
    for (const a of enumerateActions(s, 'metrics')) {
      const out = resolveAction(s, a);
      if (out.accepted && stack.length < 2500) stack.push(out.state);
    }
  }
  expect(visited).toBeGreaterThan(1);
}, 180_000);

// ── candidateActions is the one generator both sides build on ───────────────

test('candidateActions covers every launch, and every join only when it can join', () => {
  const s = fullTrayState();
  const cand = candidateActions(s, true);
  // one plain launch per tunnel-with-a-queue + per held charge
  const plainCount = s.tunnels.filter((t) => t.queue.length).length + s.holding.length;
  expect(cand.filter((a) => !a.join)).toHaveLength(plainCount);
  // every join variant corresponds to a charge canJoinEpoch actually allows
  for (const a of cand.filter((x) => x.join)) {
    const id = a.kind === 'tunnel' ? s.tunnels.find((t) => t.id === a.id)!.queue[0]!.id : a.id;
    expect(canJoinEpoch(s, id)).toBe(true);
  }
  // no epoch ⇒ no join variants ever
  expect(candidateActions(createGame(LEVEL_DEFINITIONS[0]!), true).every((a) => !a.join)).toBe(true);
});
