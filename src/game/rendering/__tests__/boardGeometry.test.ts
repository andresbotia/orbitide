import {
  computeBoardGeometry,
  fitRoundedRectCanvas,
  pixelAdaptive,
  SUPPORTED_DENSITIES,
  MAX_READY_DENSITY,
} from '../boardGeometry';
import { flightBankDegrees, flightHeading, flightPosition, liftPhase } from '../flightGeometry';
import { LAUNCH_HUB, CORE_V2_ORBIT_DURATION_MS, FEEL } from '../../presentation/constants';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import { createGame } from '../../engine/createGame';
import { resolveLaunch } from '../../engine/resolveLaunch';
import { buildLaunchScript } from '../../presentation/buildScript';
import type { LevelDefinition } from '../../engine/types';

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
  const series = [7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 28].map(pixelAdaptive);
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

// M5.3 — Core V2 rounded-rectangle perimeter geometry -----------------------

const coreV2Level = (extra: Partial<LevelDefinition> = {}): LevelDefinition => ({
  id: 9000,
  title: 'M5.3 fixture',
  themeId: 'test',
  difficulty: 'easy',
  holdingCapacity: 4,
  pixelArt: ['WWWWW', 'WWWWW', 'WWWWW', 'WWWWW', 'WWWWW'],
  tunnels: [[{ color: 'white', capacity: 25 }], [{ color: 'blue', capacity: 1 }], [], []],
  ruleset: 'coreV2',
  ...extra,
});

test('roundedRect geometry traces a real perimeter and collapses the launch hub onto its bottom-center entry', () => {
  for (const size of SIZES) {
    const geo = computeBoardGeometry(size, 7, 7, { roundedRect: true });
    expect(geo.perimeter).toBeDefined();
    const p = geo.perimeter!;
    expect(p.width).toBeGreaterThan(0);
    expect(p.height).toBeGreaterThan(0);
    // Spec §7 — no center-hub detour: the hub IS the shared perimeter entry.
    expect(geo.launchHub).toEqual(geo.orbitInsertion);
    expect(geo.launchHub).not.toEqual(geo.center);
    // The entry sits at the bottom-center of the rounded rect, inside the board.
    expect(geo.orbitInsertion.x).toBeCloseTo(p.x + p.width / 2);
    expect(geo.orbitInsertion.y).toBeCloseTo(p.y + p.height);
  }
});

test('omitting roundedRect (or passing false) reproduces the exact circular geometry', () => {
  const size = 358;
  const legacyA = computeBoardGeometry(size, 7, 7);
  const legacyB = computeBoardGeometry(size, 7, 7, { roundedRect: false });
  expect(legacyA).toEqual(legacyB);
  expect(legacyA.perimeter).toBeUndefined();
});

test('a coreV2 pass travels the rounded perimeter and reaches the four cardinal edges/corners', () => {
  const state = createGame(coreV2Level());
  const geo = computeBoardGeometry(358, state.width, state.height, { roundedRect: true });
  const pass = buildLaunchScript(resolveLaunch(state, 'tunnel-1'), state).pass; // a miss: one full pass
  const p = geo.perimeter!;

  // At liftMs (progress 0) the charge is exactly at the shared bottom-center entry.
  expect(flightPosition(pass, geo, pass.liftMs)).toEqual(geo.orbitInsertion);

  // Somewhere over the full pass it must visit all four sides (bounding box
  // reaches every edge of the perimeter bounds).
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let t = pass.liftMs; t <= pass.orbitEndAt; t += 25) {
    const pt = flightPosition(pass, geo, t);
    minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
    minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y);
  }
  expect(minX).toBeCloseTo(p.x, 0);
  expect(maxX).toBeCloseTo(p.x + p.width, 0);
  expect(minY).toBeCloseTo(p.y, 0);
  expect(maxY).toBeCloseTo(p.y + p.height, 0);
});

test('Core V2 gets the slower perimeter pass; Legacy V1 keeps its existing 1800ms pacing', () => {
  const v2State = createGame(coreV2Level());
  const v2Pass = buildLaunchScript(resolveLaunch(v2State, 'tunnel-1'), v2State).pass;
  expect(v2Pass.orbitDurationMs).toBe(CORE_V2_ORBIT_DURATION_MS);
  expect(v2Pass.orbitEndAt - v2Pass.liftMs).toBe(CORE_V2_ORBIT_DURATION_MS);

  const legacyLevel: LevelDefinition = {
    id: 9001, title: 'legacy', themeId: 'test', difficulty: 'easy', holdingCapacity: 3,
    pixelArt: ['WWW', 'WWW', 'WWW'], tunnels: [[{ color: 'blue', capacity: 1 }], [], []],
  };
  const legacyState = createGame(legacyLevel);
  const legacyPass = buildLaunchScript(resolveLaunch(legacyState, 'tunnel-0'), legacyState).pass;
  expect(legacyPass.orbitDurationMs).toBe(FEEL.ORBIT_DURATION);
});

