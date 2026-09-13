/**
 * Production-neutral level-analysis model. No React / RN imports; every field is
 * derived from the ONE real solver (`engine/solver.ts`) and the ONE real witness
 * trace (`engine/trace.ts`). The Studio UI renders this — it computes nothing.
 */
import type { GameAction } from '@/game/engine/actions';
import type { FirstMoveStat, SolveResult } from '@/game/engine/solver';
import type { Trace } from '@/game/engine/trace';
import type { LevelDifficulty, OrbColor } from '@/game/engine/types';

export type FirstMoveClass = 'VIABLE' | 'DANGEROUS' | 'DEAD-END';

export interface FirstMoveAnalysis {
  action: GameAction;
  label: string;
  source: 'tunnel' | 'holding';
  /** 0-based tunnel index, or -1 for a Holding relaunch. */
  tunnelIndex: number;
  color: OrbColor;
  startingCapacity: number;
  solvableAfter: boolean;
  /** Shortest remaining win length after this move (0 when unsolvable). */
  remainingWinLength: number;
  /** Peak Holding replaying the shortest continuation (or right after the move if unsolvable). */
  peakHolding: number;
  /** Minimum peak Holding achievable on any winning continuation (-1 if unsolvable). */
  minPeakHolding: number;
  heldRelaunches: number;
  maxActive: number;
  /** Loss probability of the whole subtree after this move (uniform play). */
  lossAfter: number;
  classification: FirstMoveClass;
  /** Human-readable reasons a move is DANGEROUS / DEAD-END. */
  reasons: string[];
}

export interface BoardMetrics {
  rows: number;
  cols: number;
  totalCells: number;
  occupiedCells: number;
  /** occupiedCells / totalCells; 0 when the grid is empty. */
  density: number;
  uniqueColors: number;
  colorHistogram: Partial<Record<OrbColor, number>>;
  /** Colours tied for the highest histogram count, in palette order. */
  dominantColors: OrbColor[];
}

export interface QueueMetrics {
  tunnelCount: number;
  totalCharges: number;
  perTunnelDepth: number[];
  maxTunnelDepth: number;
  minTunnelDepth: number;
}

export interface DirectionalGeometry {
  /** `coreV2` uses attack-bin rays; `legacyV1` uses exterior flood-fill. */
  mode: 'coreV2' | 'legacyV1';
  initiallyExposed: number;
  buried: number;
  maxLayerDepth: number;
  averageLayerDepth: number;
  singleSideExposed: number;
  multiSideExposed: number;
}

export interface ChoiceMetrics {
  totalDecisionStates: number;
  forcedStates: number;
  multiOptionStates: number;
  statesWithMultipleWinningOptions: number;
  statesWithTrapOptions: number;
}

export type AntiSpamOutcome = 'won' | 'lost' | 'deadlocked' | 'step-cap';

export interface AntiSpamResult {
  policy: 'round-robin';
  outcome: AntiSpamOutcome;
  steps: number;
  peakHolding: number;
  maxActive: number;
  holdingEntries: number;
  manualRelaunches: number;
}

export interface ResourcePressure {
  maxHolding: number;
  holdingCapacity: number;
  /** maxHolding / holdingCapacity (0 when capacity is 0). */
  holdingUtilization: number;
  manualRelaunches: number;
  chargesEnteringHolding: number;
  longestHeldDurationSteps: number;
  maxActive: number;
  activeCapacity: number;
  /** maxActive / activeCapacity (0 when capacity is 0). */
  activeUtilization: number;
}

export interface PaletteSnapshot {
  uniqueColors: OrbColor[];
  dominantColors: OrbColor[];
  colorHistogram: Partial<Record<OrbColor, number>>;
}

export interface PaletteComparison {
  jaccard: number;
  dominantOverlap: number;
}

export interface AdjacentPaletteComparison extends PaletteComparison {
  fromLevelId: number;
  toLevelId: number;
}

export interface HoldingPressure {
  /** Holding occupancy after each resolved step of the winning line. */
  timeline: number[];
  holdingCapacity: number;
  maxHolding: number;
  stepsAtOrAbove2: number;
  fractionAtOrAbove2: number;
  manualRelaunches: number;
  chargesEnteringHolding: number;
  /** Longest a charge sat in Holding before relaunch / end, in action steps. */
  longestHeldDurationSteps: number;
}

export type ConcurrencyVerdict =
  | 'equivalent'
  | 'concurrency-helps'
  | 'concurrency-hurts'
  | 'concurrency-required'
  | 'concurrency-mixed';

export interface SeqConComparison {
  sequentialSolvable: boolean;
  concurrentSolvable: boolean;
  solvabilityChanged: boolean;
  /** seq.length − con.length ( > 0 ⇒ concurrency shortens the solution ). */
  winLengthDelta: number;
  /** seq.minWinningPeak − con.minWinningPeak ( > 0 ⇒ concurrency lowers Holding pressure ). */
  peakHoldingDelta: number;
  /** con.viableFirstMoves − seq.viableFirstMoves. */
  viableFirstMoveDelta: number;
  /** con.maxActive − seq.maxActive. */
  maxActiveDelta: number;
  /** con.nodes − seq.nodes. */
  nodeDelta: number;
  /** seq.lossProbability − con.lossProbability ( > 0 ⇒ concurrency is safer ). */
  lossDelta: number;
  verdict: ConcurrencyVerdict;
}

