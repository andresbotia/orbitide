import { solve } from '../../engine/solver';
import { analyzeLevel } from '../../studio/analysis/analyzeLevel';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';

const TIER_INDEX: Record<string, number> = { easy: 0, medium: 1, hard: 2, 'super-hard': 3, extreme: 4 };

/**
 * Production-campaign audit: every level must stay winnable with zero boosters.
 * There is one play model to check — under FIRST LAUNCHED, FIRST SERVED a launch
 * that joins Pals on the rail resolves exactly like one made after it settles,
 * so the old "sequential" and "concurrent" solves are the same search.
 */
test.each(LEVEL_DEFINITIONS)('level $id — solves, no booster needed', (level) => {
  const r = solve(level);
  if (process.env.REPORT_METRICS) {
    console.log(JSON.stringify({
      id: level.id, title: level.title,
      len: r.length, peak: r.minWinningPeak, loss: +r.lossProbability.toFixed(3), held: r.heldLaunches,
    }));
  }
  expect(r.solved).toBe(true);
  expect(r.complete).toBe(true);
  expect(r.viableFirstMoves).toBeGreaterThanOrEqual(1);
  // The best line never blows past the tray.
  expect(r.minWinningPeak).toBeLessThanOrEqual(3);
}, 120_000);

test('the World 1 Holding curve is gentle then rising (Parts 6-7)', () => {
  const w1 = LEVEL_DEFINITIONS.filter((l) => l.themeId === 'first-light').map((l) => solve(l));
  if (w1.length < 3) return;
  // L1-L3: no meaningful Holding pressure on the calm line.
  for (let i = 0; i < 3; i += 1) expect(w1[i]!.minWinningPeak).toBe(0);
  // The World-1 finale is the hardest level in the world.
  const scores = w1.map((r) => r.lossProbability + r.minWinningPeak / 3);
  expect(Math.max(...scores)).toBe(scores[scores.length - 1]);
}, 180_000);

test('authored difficulty never sits two tiers below the solver suggestion', async () => {
  for (const level of LEVEL_DEFINITIONS) {
    const a = await analyzeLevel(level, { nodeCap: 250_000, now: () => 0 });
    if (a.solvable !== true) continue;
    const gap = TIER_INDEX[a.suggestedDifficulty]! - TIER_INDEX[level.difficulty]!;
    // A level may be authored gentler than it plays for onboarding reasons, but
    // never harder-than-labelled by two whole tiers (Part 18).
    expect(gap).toBeLessThanOrEqual(1);
  }
// The complete 100-level campaign takes roughly 12 minutes on the reference
// development machine. This is a final-gate audit; keep its production node cap
// intact and allow enough wall time for slower CI hosts.
}, 1_200_000);
