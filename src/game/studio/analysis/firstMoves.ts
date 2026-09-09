/**
 * Deterministic first-move classification. No vague judgement — three rules
 * against documented thresholds.
 *
 *   DEAD-END   — no solution exists after this move.
 *   DANGEROUS  — solvable, but materially worse than the best solvable sibling
 *                on at least one of: continuation length, peak Holding, or
 *                subtree loss probability.
 *   VIABLE     — solvable and not materially worse (this includes the best move).
 */
import type { FirstMoveClass } from './types';

export const FIRST_MOVE_THRESHOLDS = {
  /** DANGEROUS if the continuation is ≥ this many moves longer than the best sibling. */
  extraLength: 3,
  /** …or needs ≥ this much more peak Holding. */
  extraPeakHolding: 1,
  /** …or raises subtree loss probability by ≥ this much. */
  extraLoss: 0.15,
} as const;

export interface FirstMoveMetrics {
  solvable: boolean;
  /** Shortest remaining win length after the move. */
  winLength: number;
  /** Peak Holding replaying the shortest continuation. */
  peakHolding: number;
  /** Loss probability of the subtree after the move. */
  lossAfter: number;
}

/** Ascending preference: shorter, then less Holding, then safer. */
export function isBetterFirstMove(a: FirstMoveMetrics, b: FirstMoveMetrics): boolean {
  if (a.winLength !== b.winLength) return a.winLength < b.winLength;
  if (a.peakHolding !== b.peakHolding) return a.peakHolding < b.peakHolding;
  return a.lossAfter <= b.lossAfter;
}

export function classifyFirstMove(
  move: FirstMoveMetrics,
  best: FirstMoveMetrics | null,
): { classification: FirstMoveClass; reasons: string[] } {
  if (!move.solvable) return { classification: 'DEAD-END', reasons: ['no solution after this move'] };
  if (!best) return { classification: 'VIABLE', reasons: [] };

  const reasons: string[] = [];
  const dLen = move.winLength - best.winLength;
  const dPeak = move.peakHolding - best.peakHolding;
  const dLoss = move.lossAfter - best.lossAfter;
  if (dLen >= FIRST_MOVE_THRESHOLDS.extraLength) reasons.push(`+${dLen} moves vs best line`);
  if (dPeak >= FIRST_MOVE_THRESHOLDS.extraPeakHolding) reasons.push(`+${dPeak} peak Holding vs best line`);
  if (dLoss >= FIRST_MOVE_THRESHOLDS.extraLoss) reasons.push(`+${dLoss.toFixed(2)} loss probability vs best line`);

  return reasons.length > 0
    ? { classification: 'DANGEROUS', reasons }
    : { classification: 'VIABLE', reasons: [] };
}

/** Classify a whole set of first moves against their own best solvable member. */
export function classifyFirstMoves(
  moves: FirstMoveMetrics[],
): { classification: FirstMoveClass; reasons: string[] }[] {
  const solvable = moves.filter((m) => m.solvable);
  const best = solvable.length > 0
    ? solvable.reduce((a, b) => (isBetterFirstMove(a, b) ? a : b))
    : null;
  return moves.map((m) => classifyFirstMove(m, m === best ? null : best));
}