export type WarningSeverity = 'info' | 'warn';

export interface AnalysisWarning {
  code: string;
  severity: WarningSeverity;
  message: string;
  detail?: string;
}

export interface DifficultyAssessment {
  authored: LevelDifficulty;
  suggested: LevelDifficulty;
  /** 0–100. */
  score: number;
  /** factor id → normalised value 0..1 (pre-weight). */
  factors: Record<string, number>;
  /** factor id → points out of 100 (weight × factor × 100). */
  contributions: Record<string, number>;
  /** `true` when authored and suggested differ by ≥ WARNING_THRESHOLDS.mismatchTiers. */
  mismatch: boolean;
  /** suggested tier index − authored tier index (signed). */
  mismatchTiers: number;
}

export interface SolveSummary {
  mode: 'sequential-compat' | 'metrics';
  solved: boolean;
  complete: boolean;
  nodeCapHit: boolean;
  length: number;
  minWinningPeak: number;
  maxHolding: number;
  viableFirstMoves: number;
  totalFirstMoves: number;
  maxActive: number;
  nodes: number;
  avgBranching: number;
  lossProbability: number;
  heldLaunches: number;
  failPathLength: number | null;
}

export function toSolveSummary(mode: SolveSummary['mode'], r: SolveResult): SolveSummary {
  return {
    mode,
    solved: r.solved,
    complete: r.complete,
    nodeCapHit: r.nodeCapHit,
    length: r.length,
    minWinningPeak: Number.isFinite(r.minWinningPeak) ? r.minWinningPeak : -1,
    maxHolding: r.maxHolding,
    viableFirstMoves: r.viableFirstMoves,
    totalFirstMoves: r.totalFirstMoves,
    maxActive: r.maxActive,
    nodes: r.nodes,
    avgBranching: r.avgBranching,
    lossProbability: r.lossProbability,
    heldLaunches: r.heldLaunches,
    failPathLength: r.failPath ? r.failPath.length : null,
  };
}

export interface LevelAnalysis {
  levelId: number;
  title: string;
  /** `false` when any solve was truncated by the node cap. */
  complete: boolean;
  /** Human notes about what is approximate or unknown. */
  limitations: string[];
  solvable: boolean | 'unknown';

  difficulty: DifficultyAssessment;
  authoredDifficulty: LevelDifficulty;
  suggestedDifficulty: LevelDifficulty;
  difficultyScore: number;

  winningWitness: GameAction[] | null;
  failWitness: GameAction[] | null;
  /** Full frame-by-frame replay of the winning / failing witness (the visualisers). */
  winningTrace: Trace | null;
  failingTrace: Trace | null;
  shortestWinningLength: number;
  peakHoldingOnWinningLine: number;
  maxActiveOnWinningWitness: number;
  heldRelaunches: number;
  maxHoldingObserved: number;
  maxActiveObserved: number;
  exploredNodes: number;
  avgBranching: number;
  solveDurationMs: number;
  lossProbability: number;

  totalFirstMoves: number;
  viableFirstMoves: number;
  firstMoveAnalysis: FirstMoveAnalysis[];

  sequentialResult: SolveSummary;
  concurrentResult: SolveSummary;
  comparison: SeqConComparison;

  holdingPressure: HoldingPressure;

  boardMetrics: BoardMetrics;
  queueMetrics: QueueMetrics;
  directionalGeometry: DirectionalGeometry;
  choiceMetrics: ChoiceMetrics;
  resourcePressure: ResourcePressure;
  antiSpam: AntiSpamResult;

  warnings: AnalysisWarning[];
}

/** The subset of a {@link LevelAnalysis} shown in the batch-audit table. */
export interface BatchRow {
  levelId: number;
  title: string;
  authoredDifficulty: LevelDifficulty;
  suggestedDifficulty: LevelDifficulty;
  score: number;
  solvable: boolean | 'unknown';
  shortestWin: number;
  viableFirstMoves: number;
  totalFirstMoves: number;
  peakHolding: number;
  maxActive: number;
  heldRelaunches: number;
  nodes: number;
  warningCount: number;
  warnings: AnalysisWarning[];
  complete: boolean;
  antiSpamOutcome: AntiSpamOutcome | null;
  density: number;
  uniqueColors: number;
  maxLayerDepth: number;
}

export interface BatchResult {
  rows: BatchRow[];
  complete: boolean;
  cancelled: boolean;
  /** Consecutive-pair palette comparisons in the batch's given order. */
  paletteComparisons: AdjacentPaletteComparison[];
}

export type { FirstMoveStat };
