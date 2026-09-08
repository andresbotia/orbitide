import { computeBoardLayout, cellCenter } from '../layout';
import { flightPosition } from '../flightGeometry';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import { createGame } from '../../engine/createGame';
import { resolveLaunch } from '../../engine/resolveLaunch';
import { buildLaunchScript } from '../../presentation/buildScript';

test.each([180, 240, 288, 320, 358, 398, 430])('circle, insertion and artwork fit a %ipx board', (size) => {
  for (const level of LEVEL_DEFINITIONS) {
    const state = createGame(level);
    const layout = computeBoardLayout(size, state.width, state.height);
    const outer = layout.orbit[0]!;
    expect(outer.rx).toBe(outer.ry);
    expect(outer.rx + layout.chargeRadius).toBeLessThan(size / 2);
    expect(layout.insertion.x).toBeCloseTo(size / 2);
    expect(layout.insertion.y).toBeCloseTo(size / 2 + outer.ry);
    for (const pixel of state.pixels) {
      const point = cellCenter(layout, pixel.x, pixel.y);
      expect(Math.hypot(point.x - layout.center.x, point.y - layout.center.y) + layout.cell / Math.sqrt(2))
        .toBeLessThan(outer.rx - layout.chargeRadius);
    }
  }
});
test('measured source starts at the button, converges on insertion, then moves left', () => {
  const state = createGame(LEVEL_DEFINITIONS[3]!);
  const layout = computeBoardLayout(358, state.width, state.height);
  const from = { x: 44, y: 400 };
  const pass = buildLaunchScript(resolveLaunch(state, 'tunnel-0'), state, 1, from).pass;
  expect(flightPosition(pass, layout, 0)).toEqual(from);
  expect(flightPosition(pass, layout, pass.liftMs)).toEqual(layout.insertion);
  expect(flightPosition(pass, layout, pass.liftMs + 100).x).toBeLessThan(layout.insertion.x);
});
