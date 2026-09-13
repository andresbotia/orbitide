/**
 * Deterministic, advisory "suspicious level" warnings. Every threshold is here
 * and documented — no magic numbers in the caller. Warnings never block
 * anything; they are design signals.
 */
import type { GameRuleset, LevelDifficulty } from '@/game/engine/types';
import { isCoreV2 } from '@/game/engine/ruleset';
import type { Trace } from '@/game/engine/trace';
import type {
  AnalysisWarning, AntiSpamResult, ChoiceMetrics, DirectionalGeometry, FirstMoveAnalysis,
  HoldingPressure, ResourcePressure, SeqConComparison, SolveSummary,
} from './types';

export const WARNING_THRESHOLDS = {
  /** TRIVIAL_FIRST_MOVES: ≥ this fraction of first moves are VIABLE + calm. */
  trivialFirstMoveRatio: 0.9,
  trivialPeakHolding: 1,
  trivialLoss: 0.1,
  /** NARROW_EASY_LEVEL: an easy level with ≤ this many viable first moves. */
  narrowEasyViable: 1,
  /** LOW_BRANCHING_HARD_LEVEL: hard+ level with mean branching below this. */
  lowBranchingHard: 1.7,
  /** CONCURRENCY_TRIVIALIZES_LEVEL: concurrent solution ≥ this many moves shorter. */
  concurrencyTrivializeLen: 2,
  concurrencyTrivializePeakDrop: 1,
  concurrencyTrivializeLossDrop: 0.15,
  /** CONCURRENCY_INCREASES_RISK: concurrency raises loss probability by ≥ this. */
  concurrencyRiskLoss: 0.1,
  /** EXCESSIVE_UNUSED_CAPACITY: unused / authored tunnel capacity ≥ this. */
  unusedCapacityRatio: 0.4,
  /** SOLVER_NODE_EXPLOSION: explored nodes ≥ this. */
  nodeExplosion: 60_000,
  /** DIFFICULTY_MISMATCH: |suggested − authored| tier distance. */
  mismatchTiers: 2,
  /** EARLY_DEADLOCK: shortest fail line ≤ this many moves. */
  earlyDeadlockLen: 2,
  /** Tiers that are expected to use Holding / have a fail state. */
  pressureExpectedTiers: ['medium', 'hard', 'super-hard', 'extreme'] as LevelDifficulty[],
  hardTiers: ['hard', 'super-hard', 'extreme'] as LevelDifficulty[],
  /** CORE_V2_LOW_DIRECTIONAL_DEPTH: occupied cells below this skip the warning (tutorial-scale). */
  lowDepthMinOccupied: 8,
  /** LOW_MEANINGFUL_CHOICE: need at least this many witness decisions. */
  lowChoiceMinDecisions: 2,
} as const;

export interface WarningContext {
  authoredDifficulty: LevelDifficulty;
  suggestedDifficulty: LevelDifficulty;
  mismatchTiers: number;
  solvable: boolean | 'unknown';
  complete: boolean;
  firstMoveAnalysis: FirstMoveAnalysis[];
  viableFirstMoves: number;
  seq: SolveSummary;
  con: SolveSummary;
  comparison: SeqConComparison;
  holdingPressure: HoldingPressure;
  winTrace: Trace | null;
  failWitnessLength: number | null;
  avgBranching: number;
  nodes: number;
  /** Total authored tunnel capacity (for the unused-capacity ratio). */
  totalAuthoredCapacity: number;
  ruleset?: GameRuleset;
  occupiedCells?: number;
  directionalGeometry?: DirectionalGeometry;
  choiceMetrics?: ChoiceMetrics;
  antiSpam?: AntiSpamResult;
  resourcePressure?: ResourcePressure;
}

