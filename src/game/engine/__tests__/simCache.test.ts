/**
 * Simulation cache: identity and bounds.
 *
 * `resolveEpochLaunch` memoizes one launch's lap on one board. Physics must never
 * leak between boards: the cache holds a single IMMUTABLE board identity — its
 * shape, colours and authored modifiers — at a time, not just a level id plus
 * per-cell progress. `boardFingerprint` deliberately records only progress
 * (cleared / iced / shielded / primed) and never a cell's colour or coordinate,
 * so two same-shaped boards fingerprint identically. Before
 * `GameState.boardIdentity`, a key of `levelId + fingerprint` let a synthetic
 * fixture or an unsaved Level Studio draft reuse an unrelated board's physics —
 * a blue charge "cleared" four yellow pixels.
 *
 * The cache is bounded: a board switch empties it, and it is an LRU capped at
 * `SIM_CACHE_LIMIT` entries (it used to be global and grow to 250k).
 */
import { createGame } from '../createGame';
import { resolveAction } from '../resolveLaunch';
import { resolveEpochLaunch, SIM_CACHE_LIMIT, simCacheSize, simulateEpoch } from '../epoch';
import type { EpochLaunch, LevelDefinition, PixelModifierMap } from '../types';

const SHARED_ID = 9931;

const base = {
  id: SHARED_ID, title: 'Cache identity', themeId: 'test',
  difficulty: 'easy' as const, holdingCapacity: 3, ruleset: 'coreV2' as const,
};
const tunnels: LevelDefinition['tunnels'] = [
  [{ color: 'blue', capacity: 4 }], [{ color: 'blue', capacity: 1 }],
  [{ color: 'blue', capacity: 1 }], [{ color: 'blue', capacity: 1 }],
];
const level = (pixelArt: string[], modifiers?: PixelModifierMap): LevelDefinition =>
  ({ ...base, tunnels, pixelArt, ...(modifiers ? { modifiers } : {}) });

const hits = (def: LevelDefinition) =>
  resolveAction(createGame(def), { kind: 'tunnel', id: 'tunnel-0' })
    .epochCharges![0]!.encounters.map((e) => e.pixelId);

test('two boards sharing a levelId and shape but not colours do not share physics', () => {
  // Order matters: the all-blue board populates the cache first.
  const allBlue = hits(level(['BBB', 'BBB', 'BBB']));
  const allYellow = hits(level(['YYY', 'YYY', 'YYY']));

  expect(allBlue).toHaveLength(4);
  // A blue charge on an all-yellow board has no legal target at all.
  expect(allYellow).toEqual([]);
});

test('the collision is symmetric — the yellow board must not poison the blue one either', () => {
  const allYellow = hits(level(['YYY', 'YYY', 'YYY']));
  const allBlue = hits(level(['BBB', 'BBB', 'BBB']));

  expect(allYellow).toEqual([]);
  expect(allBlue).toHaveLength(4);
});

test('same shape and colours but different authored modifiers keep distinct identities', () => {
  // Authored modifiers already reached the old key via `boardFingerprint`, which
  // encodes ice/shield/link state per cell. Identity covers them too, so the two
  // never alias even once every shell has been broken and the fingerprints
  // converge.
  const plain = createGame(level(['BBB', 'BBB', 'BBB']));
  const frozen = createGame(level(['BBB', 'BBB', 'BBB'], { '0,0': { kind: 'frozen', level: 1 } }));
  expect(frozen.boardIdentity).not.toBe(plain.boardIdentity);
});

test('a board that differs only in one cell colour keeps a distinct identity', () => {
  const a = createGame(level(['BBB', 'BBB', 'BBB']));
  const b = createGame(level(['BBB', 'BYB', 'BBB']));
  expect(a.boardIdentity).not.toBe(b.boardIdentity);
});

