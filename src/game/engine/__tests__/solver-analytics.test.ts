/**
 * M3B solver extensions: per-first-move breakdown, branching factor, and
 * partial (node-cap-truncated) results.
 */
import { NodeCapExceeded, solve } from '../solver';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';

const L = (id: number) => LEVEL_DEFINITIONS[id - 1]!;

test('firstMoves has one entry per legal first action, all solvable for the campaign', () => {
  const r = solve(L(1), { mode: 'sequential-compat' });
  expect(r.firstMoves).toHaveLength(r.totalFirstMoves);
  expect(r.totalFirstMoves).toBe(3);
  expect(r.firstMoves.every((m) => m.solvable)).toBe(true);
  expect(r.viableFirstMoves).toBe(3);
});

test('the shortest win equals one move plus the best solvable first-move continuation', () => {
  for (const id of [1, 2, 3, 5, 9]) {
    const r = solve(L(id), { mode: 'sequential-compat' });
    const best = Math.min(...r.firstMoves.filter((m) => m.solvable).map((m) => m.winLength));
    expect(r.length).toBe(best + 1);
  }
}, 120_000);

test('first-move line metrics are consistent with the overall witness bounds', () => {
  const r = solve(L(6));
  for (const m of r.firstMoves) {
    if (!m.solvable) {
      expect(m.winLength).toBe(0);
      expect(m.minPeakHolding).toBe(-1);
      continue;
    }
    expect(m.peakHoldingOnLine).toBeLessThanOrEqual(r.maxHolding);
    expect(m.minPeakHolding).toBeGreaterThanOrEqual(0);
    expect(m.minPeakHolding).toBeLessThanOrEqual(m.peakHoldingOnLine);
  }
}, 120_000);

test('avgBranching is > 1 and deterministic', () => {
  const a = solve(L(4));
  const b = solve(L(4));
  expect(a.avgBranching).toBeGreaterThan(1);
  expect(a.avgBranching).toBe(b.avgBranching);
}, 120_000);

test('the whole result is deterministic (deep-equal across runs)', () => {
  const a = solve(L(5), { mode: 'sequential-compat' });
  const b = solve(L(5), { mode: 'sequential-compat' });
  expect(a).toEqual(b);
}, 120_000);

describe('node-cap semantics', () => {
  test('a tiny cap throws NodeCapExceeded by default', () => {
    expect(() => solve(L(9), { nodeCap: 3 })).toThrow(NodeCapExceeded);
    expect(() => solve(L(9), { nodeCap: 3 })).toThrow(/exceeded 3 states/);
  });

  test('partialOnCap salvages counters and never reports a false "solved"', () => {
    const r = solve(L(9), { nodeCap: 3, partialOnCap: true });
    expect(r.complete).toBe(false);
    expect(r.nodeCapHit).toBe(true);
    expect(r.solved).toBe(false);          // unknown, not a false positive
    expect(r.nodes).toBeGreaterThan(0);
    expect(r.firstMoves).toEqual([]);
  });

  test('a generous cap completes normally', () => {
    const r = solve(L(9));
    expect(r.complete).toBe(true);
    expect(r.nodeCapHit).toBe(false);
    expect(r.solved).toBe(true);
  }, 120_000);
});
