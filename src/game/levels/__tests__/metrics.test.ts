import { solve } from '../../engine/__tests__/solver';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';
test.each(LEVEL_DEFINITIONS)('level $id manual-Holding audit', (level) => {
  const result = solve(level);
  if (process.env.REPORT_METRICS) console.log(JSON.stringify({ id: level.id, pixels: level.pixelArt.join('').replace(/\./g, '').length, ...result }));
  expect(result.solved).toBe(true);
  expect(result.complete).toBe(true);
  expect(result.failPath !== null).toBe(level.id >= 5);
  expect(result.viableFirstMoves).toBe(3);
  if (level.id <= 2) expect(result.maxHolding).toBe(0);
  if (level.id === 3) { expect(result.minWinningPeak).toBe(0); expect(result.maxHolding).toBe(1); }
  if (level.id >= 4) expect(result.heldLaunches).toBeGreaterThan(0);
}, 120_000);

test('Levels 6-8 increase sequencing pressure', () => {
  const results = LEVEL_DEFINITIONS.slice(5, 8).map((level) => solve(level));
  expect(results[1]!.lossProbability).toBeGreaterThan(results[0]!.lossProbability);
  expect(results[2]!.lossProbability).toBeGreaterThan(results[1]!.lossProbability);
});
