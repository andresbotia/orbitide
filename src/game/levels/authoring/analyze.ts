import { createGame } from '@/game/engine/createGame';
import type { LevelDefinition } from '@/game/engine/types';
import { analyzeLevel } from '@/game/studio/analysis/analyzeLevel';
import type { AntiSpamAssessment, LevelAnalysisReport } from './types';

export interface AnalysisOptions {
  nodeCap?: number;
}

/**
 * Assesses anti-spam resistance for an authored level.
 * Distinguishes intentional tutorial forgiveness (L1–L3) from undesirable
 * spam-vulnerability in puzzle / mid-to-late campaign levels.
 */
export function evaluateAntiSpam(
  def: LevelDefinition,
  metrics: {
    minWinningHoldingPeak: number;
    maxHoldingObserved: number;
    requiredHeldLaunches: number;
    lossProbability: number;
    failPathLength: number | null;
    viableFirstMoves: number;
    totalFirstMoves: number;
    totalTunnelDepth: number;
  },
): AntiSpamAssessment {
  // L1-L3 are intentionally safe introductory tutorial levels
  if (def.id <= 3 && def.difficulty === 'easy') {
    return {
      status: 'tutorial',
      riskScore: 0,
      riskFlags: [],
      recommendations: [],
    };
  }

  const riskFlags: string[] = [];
  const recommendations: string[] = [];
  let riskScore = 0;

  if (metrics.minWinningHoldingPeak === 0) {
    riskFlags.push('ZERO_HOLDING_PEAK');
    if (def.difficulty === 'hard' || def.difficulty === 'super-hard') {
      riskScore += 35;
      recommendations.push(
        'Bury an essential clearing color behind an off-color in a tunnel to enforce holding bay parking.',
      );
    } else if (def.difficulty === 'medium') {
      riskScore += 25;
    }
  }

  if (metrics.lossProbability < 0.05) {
    riskFlags.push('NEGLIGIBLE_LOSS_PROBABILITY');
    if (def.difficulty === 'hard' || def.difficulty === 'super-hard') {
      riskScore += 30;
      recommendations.push(
        'Tighten tunnel queue sequences so mindless button spamming overflows holding bay capacity.',
      );
    } else if (def.difficulty === 'medium') {
      riskScore += 20;
    }
  }

  if (metrics.failPathLength === null) {
    riskFlags.push('NO_FAIL_PATH');
    if (def.difficulty === 'hard' || def.difficulty === 'super-hard') {
      riskScore += 20;
    } else if (def.difficulty === 'medium') {
      riskScore += 15;
    }
  }

  if (metrics.viableFirstMoves === metrics.totalFirstMoves && metrics.totalFirstMoves > 1) {
    riskFlags.push('ALL_OPENINGS_VIABLE');
    if (def.difficulty === 'hard' || def.difficulty === 'super-hard') {
      riskScore += 15;
      recommendations.push(
        'Make at least one initial tunnel launch disastrous if executed first without preparation.',
      );
    }
  }

  if (metrics.requiredHeldLaunches === 0 && def.difficulty === 'hard') {
    riskFlags.push('NO_REQUIRED_HELD_LAUNCHES');
    riskScore += 15;
  }

  riskScore = Math.min(100, riskScore);

  let status: AntiSpamAssessment['status'] = 'spam-resistant';
  if (riskScore >= 55) {
    status = 'vulnerable';
  } else if (riskScore >= 25) {
    status = 'moderate';
  }

  return {
    status,
    riskScore,
    riskFlags,
    recommendations,
  };
}

/**
 * Runs full solver-backed difficulty and anti-spam analysis on a level definition.
 */
export async function analyzeAuthoredLevel(
  def: LevelDefinition,
  options: AnalysisOptions = {},
): Promise<LevelAnalysisReport> {
  const nodeCap = options.nodeCap ?? 150_000;
  const state = createGame(def);

  const studioAnalysis = await analyzeLevel(def, { nodeCap, now: () => 0 });

  const totalTunnelDepth = def.tunnels.reduce((acc, q) => acc + q.length, 0);
  const colorSet = new Set<string>();
  for (const p of state.pixels) colorSet.add(p.color);

  const seq = studioAnalysis.sequentialResult;
  const con = studioAnalysis.concurrentResult;

  const minWinningHoldingPeak = Math.max(seq.minWinningPeak, con.minWinningPeak);
  const maxHoldingObserved = Math.max(seq.maxHolding, con.maxHolding);
  const requiredHeldLaunches = seq.heldLaunches;
  const lossProbability = con.lossProbability;
  const failPathLength = con.failPathLength;

  const difficultyMismatch = studioAnalysis.authoredDifficulty !== studioAnalysis.suggestedDifficulty;

  const antiSpam = evaluateAntiSpam(def, {
    minWinningHoldingPeak,
    maxHoldingObserved,
    requiredHeldLaunches,
    lossProbability,
    failPathLength,
    viableFirstMoves: con.viableFirstMoves,
    totalFirstMoves: con.totalFirstMoves,
    totalTunnelDepth,
  });

  return {
    id: def.id,
    title: def.title,
    themeId: def.themeId,
    gridDimensions: `${state.width}×${state.height}`,
    pixelCount: state.pixels.length,
    colorCount: colorSet.size,
    totalTunnelDepth,
    authoredDifficulty: studioAnalysis.authoredDifficulty,
    calculatedDifficulty: studioAnalysis.suggestedDifficulty,
    difficultyScore: studioAnalysis.difficultyScore,
    difficultyMismatch,
    minWinningHoldingPeak,
    maxHoldingObserved,
    requiredHeldLaunches,
    viableFirstMoves: con.viableFirstMoves,
    totalFirstMoves: con.totalFirstMoves,
    lossProbability,
    failPathLength,
    solvable: seq.solved && con.solved,
    replaysSuccessfully: seq.solved,
    antiSpam,
    warnings: studioAnalysis.warnings.map((w) => `${w.severity}:${w.code}`),
  };
}