test('flightHeading/flightBankDegrees are inert (0) on circular Legacy V1 geometry', () => {
  const state = createGame(LEVEL_DEFINITIONS[4]!);
  const geo = computeBoardGeometry(358, state.width, state.height);
  const pass = buildLaunchScript(resolveLaunch(state, 'tunnel-0'), state).pass;
  for (let t = 0; t <= pass.totalMs; t += 50) {
    expect(flightHeading(pass, geo, t)).toBe(0);
    expect(flightBankDegrees(pass, geo, t)).toBe(0);
  }
});

test('Core V2 roundedRect packs the grid into the rail interior instead of 56% letterboxing', () => {
  const size = 358;
  for (const [cols, rows] of [[7, 7], [15, 15], [21, 21]] as const) {
    const geo = computeBoardGeometry(size, cols, rows, { roundedRect: true });
    const p = geo.perimeter!;
    expect(geo.gridWidth / p.width).toBeGreaterThan(0.8);
    expect(geo.gridHeight / p.height).toBeGreaterThan(0.8);
    expect(geo.artwork.x).toBeGreaterThan(p.x);
    expect(geo.artwork.y).toBeGreaterThan(p.y);
    expect(geo.artwork.x + geo.artwork.width).toBeLessThan(p.x + p.width);
    expect(geo.artwork.y + geo.artwork.height).toBeLessThan(p.y + p.height);
  }
});

test('Core V2 roundedRect does not pan and does not change circular Legacy V1 geometry', () => {
  const size = 358;
  const legacy = computeBoardGeometry(size, 15, 15);
  expect(legacy.gridWidth / size).toBeLessThanOrEqual(0.58);
  expect(legacy.perimeter).toBeUndefined();
  const packed = computeBoardGeometry(size, 28, 28, { roundedRect: true });
  expect(packed.cell).toBeGreaterThanOrEqual(3);
  expect(packed.cell).toBeLessThan(14);
});

test('circular geometry reports width and height equal to size', () => {
  const geo = computeBoardGeometry(358, 7, 7);
  expect(geo.width).toBe(358);
  expect(geo.height).toBe(358);
  expect(geo.size).toBe(358);
});

test('Core V2 orbiting Pal stays in the 32–38pt readable band on phone-sized boards', () => {
  for (const size of [320, 358, 390, 430] as const) {
    const geo = computeBoardGeometry(size, 7, 7, { roundedRect: true });
    const visual = geo.chargeRadius * 2.1;
    expect(visual).toBeGreaterThanOrEqual(32 - 1e-6);
    expect(visual).toBeLessThanOrEqual(38 + 1e-6);
  }
});

test('Core V2 canvas shrinks to the puzzle aspect instead of letterboxing a square', () => {
  const tall = fitRoundedRectCanvas(374, 500, 9, 11);
  expect(tall.height).toBeGreaterThan(tall.width);

  const wide = fitRoundedRectCanvas(374, 500, 15, 7);
  expect(wide.width).toBeGreaterThan(wide.height);

  const square = fitRoundedRectCanvas(374, 500, 7, 7);
  expect(Math.abs(square.width - square.height)).toBeLessThanOrEqual(2);
});

test('Core V2 artwork fills 85–92% of the rail interior on a reference phone', () => {
  const size = 390;
  for (const [cols, rows] of [[7, 7], [9, 11], [15, 15], [21, 21]] as const) {
    const geo = computeBoardGeometry(size, cols, rows, { roundedRect: true, box: { width: size, height: 520 } });
    const p = geo.perimeter!;
    const fillW = geo.gridWidth / p.width;
    const fillH = geo.gridHeight / p.height;
    expect(fillW).toBeGreaterThanOrEqual(0.85);
    expect(fillW).toBeLessThanOrEqual(0.92);
    expect(fillH).toBeGreaterThanOrEqual(0.85);
    expect(fillH).toBeLessThanOrEqual(0.92);
  }
});

test('flightBankDegrees stays within its documented cap on a coreV2 rounded-rect pass', () => {
  const state = createGame(coreV2Level());
  const geo = computeBoardGeometry(358, state.width, state.height, { roundedRect: true });
  const pass = buildLaunchScript(resolveLaunch(state, 'tunnel-1'), state).pass;
  for (let t = pass.liftMs; t <= pass.orbitEndAt; t += 25) {
    const bank = flightBankDegrees(pass, geo, t);
    expect(Number.isFinite(bank)).toBe(true);
    expect(Math.abs(bank)).toBeLessThanOrEqual(9 + 1e-9);
    expect(Number.isFinite(flightHeading(pass, geo, t))).toBe(true);
  }
});
