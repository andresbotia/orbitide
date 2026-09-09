import {
  computeBoardGeometry,
  pixelAdaptive,
  SUPPORTED_DENSITIES,
  MAX_READY_DENSITY,
} from '../boardGeometry';
import { flightPosition, liftPhase } from '../flightGeometry';
import { LAUNCH_HUB } from '../../presentation/constants';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import { createGame } from '../../engine/createGame';
import { resolveLaunch } from '../../engine/resolveLaunch';
import { buildLaunchScript } from '../../presentation/buildScript';

const SIZES = [180, 240, 288, 320, 358, 398, 430];

test('LAUNCH_HUB and ORBIT_INSERTION are distinct: hub at centre, insertion at bottom of the ring', () => {
  for (const size of SIZES) {
    const geo = computeBoardGeometry(size, 7, 7);
    expect(geo.launchHub).toEqual(geo.center);
    expect(geo.orbitInsertion.x).toBeCloseTo(geo.center.x);
    expect(geo.orbitInsertion.y).toBeCloseTo(geo.center.y + geo.orbitRadius);
    expect(geo.orbitInsertion).toEqual(geo.insertion);
    expect(Math.hypot(geo.launchHub.x - geo.orbitInsertion.x, geo.launchHub.y - geo.orbitInsertion.y))
      .toBeGreaterThan(geo.chargeRadius);
  }
});

test('artwork footprint stays ~constant while cell size shrinks with density', () => {
  const size = 358;
  const footprints = [...SUPPORTED_DENSITIES, MAX_READY_DENSITY].map((d) => {
    const geo = computeBoardGeometry(size, d, d);
    expect(geo.cell).toBeGreaterThanOrEqual(6);
    return geo.gridWidth / size;
  });
  const min = Math.min(...footprints);
  const max = Math.max(...footprints);
  // Within one cell's worth of rounding slack of the ~0.56 target.
  expect(max).toBeLessThanOrEqual(0.58);
  expect(min).toBeGreaterThan(0.42);
  expect(max - min).toBeLessThan(0.16);
});

test('adaptive depth cues only ever decrease as the board gets denser', () => {
  const keys = ['bevel', 'cornerRadius', 'gutter', 'glow', 'highlight', 'shadow', 'popOvershoot'] as const;
  const series = [7, 9, 11, 13, 15, 17].map(pixelAdaptive);
  for (const key of keys) {
    for (let i = 1; i < series.length; i++) {
      expect(series[i]![key]).toBeLessThanOrEqual(series[i - 1]![key] + 1e-9);
    }
  }
});

test('every campaign level fits its rail with token + label clearance, down to a small phone', () => {
  for (const size of [180, 200, 240, 320, 430]) {
    for (const level of LEVEL_DEFINITIONS) {
      const state = createGame(level);
      const geo = computeBoardGeometry(size, state.width, state.height);
      expect(geo.orbitRadius + geo.chargeRadius).toBeLessThan(size / 2);
      for (const pixel of state.pixels) {
        const cx = geo.gridOrigin.x + pixel.x * geo.cell + geo.cell / 2;
        const cy = geo.gridOrigin.y + pixel.y * geo.cell + geo.cell / 2;
        const reach = Math.hypot(cx - geo.center.x, cy - geo.center.y) + geo.cell / Math.SQRT2;
        expect(reach).toBeLessThan(geo.orbitRadius - geo.chargeRadius);
      }
    }
  }
});

test('the launch lift routes source -> hub -> insertion and hands off to the orbit at liftMs', () => {
  const state = createGame(LEVEL_DEFINITIONS[4]!);
  const geo = computeBoardGeometry(358, state.width, state.height);
  const from = { x: 30, y: 500 };
  const pass = buildLaunchScript(resolveLaunch(state, 'tunnel-0'), state, 1, from).pass;

  expect(flightPosition(pass, geo, 0)).toEqual(from);

  const atHub = flightPosition(pass, geo, LAUNCH_HUB.APPROACH);
  expect(atHub.x).toBeCloseTo(geo.launchHub.x);
  expect(atHub.y).toBeCloseTo(geo.launchHub.y);

  // Held (seated) through the whole SEAT window.
  const midSeat = flightPosition(pass, geo, LAUNCH_HUB.APPROACH + LAUNCH_HUB.SEAT / 2);
  expect(midSeat).toEqual(geo.launchHub);

  expect(flightPosition(pass, geo, pass.liftMs)).toEqual(geo.insertion);

  // liftPhase is a monotone 0 -> 3 ramp across the lift.
  let prev = -1;
  for (let t = 0; t <= pass.liftMs; t += 20) {
    const phase = liftPhase(pass, t);
    expect(phase).toBeGreaterThanOrEqual(prev - 1e-9);
    prev = phase;
  }
  expect(liftPhase(pass, pass.liftMs)).toBe(3);
});
