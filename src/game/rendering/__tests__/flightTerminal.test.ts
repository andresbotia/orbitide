/**
 * Terminal contract geometry (§3.2): a Pal ends at its last hit (consumed), at
 * its exact Holding slot (toHolding) or bursting in place at GateTerminal
 * (reject). No generic off-screen fallback target exists.
 */
import { computeBoardGeometry } from '../boardGeometry';
import { flightPosition, flightPose } from '../flightGeometry';
import { createGame } from '../../engine/createGame';
import { resolveLaunch } from '../../engine/resolveLaunch';
import { buildLaunchScript } from '../../presentation/buildScript';
import type { FlightPass } from '../../presentation/events';
import type { LevelDefinition } from '../../engine/types';

const level: LevelDefinition = {
  id: 9731, title: 'terminal', themeId: 'test', difficulty: 'easy', holdingCapacity: 3, ruleset: 'coreV2',
  pixelArt: ['BWW', 'WWW', 'WWW'],
  tunnels: [[{ color: 'blue', capacity: 3 }], [], [], []],
};
const geo = computeBoardGeometry(320, 3, 3, { roundedRect: true, box: { width: 320, height: 320 } });

/** A toHolding pass whose slot point was never measured (no target). */
function unmeasuredToHolding(): FlightPass {
  const state = createGame(level);
  const pass = buildLaunchScript(resolveLaunch(state, 'tunnel-0'), state).pass;
  expect(pass.terminal).toEqual({ kind: 'toHolding', slot: 0 });
  return pass;
}

test('a toHolding Pal with no measured slot point never flies to an off-screen fallback', () => {
  const pass = unmeasuredToHolding();
  for (let t = pass.orbitEndAt; t <= pass.landingAt; t += 10) {
    const p = flightPosition(pass, geo, t);
    const pose = flightPose(pass, geo, t);
    expect(p.y).toBeLessThanOrEqual(geo.height + 1);
    expect(pose.y).toBeLessThanOrEqual(geo.height + 1);
  }
  // It holds at GateTerminal instead.
  expect(flightPosition(pass, geo, pass.landingAt)).toEqual(geo.gateTerminal);
});

test('GateTerminal is a named alias of the existing bottom-centre insertion point', () => {
  expect(geo.gateTerminal).toEqual(geo.insertion);
  expect(geo.gateTerminal).toEqual(geo.orbitInsertion);
});

test('toHolding flies GateTerminal → exactly its slot point', () => {
  const base = unmeasuredToHolding();
  const target = { x: 40, y: 360 };
  const pass: FlightPass = { ...base, terminal: { kind: 'toHolding', slot: 0, target } };
  expect(flightPosition(pass, geo, pass.orbitEndAt + 1e-3).x).toBeCloseTo(geo.gateTerminal.x, 0);
  expect(flightPosition(pass, geo, pass.landingAt)).toEqual(target);
});

test('reject completes the lap and bursts in place at GateTerminal (no slot, no target)', () => {
  const state = createGame({ ...level, id: 9732, holdingCapacity: 1, tunnels: [[{ color: 'blue', capacity: 3 }], [{ color: 'red', capacity: 1 }], [], []] });
  const held = resolveLaunch(state, 'tunnel-1').state; // red misses and fills the 1-slot tray
  const out = resolveLaunch(held, 'tunnel-0');
  const pass = buildLaunchScript(out, held).pass;
  expect(pass.terminal).toEqual({ kind: 'reject' });
  expect(pass.endProgress).toBe(1);
  for (const t of [pass.orbitEndAt, (pass.orbitEndAt + pass.landingAt) / 2, pass.landingAt]) {
    const p = flightPosition(pass, geo, t);
    expect(p.x).toBeCloseTo(geo.gateTerminal.x, 3);
    expect(p.y).toBeCloseTo(geo.gateTerminal.y, 3);
  }
});
