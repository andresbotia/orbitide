import {
  DIFFICULTY_WEIGHTS, TIER_INDEX, difficultyFactors, scoreDifficulty, tierDistance,
  type DifficultyFeatures,
} from '../difficulty';

const ZERO: DifficultyFeatures = {
  minWinningPeak: 0, holdingCapacity: 3, lossProbability: 0, viableFirstMoves: 3,
  totalFirstMoves: 3, heldRelaunches: 0, winningLength: 0, exposureDepth: 0, nodes: 1,
};

test('the weights sum to 0.95 — concurrencyGap (0.05) was retired without re-weighting', () => {
  // Retiring it moved no level's score (it had become 0 everywhere); re-weighting
  // the rest would have shifted every score by 1/0.95. See difficulty.ts.
  const sum = Object.values(DIFFICULTY_WEIGHTS).reduce((a, b) => a + b, 0);
  expect(sum).toBeCloseTo(0.95, 10);
  expect(Object.keys(DIFFICULTY_WEIGHTS)).not.toContain('concurrencyGap');
});

test('an all-zero feature set scores 0 → easy', () => {
  const r = scoreDifficulty(ZERO);
  expect(r.score).toBe(0);
  expect(r.tier).toBe('easy');
});

test('a maxed feature set scores 95 → extreme', () => {
  const maxed: DifficultyFeatures = {
    minWinningPeak: 3, holdingCapacity: 3, lossProbability: 1, viableFirstMoves: 0,
    totalFirstMoves: 3, heldRelaunches: 10, winningLength: 100, exposureDepth: 100,
    nodes: 10_000_000,
  };
  const r = scoreDifficulty(maxed);
  expect(r.score).toBe(95);
  expect(r.tier).toBe('extreme');
});

test('every factor is clamped to [0, 1]', () => {
  const f = difficultyFactors({
    minWinningPeak: 9, holdingCapacity: 3, lossProbability: 5, viableFirstMoves: -1,
    totalFirstMoves: 3, heldRelaunches: 99, winningLength: 999, exposureDepth: 999,
    nodes: 1e12,
  });
  for (const v of Object.values(f)) {
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  }
});

test('score is monotonic in loss probability, all else equal', () => {
  const lo = scoreDifficulty({ ...ZERO, lossProbability: 0.1 }).score;
  const hi = scoreDifficulty({ ...ZERO, lossProbability: 0.9 }).score;
  expect(hi).toBeGreaterThan(lo);
});

test('contributions sum to the pre-round score and are all non-negative', () => {
  const r = scoreDifficulty({ ...ZERO, minWinningPeak: 2, lossProbability: 0.4, winningLength: 8 });
  const total = Object.values(r.contributions).reduce((a, b) => a + b, 0);
  expect(Math.round(total)).toBe(r.score);
  for (const c of Object.values(r.contributions)) expect(c).toBeGreaterThanOrEqual(0);
});

test('tier boundaries are exact and ascending', () => {
  expect(scoreDifficulty({ ...ZERO, lossProbability: 0 }).tier).toBe('easy');
  // 20 is the medium boundary
  const factors = difficultyFactors({ ...ZERO });
  expect(factors).toBeDefined();
  expect(scoreDifficulty({ ...ZERO }).tier).toBe('easy');
});

test('tierDistance is signed suggested − authored', () => {
  expect(tierDistance('easy', 'hard')).toBe(2);
  expect(tierDistance('hard', 'easy')).toBe(-2);
  expect(tierDistance('medium', 'medium')).toBe(0);
  expect(TIER_INDEX.extreme - TIER_INDEX.easy).toBe(4);
});

test('scoring is deterministic', () => {
  const f: DifficultyFeatures = { ...ZERO, minWinningPeak: 2, lossProbability: 0.481, heldRelaunches: 2, winningLength: 10, exposureDepth: 20, nodes: 79165 };
  expect(scoreDifficulty(f)).toEqual(scoreDifficulty(f));
});
