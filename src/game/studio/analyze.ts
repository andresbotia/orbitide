/**
 * Studio-facing wrapper around the one shared solver
 * (`src/game/engine/solver.ts`). It converts a Studio document to the real
 * `LevelDefinition` and runs the real solver — no analysis logic lives here.
 *
 * M3A exposes the solver data that is already cheap to compute. The full
 * analytics dashboard (path visualisation, difficulty scoring, batch runs) is
 * M3B and deliberately not built here.
 */
import type { GameAction } from '@/game/engine/actions';
import { SolverCancelled, solve, type SolveResult } from '@/game/engine/solver';
import { toLevelDefinition } from './serialize';
import type { StudioLevel } from './types';

export interface StudioAnalysis {
  status: 'solved' | 'unsolvable' | 'error' | 'cancelled';
  solvable: boolean;
  result: SolveResult | null;
  error: string | null;
  /** Wall-clock milliseconds the solve took. */
  elapsedMs: number;
}

export interface AnalyzeOptions {
  nodeCap?: number;
  signal?: { cancelled: boolean };
}

export function analyzeStudioLevel(level: StudioLevel, opts: AnalyzeOptions = {}): StudioAnalysis {
  const started = Date.now();
  try {
    const result = solve(toLevelDefinition(level), {
      mode: 'metrics',
      nodeCap: opts.nodeCap ?? 200_000,
      signal: opts.signal,
    });
    return {
      status: result.solved ? 'solved' : 'unsolvable',
      solvable: result.solved,
      result,
      error: null,
      elapsedMs: Date.now() - started,
    };
  } catch (e) {
    if (e instanceof SolverCancelled) {
      return { status: 'cancelled', solvable: false, result: null, error: null, elapsedMs: Date.now() - started };
    }
    return {
      status: 'error',
      solvable: false,
      result: null,
      error: (e as Error).message,
      elapsedMs: Date.now() - started,
    };
  }
}

/** A compact, human-readable description of one action for the witness display. */
export function describeAction(action: GameAction): string {
  const where = action.kind === 'tunnel'
    ? `Tunnel ${action.id.replace('tunnel-', '')}`
    : `Holding ${action.id}`;
  return action.join ? `${where} (join)` : where;
}
