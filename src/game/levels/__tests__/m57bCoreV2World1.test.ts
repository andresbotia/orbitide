/**
 * M5.7B — Core V2 Levels 1–10 vertical slice.
 * Uses the real engine, M5.6 metrics, and a greedy max-hits policy for
 * longer boards whose concurrent exhaustive search hits the node cap.
 */
import { legalActions, type GameAction } from '@/game/engine/actions';
import { createGame } from '@/game/engine/createGame';
import { resolveAction, resolveLaunch } from '@/game/engine/resolveLaunch';
import { resolveHoldingLaunch } from '@/game/engine/resolveHolding';
import { findFirstWinningWitness, solve } from '@/game/engine/solver';
import type { LevelDefinition } from '@/game/engine/types';
import { evaluateRoundRobinSpam } from '@/game/studio/analysis/antiSpam';
import { boardMetrics } from '@/game/studio/analysis/boardMetrics';
import { directionalGeometry } from '@/game/studio/analysis/directionalGeometry';
import { queueMetrics } from '@/game/studio/analysis/queueMetrics';
import { inspectCoreLevel1TutorialFit, pickIntendedTutorialLaunch } from '@/game/tutorial/coreLevel1';
import { LEVEL_DEFINITIONS as LEGACY_LEVEL_DEFINITIONS } from '../levelDefinitions';
import { COMPILED_LEVELS as CORE_V2_WORLD_1 } from '../compiledWorld1';
import { getLevel, LEVEL_DEFINITIONS } from '../levels';

const WORLD_1 = CORE_V2_WORLD_1.filter((l) => l.id >= 1 && l.id <= 10);
const TITLES = [
  'First Spark', 'Morning Kite', 'Sunrise Balloon', 'Dawn Windmill', 'Sunlit Bloom',
  'Rainbow Gate', 'Morning Hummingbird', 'Sunrise Lighthouse', 'Prismatic Peacock',
  'First Light Citadel',
] as const;

function replay(def: LevelDefinition, moves: GameAction[]) {
  let state = createGame(def);
  let peakH = 0;
  let peakA = 0;
  let relaunches = 0;
  for (const action of moves) {
    const outcome = resolveAction(state, action);
    expect(outcome.accepted).toBe(true);
    peakH = Math.max(peakH, outcome.state.holding.length);
    peakA = Math.max(peakA, outcome.epochCharges?.length ?? 0);
    if (action.kind === 'holding') relaunches += 1;
    state = outcome.state;
  }
  return { state, peakH, peakA, relaunches };
}

function pickMaxHits(
  state: ReturnType<typeof createGame>,
  includeJoin: boolean,
  joinCap = 99,
): GameAction | null {
  const active = state.epoch?.launches.length ?? 0;
  const legal = legalActions(state, { includeJoin }).filter((action) => {
    if (action.join === true && active >= joinCap) return false;
    return true;
  });
  if (legal.length === 0) return null;
  let best = legal[0]!;
  let bestHits = -1;
  for (const action of legal) {
    const outcome = resolveAction(state, action);
    if (!outcome.accepted) continue;
    const hits = outcome.pass?.encounters.length ?? 0;
    if (hits > bestHits || (hits === bestHits && action.join === true && best.join !== true)) {
      best = action;
      bestHits = hits;
    }
  }
  return best;
}

function greedyMaxHits(def: LevelDefinition, includeJoin: boolean, joinCap = 99): {
  moves: GameAction[]; peakH: number; peakA: number; relaunches: number; status: string;
} {
  const moves: GameAction[] = [];
  let state = createGame(def);
  let peakH = 0;
  let peakA = 0;
  let relaunches = 0;
  for (let steps = 0; steps < 80 && state.status === 'playing'; steps += 1) {
    const action = pickMaxHits(state, includeJoin, joinCap);
    if (!action) break;
    const outcome = resolveAction(state, action);
    if (!outcome.accepted) break;
    moves.push(action);
    if (action.kind === 'holding') relaunches += 1;
    peakH = Math.max(peakH, outcome.state.holding.length);
    peakA = Math.max(peakA, outcome.epochCharges?.length ?? 0);
    state = outcome.state;
  }
  return { moves, peakH, peakA, relaunches, status: state.status };
}

