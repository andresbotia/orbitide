/**
 * The analysis orchestrator. Async so the UI can paint progress and cancel
 * between phases; within one `solve` traversal it is still synchronous (bounded
 * by `nodeCap`) — see docs/M3B_SOLVER_ANALYTICS.md.
 *
 * Every number comes from the ONE real solver + the ONE real trace. This file
 * only *composes* them; the scoring / classification / warning rules live in
 * their own modules.
 */
import { reachablePixels } from '@/game/engine/pixels';
import { SolverCancelled, solve, type SolveResult } from '@/game/engine/solver';
import { traceActions, type Trace, describeTraceAction } from '@/game/engine/trace';
import type { GameAction } from '@/game/engine/actions';
import type { LevelDefinition, OrbColor } from '@/game/engine/types';
import { scoreDifficulty, tierDistance, type DifficultyFeatures } from './difficulty';
import { classifyFirstMoves, type FirstMoveMetrics } from './firstMoves';
import { holdingPressure } from './holdingPressure';
import { deriveWarnings, WARNING_THRESHOLDS } from './warnings';
import {
  toSolveSummary, type FirstMoveAnalysis, type LevelAnalysis, type SeqConComparison,
  type SolveSummary,
} from './types';

export type AnalysisPhase =
  | 'sequential-solve' | 'concurrent-solve' | 'winning-trace'
  | 'failing-trace' | 'first-moves' | 'scoring';

const PHASES: AnalysisPhase[] = [
  'sequential-solve', 'concurrent-solve', 'winning-trace', 'failing-trace', 'first-moves', 'scoring',
];

