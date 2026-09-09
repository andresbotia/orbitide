import { analyzeBatch, toBatchRow } from '../batch';
import { analyzeLevel } from '../analyzeLevel';
import { ALL_FIXTURES, OBVIOUS_EASY, UNSOLVABLE } from '../__fixtures__/levels';
import { LEVEL_DEFINITIONS } from '../../../levels/levelDefinitions';

test('a batch produces one row per level with the expected shape', async () => {
  const fixtures = [OBVIOUS_EASY, UNSOLVABLE];
  const result = await analyzeBatch(fixtures, { now: () => 0 });
  expect(result.complete).toBe(true);
  expect(result.cancelled).toBe(false);
  expect(result.rows.map((r) => r.levelId)).toEqual(fixtures.map((f) => f.id));

  const row = result.rows[0]!;
  expect(row).toMatchObject({
    levelId: OBVIOUS_EASY.id,
    title: 'Obvious Easy',
    authoredDifficulty: 'easy',
    suggestedDifficulty: 'easy',
    solvable: true,
  });
  expect(typeof row.score).toBe('number');
  expect(row.warningCount).toBe(row.warnings.length);

  expect(result.rows[1]!.solvable).toBe(false);
}, 120_000);

test('toBatchRow is a faithful slice of the full analysis', async () => {
  const a = await analyzeLevel(OBVIOUS_EASY, { now: () => 0 });
  const row = toBatchRow(a);
  expect(row.score).toBe(a.difficultyScore);
  expect(row.suggestedDifficulty).toBe(a.suggestedDifficulty);
  expect(row.shortestWin).toBe(a.shortestWinningLength);
  expect(row.peakHolding).toBe(a.peakHoldingOnWinningLine);
  expect(row.warnings).toEqual(a.warnings);
}, 60_000);

test('a cancelled batch stops and reports partial progress', async () => {
  const signal = { cancelled: false };
  let seen = 0;
  const result = await analyzeBatch(ALL_FIXTURES, {
    now: () => 0,
    signal,
    onProgress: (done) => { seen = done; if (done >= 2) signal.cancelled = true; },
  });
  expect(result.cancelled).toBe(true);
  expect(result.complete).toBe(false);
  expect(result.rows.length).toBe(2);
  expect(seen).toBeGreaterThanOrEqual(2);
}, 180_000);

test('batch is deterministic across runs (campaign subset)', async () => {
  const defs = LEVEL_DEFINITIONS.slice(0, 3);
  const a = await analyzeBatch(defs, { now: () => 0 });
  const b = await analyzeBatch(defs, { now: () => 0 });
  expect(a.rows).toEqual(b.rows);
}, 180_000);
