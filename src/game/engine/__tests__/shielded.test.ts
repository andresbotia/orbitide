import { createGame } from '../createGame';
import { boardFingerprint, iceLayers, shieldLayers } from '../frozen';
import { resolveAction } from '../resolveLaunch';
import { solve, stateKey } from '../solver';
import { traceActions } from '../trace';
import type { LevelDefinition } from '../types';

const SHIELD: LevelDefinition = {
  id: 9750, title: 'Shield Fixture', themeId: 'fixture', difficulty: 'easy', holdingCapacity: 3,
  pixelArt: ['WWW'],
  modifiers: { '1,0': { kind: 'shielded', level: 1 } },
  tunnels: [[{ color: 'white', capacity: 4 }], [], []],
};

const T0 = { kind: 'tunnel' as const, id: 'tunnel-0' };
const centre = (s: ReturnType<typeof createGame>) => s.pixels.find((p) => p.x === 1)!;

test('first matching hit spends capacity, breaks the shield, and leaves the pixel', () => {
  const out = resolveAction(createGame(SHIELD), T0);
  expect(centre(out.state).cleared).toBe(false);
  expect(shieldLayers(centre(out.state))).toBe(0);
  expect(centre(out.state).modifier).toMatchObject({ kind: 'shielded', state: 'broken', level: 0 });
  expect(out.state.holding[0]!.capacity).toBe(1);
});

test('a later matching hit clears the exposed base pixel', () => {
  let state = resolveAction(createGame(SHIELD), T0).state;
  state = resolveAction(state, { kind: 'holding', id: state.holding[0]!.id }).state;
  expect(centre(state).cleared).toBe(true);
  expect(state.status).toBe('won');
});

test('normal, Frozen intact/broken, and Shielded intact/broken hash distinctly', () => {
  const normal = createGame({ ...SHIELD, id: 9751, modifiers: undefined });
  const shield = createGame(SHIELD);
  const frozen = createGame({ ...SHIELD, id: 9752, modifiers: { '1,0': { kind: 'frozen', level: 1 } } });
  const brokenShield = resolveAction(shield, T0).state;
  const brokenFrozen = resolveAction(frozen, T0).state;
  const states = [normal, shield, frozen, brokenShield, brokenFrozen];
  expect(new Set(states.map((s) => boardFingerprint(s.pixels))).size).toBe(5);
  expect(new Set(states.map(stateKey)).size).toBe(5);
  expect(iceLayers(centre(brokenShield))).toBe(0);
});

test('concurrent charges produce one shield break and one clear, never a double break', () => {
  const level: LevelDefinition = {
    ...SHIELD, id: 9753, pixelArt: ['.W.'],
    tunnels: [[{ color: 'white', capacity: 1 }], [{ color: 'white', capacity: 1 }], []],
  };
  const first = resolveAction(createGame(level), T0).state;
  const joined = resolveAction(first, { kind: 'tunnel', id: 'tunnel-1', join: true });
  const encounters = joined.epochCharges!.flatMap((c) => c.encounters);
  expect(encounters.filter((e) => e.shieldBreak)).toHaveLength(1);
  expect(encounters.filter((e) => !e.shieldBreak && !e.frozenBreak)).toHaveLength(1);
  expect(joined.state.status).toBe('won');
});

test('solver counts the extra hit and rejects an under-capacity board', () => {
  const plain: LevelDefinition = { ...SHIELD, id: 9754, modifiers: undefined,
    tunnels: [[{ color: 'white', capacity: 3 }], [], []] };
  expect(solve(SHIELD).length).toBeGreaterThan(solve(plain).length);
  const short: LevelDefinition = { ...SHIELD, id: 9755, pixelArt: ['.W.'],
    tunnels: [[{ color: 'white', capacity: 1 }], [], []] };
  expect(solve(short).solved).toBe(false);
});

test('trace emits SHIELD_BREAK separately from PIXEL_CLEAR', () => {
  const result = solve(SHIELD);
  const trace = traceActions(SHIELD, result.moves);
  const id = centre(createGame(SHIELD)).id;
  expect(trace.steps.flatMap((s) => s.shieldBreakPixelIds)).toContain(id);
  expect(trace.steps.flatMap((s) => s.clearedPixelIds)).toContain(id);
  for (const step of trace.steps) {
    expect(step.shieldBreakPixelIds.some((x) => step.clearedPixelIds.includes(x))).toBe(false);
  }
});