export interface AnalyzeLevelOptions {
  nodeCap?: number;
  signal?: { cancelled: boolean };
  onPhase?: (phase: AnalysisPhase, index: number, total: number) => void;
  /** Injected for deterministic tests. Default: `Date.now`. */
  now?: () => number;
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function analyzeLevel(def: LevelDefinition, opts: AnalyzeLevelOptions = {}): Promise<LevelAnalysis> {
  const now = opts.now ?? (() => Date.now());
  const nodeCap = opts.nodeCap ?? 200_000;
  const started = now();
  const check = () => { if (opts.signal?.cancelled) throw new SolverCancelled(); };
  const phase = async (p: AnalysisPhase) => {
    check();
    opts.onPhase?.(p, PHASES.indexOf(p), PHASES.length);
    await tick();
    check();
  };

  await phase('sequential-solve');
  const seqSolve = solve(def, { mode: 'sequential-compat', nodeCap, signal: opts.signal, partialOnCap: true });

  await phase('concurrent-solve');
  const conSolve = solve(def, { mode: 'metrics', nodeCap, signal: opts.signal, partialOnCap: true });

  await phase('winning-trace');
  const winTrace: Trace | null = conSolve.moves.length > 0 ? traceActions(def, conSolve.moves) : null;

  await phase('failing-trace');
  const failTrace: Trace | null = conSolve.failPath ? traceActions(def, conSolve.failPath) : null;

  await phase('first-moves');
  const firstMoveAnalysis = buildFirstMoveAnalysis(def, conSolve);

  await phase('scoring');

  const seq = toSolveSummary('sequential-compat', seqSolve);
  const con = toSolveSummary('metrics', conSolve);
  const comparison = compareSeqCon(seq, con);

  const complete = seqSolve.complete && conSolve.complete;
  const solvable: boolean | 'unknown' = conSolve.nodeCapHit && !conSolve.solved ? 'unknown' : conSolve.solved;

  const exposureDepth = winTrace ? deepestColorExposureDepth(winTrace) : 0;
  const concurrencyGap = seq.solved && con.solved ? Math.max(0, seq.length - con.length) : 0;

  const features: DifficultyFeatures = {
    minWinningPeak: con.solved && con.minWinningPeak >= 0 ? con.minWinningPeak : 0,
    holdingCapacity: def.holdingCapacity,
    lossProbability: con.lossProbability,
    viableFirstMoves: con.viableFirstMoves,
    totalFirstMoves: con.totalFirstMoves,
    heldRelaunches: con.heldLaunches,
    winningLength: con.length,
    exposureDepth,
    concurrencyGap,
    nodes: Math.max(seq.nodes, con.nodes),
  };
  const scored = scoreDifficulty(features);
  const suggested = solvable === true ? scored.tier : def.difficulty;
  const mismatchTiers = solvable === true ? tierDistance(def.difficulty, suggested) : 0;

  const pressure = winTrace
    ? holdingPressure(winTrace, def.holdingCapacity)
    : {
      timeline: [], holdingCapacity: def.holdingCapacity, maxHolding: 0, stepsAtOrAbove2: 0,
      fractionAtOrAbove2: 0, manualRelaunches: 0, chargesEnteringHolding: 0, longestHeldDurationSteps: 0,
    };

  const totalAuthoredCapacity = def.tunnels.reduce(
    (n, queue) => n + queue.reduce((m, spec) => m + spec.capacity, 0), 0,
  );

  const warnings = deriveWarnings({
    authoredDifficulty: def.difficulty,
    suggestedDifficulty: suggested,
    mismatchTiers,
    solvable,
    complete,
    firstMoveAnalysis,
    viableFirstMoves: con.viableFirstMoves,
    seq, con, comparison,
    holdingPressure: pressure,
    winTrace,
    failWitnessLength: con.failPathLength,
    avgBranching: con.avgBranching,
    nodes: Math.max(seq.nodes, con.nodes),
    totalAuthoredCapacity,
  });

  const limitations: string[] = [];
  if (!seqSolve.complete) limitations.push(`Sequential solve hit the ${nodeCap.toLocaleString()}-node cap — sequential numbers are incomplete.`);
  if (!conSolve.complete) limitations.push(`Concurrent solve hit the ${nodeCap.toLocaleString()}-node cap — solvability is unknown, not "no".`);
  if (conSolve.nodeCapHit) limitations.push('First-move analysis is unavailable on a truncated run.');

  return {
    levelId: def.id,
    title: def.title,
    complete,
    limitations,
    solvable,

    difficulty: {
      authored: def.difficulty,
      suggested,
      score: scored.score,
      factors: scored.factors,
      contributions: scored.contributions,
      mismatch: Math.abs(mismatchTiers) >= WARNING_THRESHOLDS.mismatchTiers,
      mismatchTiers,
    },
    authoredDifficulty: def.difficulty,
    suggestedDifficulty: suggested,
    difficultyScore: scored.score,

    winningWitness: conSolve.moves.length > 0 ? conSolve.moves : null,
    failWitness: conSolve.failPath,
    winningTrace: winTrace,
    failingTrace: failTrace,
    shortestWinningLength: con.length,
    peakHoldingOnWinningLine: conSolve.peakHolding,
    maxActiveOnWinningWitness: conSolve.maxActiveOnWitness,
    heldRelaunches: con.heldLaunches,
    maxHoldingObserved: con.maxHolding,
    maxActiveObserved: con.maxActive,
    exploredNodes: Math.max(seq.nodes, con.nodes),
    avgBranching: con.avgBranching,
    solveDurationMs: now() - started,
    lossProbability: con.lossProbability,

    totalFirstMoves: con.totalFirstMoves,
    viableFirstMoves: con.viableFirstMoves,
    firstMoveAnalysis,

    sequentialResult: seq,
    concurrentResult: con,
    comparison,

    holdingPressure: pressure,
    warnings,
  };
}

function buildFirstMoveAnalysis(def: LevelDefinition, r: SolveResult): FirstMoveAnalysis[] {
  const metrics: FirstMoveMetrics[] = r.firstMoves.map((m) => ({
    solvable: m.solvable,
    winLength: m.winLength,
    peakHolding: m.peakHoldingOnLine,
    lossAfter: m.lossAfter,
  }));
  const classes = classifyFirstMoves(metrics);

  return r.firstMoves.map((m, i) => {
    const action = m.action;
    const tunnelIndex = action.kind === 'tunnel'
      ? Number(action.id.replace('tunnel-', ''))
      : -1;
    const color = firstMoveColor(def, action);
    return {
      action,
      label: describeTraceAction(action),
      source: action.kind,
      tunnelIndex,
      color,
      startingCapacity: firstMoveCapacity(def, action),
      solvableAfter: m.solvable,
      remainingWinLength: m.winLength,
      peakHolding: m.peakHoldingOnLine,
      minPeakHolding: m.minPeakHolding,
      heldRelaunches: m.heldRelaunchesOnLine,
      maxActive: m.maxActiveOnLine,
      lossAfter: m.lossAfter,
      classification: classes[i]!.classification,
      reasons: classes[i]!.reasons,
    };
  });
}

function firstMoveColor(def: LevelDefinition, action: GameAction): OrbColor {
  if (action.kind === 'tunnel') {
    const idx = Number(action.id.replace('tunnel-', ''));
    return def.tunnels[idx]?.[0]?.color ?? 'white';
  }
  return 'white'; // Holding first moves need a live game state; the campaign has none at move 1.
}

function firstMoveCapacity(def: LevelDefinition, action: GameAction): number {
  if (action.kind === 'tunnel') {
    const idx = Number(action.id.replace('tunnel-', ''));
    return def.tunnels[idx]?.[0]?.capacity ?? 0;
  }
  return 0;
}

function compareSeqCon(seq: SolveSummary, con: SolveSummary): SeqConComparison {
  const bothSolved = seq.solved && con.solved;
  let verdict: SeqConComparison['verdict'];
  if (!seq.solved && con.solved) {
    verdict = 'concurrency-required';
  } else if (!bothSolved) {
    verdict = 'equivalent';
  } else {
    const helps = con.length < seq.length
      || (con.minWinningPeak >= 0 && seq.minWinningPeak >= 0 && con.minWinningPeak < seq.minWinningPeak)
      || con.lossProbability < seq.lossProbability - 1e-9;
    const hurts = con.lossProbability > seq.lossProbability + 1e-9 || con.maxHolding > seq.maxHolding;
    verdict = helps && hurts ? 'concurrency-mixed'
      : helps ? 'concurrency-helps'
        : hurts ? 'concurrency-hurts'
          : 'equivalent';
  }
  return {
    sequentialSolvable: seq.solved,
    concurrentSolvable: con.solved,
    solvabilityChanged: seq.solved !== con.solved,
    winLengthDelta: bothSolved ? seq.length - con.length : 0,
    peakHoldingDelta: bothSolved && seq.minWinningPeak >= 0 && con.minWinningPeak >= 0
      ? seq.minWinningPeak - con.minWinningPeak : 0,
    viableFirstMoveDelta: con.viableFirstMoves - seq.viableFirstMoves,
    maxActiveDelta: con.maxActive - seq.maxActive,
    nodeDelta: con.nodes - seq.nodes,
    lossDelta: seq.lossProbability - con.lossProbability,
    verdict,
  };
}

/** Clears required before the deepest-buried colour first becomes reachable. */
function deepestColorExposureDepth(trace: Trace): number {
  const colors = new Set(trace.frames[0]!.pixels.filter((p) => !p.cleared).map((p) => p.color));
  const clearedAt = trace.frames.map((f) => f.pixels.filter((p) => p.cleared).length);
  let depth = 0;
  for (const color of colors) {
    let d = clearedAt[clearedAt.length - 1] ?? 0;
    for (let i = 0; i < trace.frames.length; i += 1) {
      if (reachablePixels(trace.frames[i]!).some((p) => p.color === color)) { d = clearedAt[i]!; break; }
    }
    depth = Math.max(depth, d);
  }
  return depth;
}