/** Intended L7 line: body 3-join, then join-capped greedy. */
function hummingbirdThreeJoinLine(def: LevelDefinition) {
  const opening: GameAction[] = [
    { kind: 'tunnel', id: 'tunnel-0' },
    { kind: 'tunnel', id: 'tunnel-1', join: true },
    { kind: 'tunnel', id: 'tunnel-2', join: true },
  ];
  const moves: GameAction[] = [];
  let state = createGame(def);
  let peakH = 0;
  let peakA = 0;
  let relaunches = 0;
  for (const action of opening) {
    const outcome = resolveAction(state, action);
    expect(outcome.accepted).toBe(true);
    moves.push(action);
    peakH = Math.max(peakH, outcome.state.holding.length);
    peakA = Math.max(peakA, outcome.epochCharges?.length ?? 0);
    state = outcome.state;
  }
  for (let steps = 0; steps < 80 && state.status === 'playing'; steps += 1) {
    const action = pickMaxHits(state, true, 3);
    if (!action) break;
    const outcome = resolveAction(state, action);
    if (!outcome.accepted) break;
    moves.push(action);
    if (action.kind === 'holding') relaunches += 1;
    peakH = Math.max(peakH, outcome.state.holding.length);
    peakA = Math.max(peakA, outcome.epochCharges?.length ?? 0);
    state = outcome.state;
  }
  return { moves, peakH, peakA, relaunches, status: state.status };
}

function pixelBudget(def: LevelDefinition) {
  const state = createGame(def);
  const need = new Map<string, number>();
  const have = new Map<string, number>();
  for (const p of state.pixels) need.set(p.color, (need.get(p.color) ?? 0) + 1);
  for (const t of def.tunnels) for (const c of t) have.set(c.color, (have.get(c.color) ?? 0) + c.capacity);
  return { need, have, pixels: state.pixels.length };
}

