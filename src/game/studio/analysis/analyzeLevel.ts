/**
 * The analysis orchestrator. Async so the UI can paint progress and cancel
 * between phases; within one `solve` traversal it is still synchronous (bounded
 * by `nodeCap`) — see docs/M3B_SOLVER_ANALYTICS.md.
 *
 * Every number comes from the ONE real solver + the ONE real trace. This file
 * only *composes* them; the scoring / classification / warning rules live in
 * their own modules.
 */
import { createGame } from '@/game/engine/createGame';
import { reachablePixels } from '@/game/engine/pixels';
import { SolverCancelled, solve, type SolveResult } from '@/game/engine/solver';
import { traceActions, type Trace, describeTraceAction } from '@/game/engine/trace';
import type { GameAction } from '@/game/engine/actions';
import type { LevelDefinition, OrbColor } from '@/game/engine/types';
import { evaluateRoundRobinSpam } from './antiSpam';
import { boardMetrics } from './boardMetrics';
import { choiceMetricsFromStats, EMPTY_CHOICE_METRICS } from './choiceMetrics';
import { scoreDifficulty, tierDistance, type DifficultyFeatures } from './difficulty';
import { directionalGeometry } from './directionalGeometry';
import { classifyFirstMoves, type FirstMoveMetrics } from './firstMoves';
import { holdingPressure } from './holdingPressure';
import { queueMetrics } from './queueMetrics';
import { resourcePressure as composeResourcePressure } from './resourcePressure';
import { deriveWarnings, WARNING_THRESHOLDS } from './warnings';
import { toSolveSummary, type FirstMoveAnalysis, type LevelAnalysis } from './types';

export type AnalysisPhase = 'solve' | 'winning-trace' | 'failing-trace' | 'first-moves' | 'scoring';

const PHASES: AnalysisPhase[] = ['solve', 'winning-trace', 'failing-trace', 'first-moves', 'scoring'];

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

  // ONE search over logical player choices. Joining Pals already on the rail
  // is not one of them — under FIRST LAUNCHED, FIRST SERVED a join resolves
  // exactly like launching after the rail settles — so there is no separate
  // "concurrent" solve to compare against (see engine/solver.ts).
  await phase('solve');
  const result = solve(def, { nodeCap, signal: opts.signal, partialOnCap: true });

  await phase('winning-trace');
  const winTrace: Trace | null = result.moves.length > 0 ? traceActions(def, result.moves) : null;

  await phase('failing-trace');
  const failTrace: Trace | null = result.failPath ? traceActions(def, result.failPath) : null;

  await phase('first-moves');
  const firstMoveAnalysis = buildFirstMoveAnalysis(def, result);

  await phase('scoring');

  const summary = toSolveSummary(result);
  const complete = result.complete;
  const solvable: boolean | 'unknown' = result.solved ? true : result.nodeCapHit ? 'unknown' : false;

  const exposureDepth = winTrace ? deepestColorExposureDepth(winTrace) : 0;

  const features: DifficultyFeatures = {
    minWinningPeak: result.solved && result.minWinningPeak >= 0 ? result.minWinningPeak : 0,
    holdingCapacity: def.holdingCapacity,
    lossProbability: result.lossProbability,
    viableFirstMoves: result.viableFirstMoves,
    totalFirstMoves: result.totalFirstMoves,
    heldRelaunches: result.heldLaunches,
    winningLength: result.length,
    exposureDepth,
    nodes: result.nodes,
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

  const board = boardMetrics(def);
  const queues = queueMetrics(def);
  const geometry = directionalGeometry(createGame(def));
  const choicesAvailable = result.complete && result.solved;
  const choices = choicesAvailable
    ? choiceMetricsFromStats(result.decisionStats)
    : EMPTY_CHOICE_METRICS;
  const antiSpam = evaluateRoundRobinSpam(def);
  const resources = composeResourcePressure({ holding: pressure });

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
    viableFirstMoves: result.viableFirstMoves,
    solve: summary,
    holdingPressure: pressure,
    winTrace,
    failWitnessLength: summary.failPathLength,
    avgBranching: summary.avgBranching,
    nodes: summary.nodes,
    totalAuthoredCapacity,
    ruleset: def.ruleset,
    occupiedCells: board.occupiedCells,
    directionalGeometry: geometry,
    choiceMetrics: choices,
    antiSpam,
    resourcePressure: resources,
  });

  const limitations: string[] = [];
  if (!result.complete) {
    limitations.push(result.solved
      ? `Solve hit the ${nodeCap.toLocaleString()}-node cap — a win was found, but totals are incomplete.`
      : `Solve hit the ${nodeCap.toLocaleString()}-node cap — solvability is unknown, not "no".`);
    limitations.push('First-move analysis is unavailable on a truncated run.');
  }
  if (!choicesAvailable) {
    limitations.push('Choice metrics require a complete winning witness — omitted on this run.');
  }
  if (antiSpam.outcome === 'step-cap') {
    limitations.push(`Round-robin anti-spam hit the ${antiSpam.steps}-step cap.`);
  }

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

    winningWitness: result.moves.length > 0 ? result.moves : null,
    failWitness: result.failPath,
    winningTrace: winTrace,
    failingTrace: failTrace,
    shortestWinningLength: result.length,
    peakHoldingOnWinningLine: result.peakHolding,
    heldRelaunches: result.heldLaunches,
    maxHoldingObserved: result.maxHolding,
    exploredNodes: result.nodes,
    avgBranching: result.avgBranching,
    solveDurationMs: now() - started,
    lossProbability: result.lossProbability,

    totalFirstMoves: result.totalFirstMoves,
    viableFirstMoves: result.viableFirstMoves,
    firstMoveAnalysis,

    solveResult: summary,

    holdingPressure: pressure,

    boardMetrics: board,
    queueMetrics: queues,
    directionalGeometry: geometry,
    choiceMetrics: choices,
    resourcePressure: resources,
    antiSpam,

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
