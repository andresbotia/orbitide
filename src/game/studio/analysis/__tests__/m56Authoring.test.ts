/**
 * M5.6B–G targeted authoring metrics: geometry, board/queue, choice, anti-spam,
 * resource pressure, palette. Fixtures are not campaign levels.
 */
import { createGame } from '@/game/engine/createGame';
import { solve } from '@/game/engine/solver';
import { traceActions } from '@/game/engine/trace';
import { LEVEL_DEFINITIONS } from '../../../levels/levelDefinitions';
import { evaluateRoundRobinSpam } from '../antiSpam';
import { boardMetrics } from '../boardMetrics';
import { choiceMetricsFromStats } from '../choiceMetrics';
import { directionalGeometry } from '../directionalGeometry';
import { holdingPressure } from '../holdingPressure';
import {
  adjacentPaletteComparisons, compareLevelPalettes, PALETTE_REPEAT_THRESHOLDS, paletteRepeatWarning,
} from '../palette';
import { queueMetrics } from '../queueMetrics';
import { resourcePressure } from '../resourcePressure';
import { OBVIOUS_EASY } from '../__fixtures__/levels';
import {
  V2_EXPOSED_CORNERS, V2_FORCED, V2_HOLDING_RELAUNCH, V2_LAYERED_BLOCK,
  V2_MULTI_OPTION, V2_SPAM_FAILS, V2_SPAM_WINS, V2_TRAP,
} from '../__fixtures__/coreV2';

describe('directional geometry', () => {
  test('front/rear layered Core V2 fixture reports buried depth', () => {
    const g = directionalGeometry(createGame(V2_LAYERED_BLOCK));
    expect(g.mode).toBe('coreV2');
    expect(g.initiallyExposed).toBe(8);
    expect(g.buried).toBe(1);
    expect(g.maxLayerDepth).toBeGreaterThanOrEqual(1);
    expect(g.averageLayerDepth).toBeGreaterThan(0);
    expect(g.singleSideExposed + g.multiSideExposed).toBe(g.initiallyExposed);
  });

  test('exposed Core V2 fixture reports correct initial exposure', () => {
    const g = directionalGeometry(createGame(V2_EXPOSED_CORNERS));
    expect(g.mode).toBe('coreV2');
    expect(g.initiallyExposed).toBe(4);
    expect(g.buried).toBe(0);
    expect(g.maxLayerDepth).toBe(0);
    expect(g.averageLayerDepth).toBe(0);
  });

  test('Legacy fixture still uses legacy flood-fill analysis, not Core V2 rays', () => {
    const g = directionalGeometry(createGame(OBVIOUS_EASY));
    expect(g.mode).toBe('legacyV1');
    // 4×4 solid: the outer ring is flood-fill reachable (12), the 2×2 interior is buried.
    expect(g.initiallyExposed).toBe(12);
    expect(g.buried).toBe(4);
  });
});

describe('board and queue metrics', () => {
  test('occupied count / density / colours are correct', () => {
    const b = boardMetrics(OBVIOUS_EASY);
    expect(b.rows).toBe(4);
    expect(b.cols).toBe(4);
    expect(b.totalCells).toBe(16);
    expect(b.occupiedCells).toBe(16);
    expect(b.density).toBe(1);
    expect(b.uniqueColors).toBe(1);
    expect(b.colorHistogram.white).toBe(16);
    expect(b.dominantColors).toEqual(['white']);
  });

  test('queue depths follow the authored tunnels and do not hardcode 4', () => {
    const legacy = queueMetrics(OBVIOUS_EASY);
    expect(legacy.tunnelCount).toBe(3);
    expect(legacy.perTunnelDepth).toEqual([1, 1, 1]);
    expect(legacy.totalCharges).toBe(3);
    expect(legacy.maxTunnelDepth).toBe(1);
    expect(legacy.minTunnelDepth).toBe(1);

    const v2 = queueMetrics(V2_SPAM_WINS);
    expect(v2.tunnelCount).toBe(3);
    expect(v2.perTunnelDepth).toEqual([1, 1, 1]);
    expect(v2.totalCharges).toBe(3);
  });
});

describe('choice metrics', () => {
  test('forced fixture: every witness decision has exactly one legal action', () => {
    const r = solve(V2_FORCED);
    expect(r.solved).toBe(true);
    const c = choiceMetricsFromStats(r.decisionStats);
    expect(c.totalDecisionStates).toBeGreaterThanOrEqual(1);
    expect(c.forcedStates).toBe(c.totalDecisionStates);
    expect(c.multiOptionStates).toBe(0);
  });

  test('multi-option fixture has a 2+ action decision', () => {
    const r = solve(V2_MULTI_OPTION);
    expect(r.solved).toBe(true);
    const c = choiceMetricsFromStats(r.decisionStats);
    expect(c.multiOptionStates).toBeGreaterThanOrEqual(1);
    expect(c.statesWithMultipleWinningOptions).toBeGreaterThanOrEqual(1);
  });

  test('trap-option fixture has a winning continuation and a losing one', () => {
    const r = solve(V2_TRAP);
    expect(r.solved).toBe(true);
    const c = choiceMetricsFromStats(r.decisionStats);
    expect(c.statesWithTrapOptions).toBeGreaterThanOrEqual(1);
    expect(r.firstMoves.some((m) => m.solvable) && r.firstMoves.some((m) => !m.solvable)).toBe(true);
  });
});

