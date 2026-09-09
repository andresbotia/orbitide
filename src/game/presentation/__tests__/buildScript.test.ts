import { createGame } from '@/game/engine/createGame';
import { resolveLaunch } from '@/game/engine/resolveLaunch';
import type { LevelDefinition } from '@/game/engine/types';
import { buildLaunchScript } from '../buildScript';
import { FEEL } from '../constants';
import { capacityAt, eventCountAt, progressAt } from '../motion';
import { computeBoardLayout } from '@/game/rendering/layout';
import { flightPosition } from '@/game/rendering/flightGeometry';
const level: LevelDefinition = { id: 800, title: 'Timeline', themeId: 'test', difficulty: 'easy', holdingCapacity: 3,
  pixelArt: ['WWWWW','WWWWW','WWWWW','WWWWW','WWWWW'],
  tunnels: [[{ color: 'white', capacity: 25 }],[{ color: 'blue', capacity: 1 }],[]],
};
function script() { const state = createGame(level); return buildLaunchScript(resolveLaunch(state, 'tunnel-0'), state).pass; }
test('script consumes exact engine encounters with no reordering or new target decisions', () => {
  const state = createGame(level);
  const result = resolveLaunch(state, 'tunnel-0');
  const pass = buildLaunchScript(result, state).pass;
  expect(pass.shots.map((s) => s.pixelId)).toEqual(result.pass!.encounters.map((e) => e.pixelId));
  expect(pass.shots.map((s) => s.progress)).toEqual(result.pass!.encounters.map((e) => e.progress));
  expect(buildLaunchScript(result, state)).toEqual(buildLaunchScript(result, state));
});
test('every shot holds the orb at contact and uses its actual rendered position', () => {
  const pass = script();
  const layout = computeBoardLayout(358, 5, 5);
  for (const shot of pass.shots) {
    expect(shot.fireAt - shot.anticipateAt).toBe(20);
    expect(shot.impactAt - shot.fireAt).toBe(80);
    expect(shot.clearAt - shot.impactAt).toBe(10);
    expect(progressAt(pass, shot.fireAt)).toBe(shot.progress);
    const source = flightPosition(pass, layout, shot.fireAt);
    expect(flightPosition(pass, layout, shot.anticipateAt)).toEqual(source);
    expect(flightPosition(pass, layout, shot.impactAt)).toEqual(source);
    expect(capacityAt(pass, shot.clearAt - 0.01)).toBe(shot.remaining + 1);
    expect(capacityAt(pass, shot.clearAt)).toBe(shot.remaining);
  }
});
test('same-angle shots stay at the same source and maintain 110ms minimum clear spacing', () => {
  const pass = script();
  expect(pass.shots[0]!.progress).toBe(pass.shots[1]!.progress);
  for (let i = 1; i < pass.shots.length; i++) {
    expect(pass.shots[i]!.clearAt - pass.shots[i-1]!.clearAt).toBeGreaterThanOrEqual(110 - 1e-8);
  }
  expect(pass.orbitEndAt).toBeGreaterThanOrEqual(pass.shots.at(-1)!.clearAt - 1e-8);
});
test('a miss takes exactly one 1800ms moving lap then lands, without any automatic second pass', () => {
  const state = createGame(level);
  const pass = buildLaunchScript(resolveLaunch(state, 'tunnel-1'), state).pass;
  expect(pass.shots).toEqual([]);
  expect(pass.orbitEndAt - pass.liftMs).toBe(FEEL.ORBIT_DURATION);
  expect(pass.endKind).toBe('toHolding');
  expect(pass.events.filter((e) => e.kind === 'holdingLanded')).toHaveLength(1);
});
test('events are sorted, counted at exact boundaries, and complete after landing/result', () => {
  const pass = script();
  for (let i = 1; i < pass.events.length; i++) expect(pass.events[i]!.at).toBeGreaterThanOrEqual(pass.events[i-1]!.at);
  expect(eventCountAt(pass, 0)).toBe(0);
  expect(eventCountAt(pass, pass.totalMs)).toBe(pass.events.length);
  expect(pass.events.at(-1)!.kind).toBe('complete');
  expect(pass.totalMs).toBeGreaterThan(pass.landingAt);
});
test('rejected actions cannot produce a visual flight', () => {
  const state = createGame(level);
  expect(() => buildLaunchScript(resolveLaunch(state, 'missing'), state)).toThrow('rejected');
});

test('a winning pass flags exactly its final clear and records the winning pixel', () => {
  const state = createGame(level);
  const pass = buildLaunchScript(resolveLaunch(state, 'tunnel-0'), state).pass;
  const clears = pass.events.filter((e) => e.kind === 'pixelClear');
  expect(clears).toHaveLength(pass.shots.length);
  expect(clears.filter((e) => e.final)).toHaveLength(1);
  expect(clears[clears.length - 1]!.final).toBe(true);
  expect(pass.finalClearPixelId).toBe(pass.shots[pass.shots.length - 1]!.pixelId);
});

test('a non-winning pass carries no final-clear beat', () => {
  const state = createGame(level);
  const miss = buildLaunchScript(resolveLaunch(state, 'tunnel-1'), state).pass;
  expect(miss.events.some((e) => e.kind === 'pixelClear' && e.final)).toBe(false);
  expect(miss.finalClearPixelId).toBeUndefined();
});

test('a Shielded break emits shieldHit and is not presented as a pixel clear', () => {
  const shielded: LevelDefinition = {
    ...level, id: 801, pixelArt: ['W'],
    modifiers: { '0,0': { kind: 'shielded', level: 1 } },
    tunnels: [[{ color: 'white', capacity: 1 }], [], []],
  };
  const state = createGame(shielded);
  const pass = buildLaunchScript(resolveLaunch(state, 'tunnel-0'), state).pass;
  expect(pass.events.some((e) => e.kind === 'shieldHit')).toBe(true);
  expect(pass.events.some((e) => e.kind === 'pixelClear')).toBe(false);
  expect(pass.finalClearPixelId).toBeUndefined();
});
