import { createGame } from '../../engine/createGame';
import { iceLayers, shieldLayers } from '../../engine/frozen';
import { resolveAction } from '../../engine/resolveLaunch';
import { solve } from '../../engine/solver';
import { traceActions } from '../../engine/trace';
import { CAMPAIGN_MANIFEST } from '../campaign';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';

const added = LEVEL_DEFINITIONS.filter((level) => level.id >= 31 && level.id <= 60);

test('M4B adds three ordered ten-level worlds and Levels 31-60', () => {
  expect(added.map((level) => level.id)).toEqual(Array.from({ length: 30 }, (_, i) => i + 31));
  expect(CAMPAIGN_MANIFEST.worlds.slice(3, 6).map((world) => [world.id, world.levelIds.length])).toEqual([
    ['curio-cabinet', 10], ['prism-works', 10], ['frostglass-forge', 10],
  ]);
});

test('Shielded teaches once on L41 and never repeats the Frozen tutorial', () => {
  const tutorials = LEVEL_DEFINITIONS.filter((level) => level.id <= 60 && level.tutorial);
  expect(tutorials.map((level) => level.id)).toEqual([21, 41]);
  expect(LEVEL_DEFINITIONS.find((level) => level.id === 41)!.tutorial).toMatch(/Shielded pixels absorb one hit/);
});

test('production modifier rollout uses one kind per cell and one durability layer', () => {
  for (const level of added) {
    for (const modifier of Object.values(level.modifiers ?? {})) expect(modifier.level ?? 1).toBe(1);
  }
  const w5 = added.filter((level) => level.themeId === 'prism-works');
  expect(w5.every((level) => Object.values(level.modifiers ?? {}).every((m) => m.kind === 'shielded'))).toBe(true);
  const w6 = added.filter((level) => level.themeId === 'frostglass-forge');
  for (const level of w6) {
    const kinds = new Set(Object.values(level.modifiers ?? {}).map((m) => m.kind));
    expect(kinds).toEqual(new Set(['frozen', 'shielded']));
  }
});

test('a production mixed Frozen + Shielded board solves and replays correctly', () => {
  const level = LEVEL_DEFINITIONS.find((candidate) => candidate.id === 52)!;
  const initial = createGame(level);
  expect(initial.pixels.some((pixel) => iceLayers(pixel) > 0)).toBe(true);
  expect(initial.pixels.some((pixel) => shieldLayers(pixel) > 0)).toBe(true);
  const result = solve(level);
  expect(result.solved).toBe(true);
  const trace = traceActions(level, result.moves);
  expect(trace.outcome).toBe('won');
  expect(trace.steps.some((step) => step.frozenBreakPixelIds.length > 0)).toBe(true);
  expect(trace.steps.some((step) => step.shieldBreakPixelIds.length > 0)).toBe(true);
  let state = initial;
  for (const action of result.moves) state = resolveAction(state, action).state;
  expect(state.status).toBe('won');
});
