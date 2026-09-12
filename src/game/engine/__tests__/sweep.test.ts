import { createGame } from '../createGame';
import { startPass, advancePass, resolvePass } from '../pass';
import { resolveLaunch } from '../resolveLaunch';
import { reachablePixels } from '../pixels';
import type { LevelDefinition } from '../types';
const base: LevelDefinition = { id: 990, title: 'Encounter', themeId: 'test', difficulty: 'easy', holdingCapacity: 3,
  pixelArt: ['.W.', 'W.W', '.W.'],
  tunnels: Array.from({ length: 3 }, () => [{ color: 'white', capacity: 4 }]),
};
test('every tunnel uses identical bottom-left-top-right encounter order', () => {
  const state = createGame(base);
  for (const id of ['tunnel-0', 'tunnel-1', 'tunnel-2']) {
    const result = resolveLaunch(state, id);
    expect(result.pass!.encounters.map((e) => e.pixelId)).toEqual(['L990-p1-2', 'L990-p0-1', 'L990-p1-0', 'L990-p2-1']);
    expect(result.pass!.encounters.map((e) => e.progress)).toEqual([0, 0, 0, 0]);
  }
});
test('a shot exposes a target encountered immediately in the SAME orbit', () => {
  const state = createGame({ ...base, pixelArt: ['RRRRR', 'RWRRR', '.WRRR', 'RRRRR', 'RRRRR'] });
  expect(reachablePixels(state).map((p) => p.id)).not.toContain('L990-p1-1');
  const pass = resolvePass(state, { id: 'charge', color: 'white', capacity: 2 });
  expect(pass.encounters.map((e) => e.pixelId)).toEqual(['L990-p1-2', 'L990-p1-1']);
  expect(pass.encounters[1]!.progress).toBe(0);
  expect(pass.charge.capacity).toBe(0);
});
test('newly exposed targets are cleared immediately by remaining capacity', () => {
  const state = createGame({ ...base, pixelArt: ['RRR.R', 'RWW.R', 'RRR.R', 'R...R', 'RRRRR'] });
  const first = resolvePass(state, { id: 'charge', color: 'white', capacity: 2 });
  expect(first.encounters.map((e) => e.pixelId)).toEqual(['L990-p2-1', 'L990-p1-1']);
  expect(first.charge.capacity).toBe(0);
});
test('same-ray targets clear outer first; newly exposed centre can be reached immediately', () => {
  const state = createGame({ ...base, pixelArt: ['WWWWW', 'WWWWW', 'WWWWW', 'WWWWW', 'WWWWW'] });
  const pass = resolvePass(state, { id: 'charge', color: 'white', capacity: 3 });
  expect(pass.encounters.map((e) => e.pixelId)).toEqual(['L990-p2-4', 'L990-p2-3', 'L990-p2-2']);
  expect(pass.encounters.map((e) => e.progress)).toEqual([0, 0, 0]);
});
test('pixel storage order cannot change deterministic encounter selection', () => {
  const state = createGame(base);
  const charge = { id: 'charge', color: 'white' as const, capacity: 3 };
  expect(resolvePass({ ...state, pixels: [...state.pixels].reverse() }, charge).encounters)
    .toEqual(resolvePass(state, charge).encounters);
});
test('stepwise pass and whole-pass resolution agree without mutating snapshots', () => {
  const state = createGame(base);
  const charge = { id: 'charge', color: 'white' as const, capacity: 4 };
  const start = startPass(state, charge);
  const snapshot = JSON.stringify(start);
  let pass = start;
  while (pass.phase !== 'finished') pass = advancePass(pass);
  expect(pass).toEqual(resolvePass(state, charge));
  expect(JSON.stringify(start)).toBe(snapshot);
  expect(advancePass(pass)).toBe(pass);
});
test('no matching target means one complete orbit, no clears, unchanged capacity', () => {
  const pass = resolvePass(createGame(base), { id: 'charge', color: 'green', capacity: 3 });
  expect(pass.progress).toBe(1);
  expect(pass.encounters).toEqual([]);
  expect(pass.charge.capacity).toBe(3);
});