export function deriveWarnings(ctx: WarningContext): AnalysisWarning[] {
  const out: AnalysisWarning[] = [];
  const add = (code: string, severity: AnalysisWarning['severity'], message: string, detail?: string) =>
    out.push({ code, severity, message, ...(detail ? { detail } : {}) });

  const T = WARNING_THRESHOLDS;
  const solvable = ctx.solvable === true;

  if (solvable && ctx.firstMoveAnalysis.length >= 2) {
    const calm = ctx.firstMoveAnalysis.filter(
      (m) => m.classification === 'VIABLE'
        && m.peakHolding <= T.trivialPeakHolding
        && m.lossAfter <= T.trivialLoss,
    );
    if (calm.length / ctx.firstMoveAnalysis.length >= T.trivialFirstMoveRatio) {
      // Expected on an easy level; a signal on anything harder.
      add('TRIVIAL_FIRST_MOVES', ctx.authoredDifficulty === 'easy' ? 'info' : 'warn',
        'Nearly every first move solves with low pressure.',
        `${calm.length}/${ctx.firstMoveAnalysis.length} first moves are viable, ≤${T.trivialPeakHolding} peak Holding, ≤${T.trivialLoss} loss.`);
    }
  }

  if (solvable && T.pressureExpectedTiers.includes(ctx.authoredDifficulty)
    && ctx.con.minWinningPeak <= 0 && ctx.con.heldLaunches === 0) {
    add('NO_HOLDING_PRESSURE', 'warn',
      `Authored ${ctx.authoredDifficulty} but the best line never uses Holding.`,
      'min winning peak Holding is 0 and there are no held relaunches.');
  }

  if (solvable && ctx.authoredDifficulty === 'easy' && ctx.viableFirstMoves <= T.narrowEasyViable) {
    add('NARROW_EASY_LEVEL', 'warn',
      'Easy level has only one viable first move.',
      `${ctx.viableFirstMoves}/${ctx.con.totalFirstMoves} first moves lead to a solution.`);
  }

  if (solvable && T.hardTiers.includes(ctx.authoredDifficulty) && ctx.avgBranching < T.lowBranchingHard) {
    add('LOW_BRANCHING_HARD_LEVEL', 'warn',
      `Authored ${ctx.authoredDifficulty} but the solution graph is almost linear.`,
      `mean branching ${ctx.avgBranching.toFixed(2)} < ${T.lowBranchingHard}.`);
  }

  const c = ctx.comparison;
  if (c.verdict === 'concurrency-required'
    || c.winLengthDelta >= T.concurrencyTrivializeLen
    || (c.peakHoldingDelta >= T.concurrencyTrivializePeakDrop && c.lossDelta >= T.concurrencyTrivializeLossDrop)) {
    add('CONCURRENCY_TRIVIALIZES_LEVEL', 'warn',
      'Concurrent play makes this level substantially easier.',
      `Δlen ${c.winLengthDelta}, Δpeak ${c.peakHoldingDelta}, Δloss ${c.lossDelta.toFixed(2)}${c.verdict === 'concurrency-required' ? ', sequential play cannot solve it' : ''}.`);
  }

  if (-c.lossDelta >= T.concurrencyRiskLoss || ctx.con.maxHolding > ctx.seq.maxHolding) {
    add('CONCURRENCY_INCREASES_RISK', 'info',
      'Concurrent play opens materially worse lines.',
      `concurrent loss ${ctx.con.lossProbability.toFixed(2)} vs sequential ${ctx.seq.lossProbability.toFixed(2)}; max Holding ${ctx.con.maxHolding} vs ${ctx.seq.maxHolding}.`);
  }

  if (ctx.winTrace && ctx.totalAuthoredCapacity > 0) {
    const ratio = ctx.winTrace.unusedCapacity / ctx.totalAuthoredCapacity;
    if (ratio >= T.unusedCapacityRatio) {
      add('EXCESSIVE_UNUSED_CAPACITY', 'warn',
        `${Math.round(ratio * 100)}% of authored tunnel capacity is never needed.`,
        `${ctx.winTrace.unusedCapacity} of ${ctx.totalAuthoredCapacity} capacity unused on the winning line.`);
    }
    if (ctx.winTrace.unusedChargeIds.length > 0) {
      add('UNUSED_QUEUE_ENTRIES', 'info',
        `${ctx.winTrace.unusedChargeIds.length} authored charge(s) never launch on the winning line.`,
        ctx.winTrace.unusedChargeIds.join(', '));
    }
  }

  if (ctx.nodes >= T.nodeExplosion) {
    add('SOLVER_NODE_EXPLOSION', 'info',
      `The solver explored ${ctx.nodes.toLocaleString()} states.`,
      `≥ ${T.nodeExplosion.toLocaleString()} — analysis is slow and the design space is very open.`);
  }

  if (Math.abs(ctx.mismatchTiers) >= T.mismatchTiers) {
    add('DIFFICULTY_MISMATCH', 'warn',
      `Authored ${ctx.authoredDifficulty}, suggested ${ctx.suggestedDifficulty}.`,
      `${Math.abs(ctx.mismatchTiers)} tiers ${ctx.mismatchTiers > 0 ? 'harder' : 'easier'} than authored.`);
  } else if (Math.abs(ctx.mismatchTiers) === 1) {
    add('DIFFICULTY_MISMATCH', 'info',
      `Authored ${ctx.authoredDifficulty}, suggested ${ctx.suggestedDifficulty} (one tier apart).`);
  }

  if (solvable && ctx.complete && T.pressureExpectedTiers.includes(ctx.authoredDifficulty)
    && ctx.failWitnessLength === null) {
    add('NO_FAIL_PATH', 'warn',
      `Authored ${ctx.authoredDifficulty} but no failing line exists — the level is unloseable.`);
  }

  if (ctx.failWitnessLength !== null && ctx.failWitnessLength <= T.earlyDeadlockLen) {
    add('EARLY_DEADLOCK', 'warn',
      `The level can be lost in ${ctx.failWitnessLength} move(s).`,
      'a reasonable early choice leads to a quick deadlock.');
  }

  const geo = ctx.directionalGeometry;
  const occupied = ctx.occupiedCells ?? 0;
  if (
    isCoreV2(ctx.ruleset)
    && geo
    && geo.mode === 'coreV2'
    && occupied >= T.lowDepthMinOccupied
    && geo.maxLayerDepth === 0
    && ctx.authoredDifficulty !== 'easy'
  ) {
    add('CORE_V2_LOW_DIRECTIONAL_DEPTH', 'warn',
      'Core V2 board has no layered directional geometry.',
      `max layer depth 0 across ${occupied} occupied cells — every pixel is first-visible.`);
  }

  if (
    T.hardTiers.includes(ctx.authoredDifficulty)
    && ctx.antiSpam
    && ctx.antiSpam.outcome === 'won'
  ) {
    add('NAIVE_SPAM_WINS', 'warn',
      'Deterministic round-robin tunnel spam wins this Hard+ level.',
      `naive policy won in ${ctx.antiSpam.steps} step(s) — sequencing may not matter.`);
  }

  const choice = ctx.choiceMetrics;
  if (
    solvable
    && T.hardTiers.includes(ctx.authoredDifficulty)
    && choice
    && choice.totalDecisionStates >= T.lowChoiceMinDecisions
    && choice.statesWithMultipleWinningOptions === 0
    && choice.statesWithTrapOptions === 0
    && choice.multiOptionStates === 0
  ) {
    add('LOW_MEANINGFUL_CHOICE', 'info',
      `Authored ${ctx.authoredDifficulty} but the winning line has no branching decisions.`,
      `${choice.forcedStates}/${choice.totalDecisionStates} decision states are forced.`);
  }

  const pressure = ctx.resourcePressure ?? ctx.holdingPressure;
  if (
    solvable
    && T.hardTiers.includes(ctx.authoredDifficulty)
    && pressure.maxHolding === 0
    && pressure.manualRelaunches === 0
  ) {
    add('HOLDING_IRRELEVANCE', 'warn',
      `Authored ${ctx.authoredDifficulty} but Holding is unused on the winning line.`,
      'peak Holding 0 and no manual relaunches — Hard+ should use the tray.');
  }

  return out;
}
