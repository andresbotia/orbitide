import { createGame } from '../../engine/createGame';
import { resolveLaunch } from '../../engine/resolveLaunch';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';
import { solve, audit } from '../../engine/__tests__/solver';

test('exhaustive early campaign audit', () => {
  for (const level of LEVEL_DEFINITIONS) {
    const result = audit(level);
    const line = solve(level);
    if (process.env.REPORT_METRICS) console.log(JSON.stringify({ id: level.id, audit: result, solution: line }));
    expect(result.failPath !== null).toBe(level.id >= 5);
    expect(result.minWinningPeak).toBe(level.id >= 4 ? 1 : 0);
    expect(result.peakHolding).toBe(level.id === 1 ? 0 : level.id < 5 ? 1 : 3);
    if (result.failPath) {
      let state = createGame(level);
      for (const move of result.failPath) state = resolveLaunch(state, move).state;
      expect(state.status).toBe('lost');
    }
    expect(result.complete).toBe(true);
    expect(line.solved).toBe(true);
  }
});

test('sequencing pressure rises from the first fail risk through Hard', () => {
  const losses = LEVEL_DEFINITIONS.slice(4).map((level) => audit(level).lossProbability);
  for (let i = 1; i < losses.length; i++) expect(losses[i]).toBeGreaterThan(losses[i - 1]!);
});
