/**
 * Launch → rail → Holding must read as one trajectory: no position or
 * orientation snap at rail insertion or at the start of the Holding landing,
 * for any lane, and no large skipped first frame when the lift starts late.
 */
import { computeBoardGeometry } from '../boardGeometry';
import { flightPose, flightPosition } from '../flightGeometry';
import { railPoint } from '../railPath';
import { progressAt } from '../../presentation/motion';
import { createGame } from '../../engine/createGame';
import { resolveLaunch } from '../../engine/resolveLaunch';
import { buildLaunchScript } from '../../presentation/buildScript';
import { LAUNCH_HUB } from '../../presentation/constants';
import type { FlightPass } from '../../presentation/events';
import type { LevelDefinition } from '../../engine/types';

const level: LevelDefinition = {
  id: 9741, title: 'continuity', themeId: 'test', difficulty: 'easy', holdingCapacity: 3, ruleset: 'coreV2',
  pixelArt: ['WWW', 'WBW', 'WWW'],
  tunnels: [[{ color: 'blue', capacity: 3 }], [], [], []],
};
const geo = computeBoardGeometry(360, 3, 3, { roundedRect: true, box: { width: 360, height: 360 } });
const LANES = [0, 3, -3, 6, -6];

function landingPass(): FlightPass {
  const state = createGame(level);
  const base = buildLaunchScript(resolveLaunch(state, 'tunnel-0'), state).pass;
  expect(base.terminal.kind).toBe('toHolding');
  return { ...base, from: { x: 120, y: 520 }, terminal: { kind: 'toHolding', slot: 0, target: { x: 110, y: 470 } } };
}
function angleGap(a: number, b: number): number {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(d, Math.PI * 2 - d);
}
const gap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

test.each(LANES)('lane %i: no position or heading snap at rail insertion', (lane) => {
  const pass = landingPass();
  const before = flightPose(pass, geo, pass.liftMs - 0.01, lane);
  const after = flightPose(pass, geo, pass.liftMs, lane);
  expect(gap(before, after)).toBeLessThan(0.5);
  expect(angleGap(before.heading, after.heading)).toBeLessThan(0.01);
  expect(gap(flightPosition(pass, geo, pass.liftMs - 0.01, lane), flightPosition(pass, geo, pass.liftMs, lane))).toBeLessThan(0.5);
});

test('the shell starts upright and turns continuously (no per-frame jump) through the lift', () => {
  const pass = landingPass();
  expect(flightPose(pass, geo, 0).heading).toBeCloseTo(0, 9);
  let prev = flightPose(pass, geo, 0).heading;
  for (let t = 1000 / 60; t <= pass.liftMs + 50; t += 1000 / 60) {
    const h = flightPose(pass, geo, t).heading;
    expect(angleGap(prev, h)).toBeLessThan(0.35); // < 20° per 60 fps frame
    prev = h;
  }
});

test.each(LANES)('lane %i: the Holding landing leaves from where the rail left the Pal', (lane) => {
  const pass = landingPass();
  const railEnd = flightPose(pass, geo, pass.orbitEndAt, lane);
  const landingStart = flightPose(pass, geo, pass.orbitEndAt + 0.01, lane);
  expect(gap(railEnd, landingStart)).toBeLessThan(0.5);
  expect(flightPose(pass, geo, pass.landingAt, lane)).toMatchObject(pass.terminal.kind === 'toHolding' ? pass.terminal.target! : {});
});

test('a late first frame (anchor latency) skips only a small part of the launch approach', () => {
  const pass = landingPass();
  const start = flightPose(pass, geo, 0);
  const whole = gap(start, flightPose(pass, geo, LAUNCH_HUB.APPROACH));
  expect(gap(start, flightPose(pass, geo, 33)) / whole).toBeLessThan(0.06);
  expect(flightPose(pass, geo, LAUNCH_HUB.APPROACH)).toMatchObject(geo.launchHub);
});

const FRAME = 1000 / 60;
function velocity(pass: FlightPass, t: number, lane: number) {
  const a = flightPose(pass, geo, t - 0.5, lane);
  const b = flightPose(pass, geo, t + 0.5, lane);
  return { x: b.x - a.x, y: b.y - a.y };
}

test.each(LANES)('lane %i: the Pal leaves the gate at rail speed and direction, then arrives at rest', (lane) => {
  const pass = landingPass();
  const rail = velocity(pass, pass.orbitEndAt - 2, lane);
  const off = velocity(pass, pass.orbitEndAt + 2, lane);
  expect(Math.hypot(off.x - rail.x, off.y - rail.y)).toBeLessThan(0.05 * Math.hypot(rail.x, rail.y) + 0.01);
  const end = velocity(pass, pass.landingAt - 1, lane);
  expect(Math.hypot(end.x, end.y)).toBeLessThan(0.02);
});

test('the shell turns upright and the landing progress runs 0 → 1 without a per-frame jump', () => {
  const pass = landingPass();
  let prev = flightPose(pass, geo, pass.orbitEndAt);
  for (let t = pass.orbitEndAt + FRAME; t <= pass.landingAt + FRAME; t += FRAME) {
    const pose = flightPose(pass, geo, t);
    expect(angleGap(prev.heading, pose.heading)).toBeLessThan(0.35);
    expect(Math.abs((pose.landing ?? 0) - (prev.landing ?? 0))).toBeLessThan(0.1);
    prev = pose;
  }
  const arrived = flightPose(pass, geo, pass.landingAt);
  expect(angleGap(arrived.heading, 0)).toBeLessThan(1e-9);
  expect(arrived.landing).toBe(1);
});