describe('M5.7B campaign wiring', () => {
  test('Core V2 World 1 replaces legacy 1–10 and leaves Legacy V1 definitions intact', () => {
    expect(WORLD_1).toHaveLength(10);
    expect(WORLD_1.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(WORLD_1.map((l) => l.title)).toEqual([...TITLES]);
    expect(WORLD_1.every((l) => l.replacesLegacy === true)).toBe(true);
    expect(WORLD_1.every((l) => l.ruleset === 'coreV2')).toBe(true);

    const shipped = LEVEL_DEFINITIONS.filter((l) => l.id >= 1 && l.id <= 10);
    expect(shipped.map((l) => l.title)).toEqual([...TITLES]);
    expect(shipped.every((l) => l.ruleset === 'coreV2')).toBe(true);
    expect(getLevel(1)?.title).toBe('First Spark');

    const legacy1 = LEGACY_LEVEL_DEFINITIONS.find((l) => l.id === 1)!;
    expect(legacy1.ruleset).toBeUndefined();
    expect(legacy1.title).toBe('First Light');
    expect(legacy1.tunnels).toHaveLength(3);
  });
});

describe('M5.7B per-level structure', () => {
  test.each(WORLD_1)('$id $title is Core V2 with exact budget and no special mechanics', (level) => {
    expect(level.ruleset).toBe('coreV2');
    expect(level.themeId).toBe('first-light');
    expect(level.holdingCapacity).toBe(4);
    expect(level.tunnels).toHaveLength(4);
    expect(level.modifiers).toBeUndefined();
    const { need, have } = pixelBudget(level);
    expect(have).toEqual(need);
    const state = createGame(level);
    expect(state.ruleset).toBe('coreV2');
    expect(state.tunnels).toHaveLength(4);
    expect(state.pixels.every((p) => p.modifier === undefined)).toBe(true);
  });
});

describe('BLOCK A — Levels 1–3', () => {
  test('Level 1 satisfies the Core Level 1 tutorial Holding/relaunch contract', () => {
    const def = WORLD_1[0]!;
    const fit = inspectCoreLevel1TutorialFit(def);
    expect(fit.ok).toBe(true);
    const intended = pickIntendedTutorialLaunch(def)!;
    expect(intended.tunnelId).toBe('tunnel-0');

    const first = resolveLaunch(createGame(def), intended.tunnelId);
    expect(first.accepted).toBe(true);
    expect(first.pass!.encounters.length).toBeGreaterThanOrEqual(1);
    expect(first.heldCharge).not.toBeNull();
    expect(first.heldCharge!.capacity).toBeGreaterThan(0);
    expect(first.state.status).toBe('playing');

    const golds = first.state.pixels.filter((p) => p.color === 'gold');
    expect(golds).toHaveLength(2);
    expect(golds.filter((p) => p.cleared)).toHaveLength(1);

    const relaunch = resolveHoldingLaunch(first.state, first.heldCharge!.id);
    expect(relaunch.accepted).toBe(true);
    expect(relaunch.pass!.encounters.length).toBeGreaterThanOrEqual(1);
    expect(relaunch.state.pixels.filter((p) => p.color === 'gold' && p.cleared)).toHaveLength(2);
    expect(relaunch.state.status).toBe('playing');
  });

  test.each(WORLD_1.slice(0, 3))('Level $id solves with a deterministic witness', (level) => {
    const first = findFirstWinningWitness(level, { nodeCap: 50_000, timeCapMs: 15_000 });
    expect(first.solved).toBe(true);
    expect(replay(level, first.moves).state.status).toBe('won');
    const r = solve(level, { mode: 'sequential-compat', nodeCap: 80_000, partialOnCap: true });
    expect(r.solved).toBe(true);
    expect(replay(level, r.moves).state.status).toBe('won');
  }, 30_000);

  test('Level 2 has a meaningful opening choice and cyan-first is more efficient', () => {
    const def = WORLD_1[1]!;
    const r = solve(def, { mode: 'sequential-compat', nodeCap: 80_000 });
    expect(r.solved).toBe(true);
    expect(r.totalFirstMoves).toBeGreaterThanOrEqual(2);
    expect(r.viableFirstMoves).toBeGreaterThanOrEqual(2);
    const cyan = r.firstMoves.find((m) => m.action.kind === 'tunnel' && m.action.id === 'tunnel-0');
    const red = r.firstMoves.find((m) => m.action.kind === 'tunnel' && m.action.id === 'tunnel-1');
    expect(cyan?.solvable).toBe(true);
    expect(red?.solvable).toBe(true);
    expect(cyan!.peakHoldingOnLine).toBeLessThanOrEqual(red!.peakHoldingOnLine);
  }, 30_000);

  test('Level 3 has buried rear targets (front/rear later-pass lesson)', () => {
    const def = WORLD_1[2]!;
    const geo = directionalGeometry(createGame(def));
    expect(geo.mode).toBe('coreV2');
    expect(geo.maxLayerDepth).toBeGreaterThanOrEqual(2);
    expect(geo.buried).toBeGreaterThan(0);
    const r = solve(def, { mode: 'sequential-compat', nodeCap: 80_000 });
    expect(r.solved).toBe(true);
    expect(r.heldLaunches).toBeGreaterThanOrEqual(0);
  }, 30_000);
});

describe('BLOCK B — Levels 4–7', () => {
  test('Level 4 has the required 3-way good/acceptable/premature opening', () => {
    const def = WORLD_1[3]!;
    const r = solve(def, { mode: 'sequential-compat', nodeCap: 80_000 });
    expect(r.solved).toBe(true);
    expect(r.totalFirstMoves).toBe(3);
    expect(r.viableFirstMoves).toBe(3);
    const t0 = r.firstMoves.find((m) => m.action.id === 'tunnel-0')!;
    const t1 = r.firstMoves.find((m) => m.action.id === 'tunnel-1')!;
    const t2 = r.firstMoves.find((m) => m.action.id === 'tunnel-2')!;
    expect(t0.solvable && t1.solvable && t2.solvable).toBe(true);
    // Red (T1) is efficient; gold (T0) acceptable; teal hub (T2) premature.
    expect(t1.winLength).toBeLessThanOrEqual(t0.winLength);
    expect(t2.winLength).toBeGreaterThanOrEqual(t1.winLength);
    expect(t2.peakHoldingOnLine).toBeGreaterThanOrEqual(t1.peakHoldingOnLine);
    expect(t2.heldRelaunchesOnLine).toBeGreaterThanOrEqual(t1.heldRelaunchesOnLine);
    expect(def.tunnels[2]![0]!.color).toBe('teal');
    expect(def.tunnels[2]![0]!.capacity).toBe(15);
  }, 30_000);

  test('Level 5 shows natural Holding pressure from layered geometry', () => {
    const def = WORLD_1[4]!;
    const geo = directionalGeometry(createGame(def));
    expect(geo.maxLayerDepth).toBeGreaterThanOrEqual(2);
    const greedy = greedyMaxHits(def, false);
    expect(greedy.status).toBe('won');
    expect(greedy.peakH).toBeGreaterThanOrEqual(1);
    expect(greedy.relaunches).toBeGreaterThanOrEqual(1);
    const spam = evaluateRoundRobinSpam(def);
    expect(spam.peakHolding).toBeGreaterThanOrEqual(greedy.peakH);
  }, 20_000);

  test('Level 6 uses 4 tunnels and queue-preview depth', () => {
    const def = WORLD_1[5]!;
    const q = queueMetrics(def);
    expect(q.tunnelCount).toBe(4);
    expect(q.minTunnelDepth).toBeGreaterThanOrEqual(2);
    expect(q.maxTunnelDepth).toBeGreaterThanOrEqual(3);
    expect(def.tunnels.filter((t) => t.length > 0)).toHaveLength(4);
    const greedy = greedyMaxHits(def, false);
    expect(greedy.status).toBe('won');
    const used = new Set(greedy.moves.filter((m) => m.kind === 'tunnel').map((m) => m.id));
    expect(used.size).toBe(4);
  }, 20_000);

  test('Level 7 intended 3-join line beats settle-first and does not prefer 5/5', () => {
    const def = WORLD_1[6]!;
    const intended = hummingbirdThreeJoinLine(def);
    const settle = greedyMaxHits(def, false);
    const fillFive = greedyMaxHits(def, true, 5);
    expect(intended.status).toBe('won');
    expect(settle.status).toBe('won');
    expect(fillFive.status).toBe('won');
    expect(intended.peakA).toBeGreaterThanOrEqual(3);
    expect(intended.peakA).toBeLessThan(5);
    expect(settle.peakA).toBe(1);
    // Concurrent body peel is shorter and calmer than single-Active settle.
    expect(intended.moves.length).toBeLessThan(settle.moves.length);
    expect(intended.peakH).toBeLessThanOrEqual(settle.peakH);
    // Filling 5/5 is not the preferred line.
    expect(fillFive.moves.length).toBeGreaterThanOrEqual(intended.moves.length);
    expect(replay(def, intended.moves).peakA).toBeGreaterThanOrEqual(3);
    expect(replay(def, intended.moves).state.status).toBe('won');
  }, 20_000);
});

describe('BLOCK C — Levels 8–10', () => {
  test('Level 8 greedy line alternates beacon / tower / waves regions', () => {
    const def = WORLD_1[7]!;
    const greedy = greedyMaxHits(def, true);
    expect(greedy.status).toBe('won');
    const tunnels = greedy.moves.filter((m) => m.kind === 'tunnel').map((m) => m.id);
    expect(tunnels).toContain('tunnel-0');
    expect(tunnels).toContain('tunnel-1');
    expect(tunnels).toContain('tunnel-3');
    const first = [...tunnels];
    const beacon = first.indexOf('tunnel-0');
    const waves = first.indexOf('tunnel-3');
    const tower = first.findIndex((id) => id === 'tunnel-1' || id === 'tunnel-2');
    expect(beacon).toBeGreaterThanOrEqual(0);
    expect(waves).toBeGreaterThanOrEqual(0);
    expect(tower).toBeGreaterThanOrEqual(0);
    // Not a trivial finish-waves → finish-tower → finish-beacon block.
    expect(Math.max(beacon, waves, tower) - Math.min(beacon, waves, tower)).toBeGreaterThan(1);
  }, 20_000);

  test('Level 9 round-robin fails, has a genuine trap, and requires Holding', () => {
    const def = WORLD_1[8]!;
    expect(def.difficulty).toBe('hard');
    expect(def.tunnels[0]![0]!.color).toBe('purple');
    const start = createGame(def);
    const trap = resolveLaunch(start, 'tunnel-0');
    expect(trap.accepted).toBe(true);
    expect(trap.pass!.encounters.length).toBe(0);
    expect(trap.heldCharge).not.toBeNull();

    const spam = evaluateRoundRobinSpam(def);
    expect(spam.outcome).not.toBe('won');

    const greedy = greedyMaxHits(def, true);
    expect(greedy.status).toBe('won');
    expect(greedy.peakH).toBeGreaterThanOrEqual(2);
    expect(greedy.relaunches).toBeGreaterThanOrEqual(1);
    expect(replay(def, greedy.moves).state.status).toBe('won');
  }, 20_000);

  test('Level 10 round-robin fails and uses Holding, relaunch, and multi-Pal play', () => {
    const def = WORLD_1[9]!;
    expect(def.difficulty).toBe('hard');
    const trap = resolveLaunch(createGame(def), 'tunnel-0');
    expect(trap.pass!.encounters.length).toBe(0);

    const spam = evaluateRoundRobinSpam(def);
    expect(spam.outcome).not.toBe('won');

    const greedy = greedyMaxHits(def, true);
    expect(greedy.status).toBe('won');
    expect(greedy.peakH).toBeGreaterThanOrEqual(2);
    expect(greedy.relaunches).toBeGreaterThanOrEqual(1);
    expect(greedy.peakA).toBeGreaterThanOrEqual(2);
    expect(replay(def, greedy.moves).state.status).toBe('won');
    const board = boardMetrics(def);
    expect(board.uniqueColors).toBeGreaterThanOrEqual(6);
    const geo = directionalGeometry(createGame(def));
    expect(geo.maxLayerDepth).toBeGreaterThanOrEqual(4);
  }, 20_000);
});

describe('M5.7B no special mechanics / no Levels 11+ edits', () => {
  test('World 1 has no Frozen/Shielded/Linked modifiers', () => {
    for (const level of WORLD_1) {
      expect(level.modifiers).toBeUndefined();
    }
  });

  test('compiled World 1 only contains ids 1–10', () => {
    expect(CORE_V2_WORLD_1.every((l) => l.id >= 1 && l.id <= 10)).toBe(true);
  });
});