test('boards differing only in size keep distinct identities', () => {
  expect(createGame(level(['BBB', 'BBB', 'BBB'])).boardIdentity)
    .not.toBe(createGame(level(['BBBB', 'BBBB', 'BBBB', 'BBBB'])).boardIdentity);
});

test('an identical board reuses the cache and returns the identical resolution', () => {
  const a = createGame(level(['BYB', 'YBY', 'BYB']));
  const b = createGame(level(['BYB', 'YBY', 'BYB']));
  expect(a.boardIdentity).toBe(b.boardIdentity);

  const launch: EpochLaunch = {
    chargeId: 'c0', source: 'tunnel', originId: 'tunnel-0', color: 'blue',
    capacity: 4, insertionTime: 0, launchSequence: 0,
  };
  const ra = simulateEpoch(a, [launch]);
  const rb = simulateEpoch(b, [launch]);
  expect(rb.charges[0]!.encounters).toEqual(ra.charges[0]!.encounters);
  // Cache hit: the memoized physics object is shared, only identity is relabelled.
  expect(rb.pixels).toBe(ra.pixels);
});

// ── bounds ──────────────────────────────────────────────────────────────────

const blue = (capacity: number, extra: Partial<EpochLaunch> = {}): EpochLaunch => ({
  chargeId: `c${capacity}`, source: 'tunnel', originId: 'tunnel-0', color: 'blue',
  capacity, insertionTime: 0, launchSequence: 0, ...extra,
});

test('the cache holds one board at a time: resolving on another board empties it', () => {
  resolveEpochLaunch(createGame(level(['BBB', 'BBB', 'BBB'])), blue(2));
  resolveEpochLaunch(createGame(level(['BBB', 'BBB', 'BBB'])), blue(3));
  expect(simCacheSize()).toBe(2);
  resolveEpochLaunch(createGame(level(['YYY', 'YYY', 'YYY'])), blue(2));
  expect(simCacheSize()).toBe(1);
});

test(`the cache is an LRU capped at ${SIM_CACHE_LIMIT} entries`, () => {
  const board = createGame(level(['BYB', 'YBY', 'BYB']));
  const kept = resolveEpochLaunch(board, blue(1));
  const evicted = resolveEpochLaunch(board, blue(2));
  for (let capacity = 3; capacity <= SIM_CACHE_LIMIT + 50; capacity += 1) {
    if (capacity % 1000 === 0) resolveEpochLaunch(board, blue(1)); // keep it recently used
    resolveEpochLaunch(board, blue(capacity));
  }
  expect(simCacheSize()).toBe(SIM_CACHE_LIMIT);
  // Physics objects are shared on a hit, so identity tells hit from recompute.
  expect(resolveEpochLaunch(board, blue(1)).pixels).toBe(kept.pixels);
  expect(resolveEpochLaunch(board, blue(2)).pixels).not.toBe(evicted.pixels);
});

test('the key is physics only: the same Pal from a tunnel or from Holding shares one entry, relabelled', () => {
  const board = createGame(level(['BYB', 'YBY', 'BYB']));
  const fromTunnel = resolveEpochLaunch(board, blue(3, { chargeId: 'x', originId: 'tunnel-2', launchSequence: 4 }));
  const fromHolding = resolveEpochLaunch(board, blue(3, { chargeId: 'y', source: 'holding', originId: 'y', launchSequence: 9 }));
  expect(fromHolding.pixels).toBe(fromTunnel.pixels);
  expect(fromHolding.charge.encounters).toEqual(fromTunnel.charge.encounters);
  expect([fromHolding.charge.id, fromHolding.charge.source, fromHolding.charge.originId, fromHolding.charge.launchSequence])
    .toEqual(['y', 'holding', 'y', 9]);
  expect([fromTunnel.charge.id, fromTunnel.charge.source, fromTunnel.charge.originId, fromTunnel.charge.launchSequence])
    .toEqual(['x', 'tunnel', 'tunnel-2', 4]);
});
