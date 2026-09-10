import { solve } from '../../engine/solver';
import { CAMPAIGN_MANIFEST } from '../campaign';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';

const range = (from: number, to: number) => LEVEL_DEFINITIONS.filter(
  (level) => level.id >= from && level.id <= to,
);

test('World 7 adds ten ordered Skybound levels with its authored curves', () => {
  const world = range(61, 70);
  expect(world.map((level) => level.id)).toEqual(Array.from({ length: 10 }, (_, index) => index + 61));
  expect(world.every((level) => level.themeId === 'skybound')).toBe(true);
  expect(world.map((level) => level.difficulty)).toEqual([
    'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'hard', 'hard',
  ]);
  expect(CAMPAIGN_MANIFEST.worlds.find((candidate) => candidate.id === 'skybound')?.levelIds)
    .toEqual(world.map((level) => level.id));
  for (const level of world) {
    const density = level.pixelArt.join('').replace(/[. ]/g, '').length;
    const colors = new Set(level.tunnels.flat().map((charge) => charge.color)).size;
    expect(density).toBeGreaterThanOrEqual(45);
    expect(density).toBeLessThanOrEqual(70);
    expect(colors).toBeGreaterThanOrEqual(6);
    expect(colors).toBeLessThanOrEqual(9);
  }
});

test.each(range(61, 70))('Skybound level $id solves in sequential and concurrent play', (level) => {
  expect(solve(level, { mode: 'sequential-compat' }).solved).toBe(true);
  expect(solve(level).solved).toBe(true);
}, 120_000);
