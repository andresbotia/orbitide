import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import { analyzeStudioLevel, describeAction } from '../analyze';
import { addCharge, createBlankLevel, paintCell } from '../model';
import { fromLevelDefinition } from '../serialize';

test('a campaign level analyses as solvable, exposing the useful solver data', () => {
  const analysis = analyzeStudioLevel(fromLevelDefinition(LEVEL_DEFINITIONS[0]!));
  expect(analysis.status).toBe('solved');
  expect(analysis.solvable).toBe(true);
  expect(analysis.result).not.toBeNull();
  expect(analysis.result!.length).toBeGreaterThan(0);
  expect(analysis.result!.viableFirstMoves).toBe(3);
  expect(analysis.result!.nodes).toBeGreaterThan(0);
  expect(analysis.elapsedMs).toBeGreaterThanOrEqual(0);
});

test('an under-budget level analyses as unsolvable', () => {
  let level = createBlankLevel({ width: 5, height: 5 });
  level = paintCell(paintCell(level, 0, 0, 'white'), 1, 0, 'white');
  level = addCharge(level, 0, { color: 'white', capacity: 1 }); // only clears one of two
  const analysis = analyzeStudioLevel(level);
  expect(analysis.status).toBe('unsolvable');
  expect(analysis.solvable).toBe(false);
  expect(analysis.result!.solved).toBe(false);
});

test('a pre-cancelled signal reports "cancelled", not a crash', () => {
  const analysis = analyzeStudioLevel(fromLevelDefinition(LEVEL_DEFINITIONS[8]!), {
    signal: { cancelled: true },
  });
  expect(analysis.status).toBe('cancelled');
  expect(analysis.result).toBeNull();
  expect(analysis.error).toBeNull();
});

test('a node-cap overflow is surfaced as an error, editor keeps working', () => {
  const analysis = analyzeStudioLevel(fromLevelDefinition(LEVEL_DEFINITIONS[8]!), { nodeCap: 5 });
  expect(analysis.status).toBe('error');
  expect(analysis.error).toMatch(/exceeded/);
});

test('describeAction is readable', () => {
  expect(describeAction({ kind: 'tunnel', id: 'tunnel-1' })).toBe('Tunnel 1');
  expect(describeAction({ kind: 'tunnel', id: 'tunnel-2', join: true })).toBe('Tunnel 2 (join)');
  expect(describeAction({ kind: 'holding', id: 'L4-t0-c1' })).toBe('Holding L4-t0-c1');
});
