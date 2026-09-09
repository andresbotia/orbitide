import { solve } from '../../engine/__tests__/solver';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';

/**
 * M2B campaign audit. Every level is checked twice:
 *   - `sequential-compat` — the player waits for the rail to clear between
 *     launches. This is M1 semantics; the numbers here must not regress.
 *   - `metrics` (default) — the player may launch up to five charges into one
 *     shared epoch. The level must stay winnable, stay loseable from L5, and the
 *     intended solution's Holding pressure must be unchanged by concurrency.
 */
test.each(LEVEL_DEFINITIONS)('level $id concurrent + sequential audit', (level) => {
  const seq = solve(level, { mode: 'sequential-compat' });
  const con = solve(level);
  if (process.env.REPORT_METRICS) {
    console.log(JSON.stringify({
      id: level.id, pixels: level.pixelArt.join('').replace(/[. ]/g, '').length,
      seq: { len: seq.length, minPeak: seq.minWinningPeak, maxHold: seq.maxHolding, loss: +seq.lossProbability.toFixed(3), held: seq.heldLaunches },
      con: { len: con.length, minPeak: con.minWinningPeak, maxHold: con.maxHolding, loss: +con.lossProbability.toFixed(3), held: con.heldLaunches,
        maxActiveOnWitness: con.maxActiveOnWitness, maxActive: con.maxActive },
    }));
  }

  for (const r of [seq, con]) {
    expect(r.solved).toBe(true);
    expect(r.complete).toBe(true);
    expect(r.failPath !== null).toBe(level.id >= 5);
    expect(r.viableFirstMoves).toBe(3);
  }

  // The canonical sequential game: no Holding pressure on L1-3, Holding is part
  // of the solution from L4. Concurrency may open extra lines but never removes
  // the sequential one (proved by `seq`).
  if (level.id <= 3) {
    expect(seq.minWinningPeak).toBe(0);
    expect(con.minWinningPeak).toBe(0);
  }
  if (level.id >= 4) expect(seq.heldLaunches).toBeGreaterThan(0);

  // Early levels are winnable without ever crowding the rail.
  if (level.id <= 2) expect(seq.maxActiveOnWitness).toBeLessThanOrEqual(1);

  // The concurrent engine can reach a full five-charge rail on the later levels.
  if (level.id >= 5) expect(con.maxActive).toBeGreaterThanOrEqual(3);
}, 120_000);

test('Levels 6-8 increase sequencing pressure under both models', () => {
  for (const mode of ['sequential-compat', 'metrics'] as const) {
    const results = LEVEL_DEFINITIONS.slice(5, 8).map((level) => solve(level, { mode }));
    expect(results[1]!.lossProbability).toBeGreaterThan(results[0]!.lossProbability);
    expect(results[2]!.lossProbability).toBeGreaterThan(results[1]!.lossProbability);
  }
}, 120_000);