test('a retarget mid-landing re-aims from the current position and velocity — no jump', () => {
  const base = landingPass();
  const at = base.orbitEndAt + 150;
  const oldTarget = { x: 110, y: 470 };
  const target = { x: 250, y: 470 };
  const pass: FlightPass = { ...base, terminal: { kind: 'toHolding', slot: 1, target, retargets: [{ at, target: oldTarget }] } };
  const before = flightPose(pass, geo, at - 0.01);
  const after = flightPose(pass, geo, at + 0.01);
  expect(gap(before, after)).toBeLessThan(0.1);
  // Before the retarget it is exactly the original path.
  const original: FlightPass = { ...base, terminal: { kind: 'toHolding', slot: 0, target: oldTarget } };
  expect(gap(flightPose(pass, geo, at - 40), flightPose(original, geo, at - 40))).toBeLessThan(1e-9);
  expect(flightPose(pass, geo, pass.landingAt)).toMatchObject(target);
});

test('a late retarget glides for at least the minimum leg instead of snapping', () => {
  const base = landingPass();
  const at = base.landingAt - 5;
  const pass: FlightPass = { ...base, terminal: { kind: 'toHolding', slot: 1, target: { x: 250, y: 470 }, retargets: [{ at, target: { x: 110, y: 470 } }] } };
  let prev = flightPose(pass, geo, at);
  let maxStep = 0;
  for (let t = at + FRAME; t <= at + 140; t += FRAME) {
    const pose = flightPose(pass, geo, t);
    maxStep = Math.max(maxStep, gap(prev, pose));
    prev = pose;
  }
  expect(maxStep).toBeLessThan(40); // 140 px over ≥ 100 ms, never a one-frame snap
  expect(flightPose(pass, geo, at + 100)).toMatchObject({ x: 250, y: 470 });
});

describe('rail-entry staging (origin still occupied)', () => {
  const WAIT = 300;
  function stagedPass(): { pass: FlightPass; base: FlightPass } {
    const base = landingPass();
    // The convoy scheduler's entry wait: a hold at progress 0 starting at liftMs.
    const pass: FlightPass = { ...base, convoyHolds: [{ progress: 0, startAt: base.liftMs, endAt: base.liftMs + WAIT }] };
    return { pass, base };
  }
  const origin = (lane: number) => flightPose(landingPass(), geo, landingPass().liftMs, lane);

  test.each(LANES)('lane %i: never drawn at the occupied origin while waiting; rides in at rail speed', (lane) => {
    const { pass } = stagedPass();
    const entryAt = pass.liftMs + WAIT;
    const railStep = (a: number, b: number) => gap(flightPose(pass, geo, a, lane), flightPose(pass, geo, b, lane));
    for (let t = pass.liftMs; t < entryAt - 60; t += 10) {
      expect(gap(flightPose(pass, geo, t, lane), origin(lane))).toBeGreaterThan(8);
    }
    // Constant rail speed through the whole ride-in and across the entry.
    const v = railStep(entryAt - 60, entryAt - 50);
    expect(Math.abs(railStep(pass.liftMs + 10, pass.liftMs + 20) - v)).toBeLessThan(0.05);
    expect(Math.abs(railStep(entryAt, entryAt + 10) - v)).toBeLessThan(0.05);
  });

  test.each(LANES)('lane %i: continuous at lift end and at entry; exact on the logical schedule after entry', (lane) => {
    const { pass } = stagedPass();
    const entryAt = pass.liftMs + WAIT;
    for (const b of [pass.liftMs, entryAt]) {
      expect(gap(flightPose(pass, geo, b - 0.01, lane), flightPose(pass, geo, b + 0.01, lane))).toBeLessThan(0.05);
      expect(gap(flightPosition(pass, geo, b - 0.01, lane), flightPosition(pass, geo, b + 0.01, lane))).toBeLessThan(0.05);
    }
    expect(gap(flightPose(pass, geo, entryAt, lane), origin(lane))).toBeLessThan(1e-6);
    // After entry: exactly the logical rail schedule; the terminal is untouched.
    for (let t = entryAt; t <= pass.orbitEndAt; t += 97) {
      expect(gap(flightPose(pass, geo, t, lane), railPoint(geo, progressAt(pass, t), lane))).toBeLessThan(1e-9);
    }
    expect(flightPose(pass, geo, pass.landingAt, lane)).toMatchObject(pass.terminal.kind === 'toHolding' ? pass.terminal.target! : {});
  });

  test('a Pal with no entry wait launches exactly as before', () => {
    const base = landingPass();
    const withLaterHold: FlightPass = { ...base, convoyHolds: [{ progress: 0.2, startAt: 2000, endAt: 2100 }] };
    for (let t = 0; t <= base.liftMs + 100; t += 20) {
      expect(gap(flightPose(withLaterHold, geo, t), flightPose(base, geo, t))).toBeLessThan(1e-9);
    }
  });
});
