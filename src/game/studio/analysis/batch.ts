/**
 * Batch campaign analysis. Runs {@link analyzeLevel} per level, yielding between
 * levels so the UI stays responsive and cancellable. Returns one {@link BatchRow}
 * per level (a compact slice of the full analysis).
 */
import { SolverCancelled } from '@/game/engine/solver';
import type { LevelDefinition } from '@/game/engine/types';
import { analyzeLevel, type AnalyzeLevelOptions } from './analyzeLevel';
import type { BatchResult, BatchRow, LevelAnalysis } from './types';

export function toBatchRow(a: LevelAnalysis): BatchRow {
  return {
    levelId: a.levelId,
    title: a.title,
    authoredDifficulty: a.authoredDifficulty,
    suggestedDifficulty: a.suggestedDifficulty,
    score: a.difficultyScore,
    solvable: a.solvable,
    shortestWin: a.shortestWinningLength,
    viableFirstMoves: a.viableFirstMoves,
    totalFirstMoves: a.totalFirstMoves,
    peakHolding: a.peakHoldingOnWinningLine,
    maxActive: a.maxActiveObserved,
    heldRelaunches: a.heldRelaunches,
    nodes: a.exploredNodes,
    warningCount: a.warnings.length,
    warnings: a.warnings,
    complete: a.complete,
  };
}

export interface AnalyzeBatchOptions extends Pick<AnalyzeLevelOptions, 'nodeCap' | 'signal' | 'now'> {
  /** Called before each level starts. */
  onProgress?: (done: number, total: number, levelId: number) => void;
}

export async function analyzeBatch(
  defs: LevelDefinition[],
  opts: AnalyzeBatchOptions = {},
): Promise<BatchResult> {
  const rows: BatchRow[] = [];
  const stopped = (): BatchResult => ({ rows, complete: false, cancelled: true });
  for (const def of defs) {
    if (opts.signal?.cancelled) return stopped();
    opts.onProgress?.(rows.length, defs.length, def.id);
    if (opts.signal?.cancelled) return stopped();
    try {
      const analysis = await analyzeLevel(def, {
        nodeCap: opts.nodeCap,
        signal: opts.signal,
        now: opts.now,
      });
      rows.push(toBatchRow(analysis));
    } catch (e) {
      if (e instanceof SolverCancelled) return stopped();
      throw e;
    }
  }
  return { rows, complete: rows.length === defs.length, cancelled: false };
}
