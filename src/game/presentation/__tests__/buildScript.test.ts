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
  expect(pass.terminal).toEqual({ kind: 'toHolding', slot: 0 });
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

test('Linked prime and atomic discharge use distinct semantic events', () => {
  const linked: LevelDefinition = {
    ...level, id: 802, pixelArt: ['R.B'],
    modifiers: {
      '0,0': { kind: 'linked', group: 'pair-a' },
      '2,0': { kind: 'linked', group: 'pair-a' },
    },
    tunnels: [[{ color: 'red', capacity: 1 }], [{ color: 'blue', capacity: 1 }], []],
  };
  const initial = createGame(linked);
  const first = resolveLaunch(initial, 'tunnel-0');
  const prime = buildLaunchScript(first, initial).pass;
  expect(prime.events).toContainEqual(expect.objectContaining({
    kind: 'linkPrime', groupId: 'pair-a', pixelId: 'L802-p0-0',
  }));
  expect(prime.events.some((event) => event.kind === 'pixelClear')).toBe(false);

  const second = resolveLaunch(first.state, 'tunnel-1');
  const discharge = buildLaunchScript(second, first.state).pass;
  expect(discharge.events).toContainEqual(expect.objectContaining({
    kind: 'linkGroupClear', groupId: 'pair-a', pixelIds: ['L802-p0-0', 'L802-p2-0'], final: true,
  }));
  expect(discharge.shots[0]!.linkedClearTargets).toHaveLength(2);
});

test('an unresolved Pal overflowing full holding completes full lap to terminal point, does not land in holding, and schedules fail after terminal burst', () => {
  const overflowLevel: LevelDefinition = {
    id: 805, title: 'BuildScript Overflow', themeId: 'test', difficulty: 'easy', holdingCapacity: 2,
    pixelArt: ['WWW', 'WWW', 'WWW'],
    tunnels: [
      [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
      [{ color: 'blue', capacity: 1 }],
      [{ color: 'blue', capacity: 1 }],
    ],
  };
  let state = createGame(overflowLevel);
  // Fill holding
  state = resolveLaunch(state, 'tunnel-0').state;
  state = resolveLaunch(state, 'tunnel-1').state;
  expect(state.holding).toHaveLength(2);

  // Launch third blue Pal (miss -> overflow)
  const outcome = resolveLaunch(state, 'tunnel-2');
  expect(outcome.state.status).toBe('lost');
  expect(outcome.state.holding).toHaveLength(2);

  const pass = buildLaunchScript(outcome, state).pass;
  expect(pass.terminal).toEqual({ kind: 'reject' }); // no slot, no target
  expect(pass.endProgress).toBe(1);
  expect(pass.orbitEndAt - pass.liftMs).toBe(FEEL.ORBIT_DURATION);
  expect(pass.landingAt).toBe(pass.orbitEndAt + FEEL.BURST_DURATION);
  expect(pass.events.some((e) => e.kind === 'holdingLanded')).toBe(false);

  const failEvent = pass.events.find((e) => e.kind === 'fail');
  expect(failEvent).toBeDefined();
  expect(failEvent!.at).toBe(pass.landingAt + FEEL.FAIL_DELAY);

  const completeEvent = pass.events.find((e) => e.kind === 'complete');
  expect(completeEvent).toBeDefined();
  // Completes on the result beat itself (one commit), presented after it.
  expect(completeEvent!.at).toBe(failEvent!.at);
  expect(pass.events.indexOf(completeEvent!)).toBeGreaterThan(pass.events.indexOf(failEvent!));
});

test('an unresolved Pal with hits that overflows Holding still completes full lap to terminal point without cutting orbit short', () => {
  const partialLevel: LevelDefinition = {
    id: 806, title: 'Partial Overflow', themeId: 'test', difficulty: 'easy', holdingCapacity: 1,
    pixelArt: ['W', 'B'],
    tunnels: [
      [{ color: 'white', capacity: 1 }],
      [{ color: 'red', capacity: 1 }],
      [{ color: 'blue', capacity: 2 }],
    ],
  };
  let state = createGame(partialLevel);
  // Tunnel-1 (red) misses and enters holding (1/1)
  state = resolveLaunch(state, 'tunnel-1').state;
  expect(state.holding).toHaveLength(1);

  // Tunnel-2 (blue, capacity 2) clears the 1 blue pixel, capacity 1 remaining, holding full -> overflow
  const outcome = resolveLaunch(state, 'tunnel-2');
  expect(outcome.state.status).toBe('lost');
  expect(outcome.heldCharge?.capacity).toBe(1);
  expect(outcome.state.holding).toHaveLength(1);

  const pass = buildLaunchScript(outcome, state).pass;
  expect(pass.shots).toHaveLength(1);
  // Orbit MUST NOT be cut short at the shot clear time:
  expect(pass.endProgress).toBe(1);
  expect(pass.orbitEndAt).toBeGreaterThan(pass.shots[0]!.clearAt);
  expect(pass.terminal).toEqual({ kind: 'reject' });
  expect(pass.landingAt).toBe(pass.orbitEndAt + FEEL.BURST_DURATION);
  expect(pass.events.some((e) => e.kind === 'holdingLanded')).toBe(false);

  const failEvent = pass.events.find((e) => e.kind === 'fail');
  expect(failEvent).toBeDefined();
  expect(failEvent!.at).toBe(pass.landingAt + FEEL.FAIL_DELAY);
});

