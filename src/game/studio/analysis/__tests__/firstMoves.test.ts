import {
  FIRST_MOVE_THRESHOLDS, classifyFirstMove, classifyFirstMoves, isBetterFirstMove,
  type FirstMoveMetrics,
} from '../firstMoves';

const m = (o: Partial<FirstMoveMetrics>): FirstMoveMetrics => ({
  solvable: true, winLength: 5, peakHolding: 1, lossAfter: 0.1, ...o,
});

test('an unsolvable move is DEAD-END', () => {
  expect(classifyFirstMove(m({ solvable: false }), m({})).classification).toBe('DEAD-END');
});

test('the only solvable move is always VIABLE', () => {
  expect(classifyFirstMove(m({ winLength: 20 }), null).classification).toBe('VIABLE');
});

test('a move equal to the best is VIABLE', () => {
  const best = m({ winLength: 5, peakHolding: 1, lossAfter: 0.1 });
  expect(classifyFirstMove(m({ winLength: 5, peakHolding: 1, lossAfter: 0.1 }), best).classification).toBe('VIABLE');
});

test('a materially longer continuation is DANGEROUS', () => {
  const best = m({ winLength: 4 });
  const move = m({ winLength: 4 + FIRST_MOVE_THRESHOLDS.extraLength });
  const r = classifyFirstMove(move, best);
  expect(r.classification).toBe('DANGEROUS');
  expect(r.reasons[0]).toMatch(/moves vs best line/);
});

test('a materially higher peak Holding is DANGEROUS', () => {
  const best = m({ peakHolding: 1 });
  expect(classifyFirstMove(m({ peakHolding: 1 + FIRST_MOVE_THRESHOLDS.extraPeakHolding }), best).classification).toBe('DANGEROUS');
});

test('a materially higher loss probability is DANGEROUS', () => {
  const best = m({ lossAfter: 0.1 });
  expect(classifyFirstMove(m({ lossAfter: 0.1 + FIRST_MOVE_THRESHOLDS.extraLoss }), best).classification).toBe('DANGEROUS');
});

test('just under every threshold is still VIABLE', () => {
  const best = m({ winLength: 4, peakHolding: 1, lossAfter: 0.1 });
  const move = m({
    winLength: 4 + FIRST_MOVE_THRESHOLDS.extraLength - 1,
    peakHolding: 1 + FIRST_MOVE_THRESHOLDS.extraPeakHolding - 1,
    lossAfter: 0.1 + FIRST_MOVE_THRESHOLDS.extraLoss - 0.01,
  });
  expect(classifyFirstMove(move, best).classification).toBe('VIABLE');
});

test('classifyFirstMoves picks the best solvable member and rates the rest against it', () => {
  const moves = [
    m({ solvable: false }),
    m({ winLength: 4, peakHolding: 0, lossAfter: 0 }),           // the best
    m({ winLength: 12, peakHolding: 3, lossAfter: 0.5 }),        // clearly dangerous
    m({ winLength: 4, peakHolding: 0, lossAfter: 0 }),           // ties the best → viable
  ];
  const cls = classifyFirstMoves(moves).map((c) => c.classification);
  expect(cls).toEqual(['DEAD-END', 'VIABLE', 'DANGEROUS', 'VIABLE']);
});

test('isBetterFirstMove orders by length, then Holding, then loss', () => {
  expect(isBetterFirstMove(m({ winLength: 3 }), m({ winLength: 4 }))).toBe(true);
  expect(isBetterFirstMove(m({ winLength: 4, peakHolding: 0 }), m({ winLength: 4, peakHolding: 2 }))).toBe(true);
  expect(isBetterFirstMove(m({ winLength: 4, peakHolding: 1, lossAfter: 0.1 }), m({ winLength: 4, peakHolding: 1, lossAfter: 0.3 }))).toBe(true);
});