describe('anti-spam round-robin', () => {
  test('simple Easy fixture is won by the naive policy', () => {
    const r = evaluateRoundRobinSpam(V2_SPAM_WINS);
    expect(r.policy).toBe('round-robin');
    expect(r.outcome).toBe('won');
    expect(r.steps).toBeGreaterThan(0);
  });

  test('sequencing-sensitive fixture is not won by naive spam', () => {
    const r = evaluateRoundRobinSpam(V2_SPAM_FAILS);
    expect(r.outcome).not.toBe('won');
  });

  test('repeated runs return an identical anti-spam result', () => {
    const a = evaluateRoundRobinSpam(V2_SPAM_WINS);
    const b = evaluateRoundRobinSpam(V2_SPAM_WINS);
    expect(a).toEqual(b);
    const c = evaluateRoundRobinSpam(V2_SPAM_FAILS);
    const d = evaluateRoundRobinSpam(V2_SPAM_FAILS);
    expect(c).toEqual(d);
  });
});

describe('resource pressure', () => {
  test('Holding utilization is peak / capacity on the winning line', () => {
    const def = V2_HOLDING_RELAUNCH;
    const r = solve(def);
    const trace = traceActions(def, r.moves);
    const holding = holdingPressure(trace, def.holdingCapacity);
    const p = resourcePressure({ holding });
    expect(p.holdingCapacity).toBe(def.holdingCapacity);
    expect(p.maxHolding).toBeGreaterThanOrEqual(1);
    expect(p.holdingUtilization).toBe(p.maxHolding / p.holdingCapacity);
    expect(p.manualRelaunches).toBeGreaterThanOrEqual(1);
    expect(p.chargesEnteringHolding).toBeGreaterThanOrEqual(1);
  });

  test('Active-slot pressure is not a solver resource — it is presentation', () => {
    // The solver searches logical choices only (a join resolves like a
    // settle-first launch), so it has no Active peak to report.
    const def = V2_SPAM_WINS;
    const r = solve(def);
    const p = resourcePressure({ holding: holdingPressure(traceActions(def, r.moves), def.holdingCapacity) });
    expect(p).not.toHaveProperty('activeUtilization');
    expect(p).not.toHaveProperty('maxActive');
  });
});

describe('palette comparison', () => {
  test('similarity is deterministic and Jaccard is 1 for identical palettes', () => {
    const a = compareLevelPalettes(OBVIOUS_EASY, OBVIOUS_EASY);
    const b = compareLevelPalettes(OBVIOUS_EASY, OBVIOUS_EASY);
    expect(a).toEqual(b);
    expect(a.jaccard).toBe(1);
    expect(a.dominantOverlap).toBe(1);
  });

  test('dominant overlap counts shared dominant colours', () => {
    const redOnly: typeof OBVIOUS_EASY = {
      ...OBVIOUS_EASY,
      id: 8011,
      pixelArt: ['RRRR', 'RRRR', 'RRRR', 'RRRR'],
    };
    const blueOnly: typeof OBVIOUS_EASY = {
      ...OBVIOUS_EASY,
      id: 8012,
      pixelArt: ['BBBB', 'BBBB', 'BBBB', 'BBBB'],
    };
    const redWhite: typeof OBVIOUS_EASY = {
      ...OBVIOUS_EASY,
      id: 8013,
      pixelArt: ['RRRR', 'RRRR', 'WWWW', 'WWWW'],
    };
    const redWhite2: typeof OBVIOUS_EASY = {
      ...OBVIOUS_EASY,
      id: 8014,
      pixelArt: ['RRRR', 'RRRR', 'WWWW', 'WWWW'],
    };

    const disjoint = compareLevelPalettes(redOnly, blueOnly);
    expect(disjoint.jaccard).toBe(0);
    expect(disjoint.dominantOverlap).toBe(0);

    const tied = compareLevelPalettes(redWhite, redWhite2);
    expect(tied.jaccard).toBe(1);
    expect(tied.dominantOverlap).toBe(2);

    const adjacent = adjacentPaletteComparisons([redOnly, redWhite, redWhite2]);
    expect(adjacent).toHaveLength(2);
    expect(adjacent[1]!.dominantOverlap).toBe(2);
    expect(paletteRepeatWarning(adjacent[1]! )?.code).toBe('PALETTE_REPEAT');

    const warn = paletteRepeatWarning({
      jaccard: PALETTE_REPEAT_THRESHOLDS.jaccard,
      dominantOverlap: PALETTE_REPEAT_THRESHOLDS.dominantOverlap,
    });
    expect(warn?.code).toBe('PALETTE_REPEAT');
    expect(paletteRepeatWarning({ jaccard: 0.5, dominantOverlap: 2 })).toBeNull();
  });

  test('a Legacy campaign level still compares cheaply without a solver', () => {
    const cmp = compareLevelPalettes(LEVEL_DEFINITIONS[0]!, LEVEL_DEFINITIONS[1]!);
    expect(cmp.jaccard).toBeGreaterThanOrEqual(0);
    expect(cmp.jaccard).toBeLessThanOrEqual(1);
    expect(Number.isInteger(cmp.dominantOverlap)).toBe(true);
  });
});
