/**
 * Aggregate witness decision-state stats produced by the solver memo walk.
 *
 * Definitions (M5.6D):
 *   forced state          — exactly 1 legal accepted player action
 *   multi-option state    — 2+ legal accepted actions
 *   multiple-winning-opts — 2+ actions with a winning continuation
 *   trap option           — ≥1 legal action is unsolvable while another still wins
 *
 * Trap / winning-continuation classification is exact when the concurrent
 * solve completed (the solver reuses visited subtrees). Truncated runs yield
 * {@link EMPTY_CHOICE_METRICS}.
 */
import type { DecisionStat } from '@/game/engine/solver';
import type { ChoiceMetrics } from './types';

export const EMPTY_CHOICE_METRICS: ChoiceMetrics = {
  totalDecisionStates: 0,
  forcedStates: 0,
  multiOptionStates: 0,
  statesWithMultipleWinningOptions: 0,
  statesWithTrapOptions: 0,
};

export function choiceMetricsFromStats(stats: readonly DecisionStat[]): ChoiceMetrics {
  if (stats.length === 0) return EMPTY_CHOICE_METRICS;
  let forcedStates = 0;
  let multiOptionStates = 0;
  let statesWithMultipleWinningOptions = 0;
  let statesWithTrapOptions = 0;
  for (const s of stats) {
    if (s.legalCount === 1) forcedStates += 1;
    if (s.legalCount >= 2) multiOptionStates += 1;
    if (s.winningCount >= 2) statesWithMultipleWinningOptions += 1;
    if (s.winningCount >= 1 && s.losingCount >= 1) statesWithTrapOptions += 1;
  }
  return {
    totalDecisionStates: stats.length,
    forcedStates,
    multiOptionStates,
    statesWithMultipleWinningOptions,
    statesWithTrapOptions,
  };
}
