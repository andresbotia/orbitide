import { computeBoardLayout, cellCenter } from '../layout';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import { createGame } from '../../engine/createGame';

test.each([180, 240, 288, 320, 358, 398, 430])('circular orbit fits a %ipx phone board', (size) => {
  for (const level of LEVEL_DEFINITIONS) {
    const state = createGame(level);
    const layout = computeBoardLayout(size, state.width, state.height);
    const outer = layout.orbit[0]!;
    expect(outer.rx).toBe(outer.ry);
    expect(outer.rx + layout.chargeRadius).toBeLessThan(size / 2);
    for (const anchor of layout.tunnelAnchors) {
      expect(anchor.x - layout.chargeRadius).toBeGreaterThanOrEqual(0);
      expect(anchor.y + layout.chargeRadius).toBeLessThanOrEqual(size);
    }
    for (const pixel of state.pixels) {
      const point = cellCenter(layout, pixel.x, pixel.y);
      expect(Math.hypot(point.x - layout.center.x, point.y - layout.center.y) +
        layout.cell / Math.sqrt(2)).toBeLessThan(outer.rx - layout.chargeRadius);
    }
  }
});
