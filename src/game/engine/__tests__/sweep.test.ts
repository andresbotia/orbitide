import { createGame } from '../createGame';
import { applyChargePass, clearOrder, reachablePixels, pixelEncounterFraction } from '../pixels';
import { resolveLaunch } from '../resolveLaunch';
import { settleHolding } from '../resolveHolding';
import type { LevelDefinition } from '../types';

const level: LevelDefinition = {
  id: 990, title: 'Sweep', themeId: 'test', difficulty: 'easy', holdingCapacity: 3,
  pixelArt: ['WWW', '...', '.W.'],
  tunnels: Array.from({ length: 3 }, () => [{ color: 'white' as const, capacity: 3 }]),
};

test.each([0, 1])('T%i encounters the top row left to right without an arbitrary gap', (index) => {
  const state = createGame(level);
  if (index === 1) state.pixels.find((p) => p.y === 2)!.cleared = true;
  const result = resolveLaunch(state, `tunnel-${index}`);
  expect(result.primaryClearedPixelIds).toEqual(state.pixels.filter((p) => p.y === 0).map((p) => p.id));
  expect(result.state.tunnels[index]!.queue).toHaveLength(0);
  expect(state.tunnels[index]!.queue).toHaveLength(1);
});

test('T3 starts at bottom, then wraps around to the top row', () => {
  const state = createGame(level);
  const result = resolveLaunch(state, 'tunnel-2');
  const points = result.primaryClearedPixelIds.map((id) => state.pixels.find((p) => p.id === id)!);
  expect(points.map((p) => [p.x, p.y])).toEqual([[1, 2], [0, 0], [1, 0]]);
});

test('Holding uses its bottom entry and is independent of pixel storage order', () => {
  const state = createGame(level);
  state.holding = [{ id: 'held', color: 'white', capacity: 3 }];
  const reversed = { ...state, pixels: [...state.pixels].reverse().map((p) => ({ ...p })), holding: state.holding.map((c) => ({ ...c })) };
  const result = settleHolding(state);
  expect(settleHolding(reversed)).toEqual(result);
  expect(result[0]!.clearedPixelIds).toEqual(['L990-p1-2', 'L990-p0-0', 'L990-p1-0']);
});

test('angle ties use nearest (outer) radius, then stable id', () => {
  const state = createGame(level);
  const base = state.pixels[0]!;
  const pixels = [
    { ...base, id: 'b', x: 1, y: 0.5 },
    { ...base, id: 'a', x: 1, y: 0.5 },
    { ...base, id: 'outer', x: 1, y: 0 },
  ];
  expect(pixels.sort(clearOrder(state, 0.5)).map((p) => p.id)).toEqual(['outer', 'a', 'b']);
});

test('a pass still uses one exposure snapshot and excludes buried matching pixels', () => {
  const state = createGame({ ...level, pixelArt: ['WWW', 'WWW', 'WWW'] });
  const legal = new Set(reachablePixels(state).map((p) => p.id));
  const result = applyChargePass(state, 'white', 9, 0.5);
  expect(result.clearedPixelIds).toHaveLength(8);
  expect(result.clearedPixelIds.every((id) => legal.has(id))).toBe(true);
  expect(state.pixels.find((p) => p.x === 1 && p.y === 1)!.cleared).toBe(false);
});

test('the centre is equally near at every angle and is encountered at entry', () => {
  const state = createGame({ ...level, pixelArt: ['...', '.W.', '...'] });
  for (const entry of [0, 0.2, 0.5, 0.9]) {
    expect(pixelEncounterFraction(state, state.pixels[0]!, entry)).toBe(entry);
  }
});
