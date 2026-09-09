/**
 * Advisory, deterministic difficulty model. A weighted sum of normalised solver
 * features → a 0–100 score → a suggested tier. The authored difficulty is NEVER
 * overwritten; the score only advises and, on a material disagreement, warns.
 *
 * FORMULA
 *   factor_i        ∈ [0, 1]   (see `difficultyFactors`)
 *   contribution_i  = DIFFICULTY_WEIGHTS[i] × factor_i × 100
 *   score           = round( Σ contribution_i )                    ∈ [0, 100]
 *   suggestedTier   = highest TIER_THRESHOLDS entry with score ≥ min
 */
import type { LevelDifficulty } from '@/game/engine/types';

/** Weights sum to 1.00. Change here, nowhere else. */
export const DIFFICULTY_WEIGHTS = {
  /** Min achievable peak Holding on the best winning line, over holding capacity. */
  holdingPressure: 0.22,
  /** Loss probability under uniform random play. */
  lossProbability: 0.20,
  /** 1 − (viable first moves / total first moves) — how narrow move 1 is. */
  narrowFirstMoves: 0.16,
  /** Explicit held-charge relaunches the best line needs. */
  heldRelaunches: 0.12,
  /** Shortest winning length. */
  winningLength: 0.11,
  /** Clears required before the deepest-buried colour first becomes reachable. */
  exposureDepth: 0.10,
  /** How much shorter the concurrent solution is than the sequential one. */
  concurrencyGap: 0.05,
  /** Explored solver nodes (log scale) — a proxy for search difficulty. */
  solverNodes: 0.04,
} as const;

/** Feature value that maps to factor 1.0. */
export const DIFFICULTY_SATURATION = {
  winningLength: 14,
  heldRelaunches: 3,
  exposureDepth: 14,
  concurrencyGap: 4,
  solverNodes: 60_000,
} as const;

/** Ascending score thresholds → tier. */
export const TIER_THRESHOLDS: { tier: LevelDifficulty; min: number }[] = [
  { tier: 'easy', min: 0 },
  { tier: 'medium', min: 20 },
  { tier: 'hard', min: 42 },
  { tier: 'super-hard', min: 63 },
  { tier: 'extreme', min: 82 },
];

export const TIER_INDEX: Record<LevelDifficulty, number> = {
  easy: 0, medium: 1, hard: 2, 'super-hard': 3, extreme: 4,
};

export const TIER_ORDER: LevelDifficulty[] = ['easy', 'medium', 'hard', 'super-hard', 'extreme'];

export interface DifficultyFeatures {
  /** Min achievable peak Holding on a winning line. */
  minWinningPeak: number;
  holdingCapacity: number;
  lossProbability: number;
  viableFirstMoves: number;
  totalFirstMoves: number;
  heldRelaunches: number;
  winningLength: number;
  exposureDepth: number;
  /** seq.length − con.length (clamped ≥ 0). */
  concurrencyGap: number;
  nodes: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function difficultyFactors(f: DifficultyFeatures): Record<string, number> {
  return {
    holdingPressure: clamp01(f.minWinningPeak / Math.max(1, f.holdingCapacity)),
    lossProbability: clamp01(f.lossProbability),
    narrowFirstMoves: f.totalFirstMoves > 0 ? clamp01(1 - f.viableFirstMoves / f.totalFirstMoves) : 0,
    heldRelaunches: clamp01(f.heldRelaunches / DIFFICULTY_SATURATION.heldRelaunches),
    winningLength: clamp01(f.winningLength / DIFFICULTY_SATURATION.winningLength),
    exposureDepth: clamp01(f.exposureDepth / DIFFICULTY_SATURATION.exposureDepth),
    concurrencyGap: clamp01(Math.max(0, f.concurrencyGap) / DIFFICULTY_SATURATION.concurrencyGap),
    solverNodes: clamp01(Math.log10(Math.max(1, f.nodes)) / Math.log10(DIFFICULTY_SATURATION.solverNodes)),
  };
}

export interface DifficultyScore {
  score: number;
  tier: LevelDifficulty;
  factors: Record<string, number>;
  contributions: Record<string, number>;
}

export function scoreDifficulty(f: DifficultyFeatures): DifficultyScore {
  const factors = difficultyFactors(f);
  const contributions: Record<string, number> = {};
  let score = 0;
  for (const [key, weight] of Object.entries(DIFFICULTY_WEIGHTS)) {
    const c = weight * (factors[key] ?? 0) * 100;
    contributions[key] = c;
    score += c;
  }
  const rounded = Math.round(score);
  const tier = [...TIER_THRESHOLDS].reverse().find((t) => rounded >= t.min)?.tier ?? 'easy';
  return { score: rounded, tier, factors, contributions };
}

/** Signed tier distance: suggested − authored (0 = agree, negative = over-labelled). */
export function tierDistance(authored: LevelDifficulty, suggested: LevelDifficulty): number {
  return TIER_INDEX[suggested] - TIER_INDEX[authored];
}
