import {
  ROUNDED_PERIMETER_BOTTOM_CENTER_PROGRESS,
  clampCornerRadius,
  createRoundedPerimeterGeometry,
  inwardNormalAtRoundedPerimeterProgress,
  normalizePerimeterProgress,
  pointAtRoundedPerimeterProgress,
  roundedPerimeterLength,
  type RoundedPerimeterBounds,
  type RoundedPerimeterGeometry,
  type RoundedPerimeterSegment,
} from '../roundedPerimeter';

const DIGITS = 10;

function bounds(
  width: number,
  height: number,
  radius: number,
  x = 0,
  y = 0,
): RoundedPerimeterBounds {
  return { x, y, width, height, radius };
}

function expectPoint(
  actual: { x: number; y: number },
  expected: { x: number; y: number },
  digits = DIGITS,
): void {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
}

function expectUnit(v: { x: number; y: number }): void {
  expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, DIGITS);
}

function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

type BoundaryKey =
  | 'topToTopRight'
  | 'topRightToRight'
  | 'rightToBottomRight'
  | 'bottomRightToBottom'
  | 'bottomToBottomLeft'
  | 'bottomLeftToLeft'
  | 'leftToTopLeft'
  | 'topLeftToTop';

/** Path distance from progress 0 (top-center) to each clockwise boundary. */
function boundaryProgress(g: RoundedPerimeterGeometry): Record<BoundaryKey, number> {
  const { width, height, radius } = g.bounds;
  const Lh = width - 2 * radius;
  const Lv = height - 2 * radius;
  const arc = (Math.PI * radius) / 2;
  const total = g.length;
  const at = (d: number) => (total > 0 ? d / total : 0);
  return {
    topToTopRight: at(Lh / 2),
    topRightToRight: at(Lh / 2 + arc),
    rightToBottomRight: at(Lh / 2 + arc + Lv),
    bottomRightToBottom: at(Lh / 2 + 2 * arc + Lv),
    bottomToBottomLeft: at(Lh / 2 + 2 * arc + Lv + Lh),
    bottomLeftToLeft: at(Lh / 2 + 3 * arc + Lv + Lh),
    leftToTopLeft: at(Lh / 2 + 3 * arc + 2 * Lv + Lh),
    topLeftToTop: at(Lh / 2 + 4 * arc + 2 * Lv + Lh),
  };
}

describe('normalizePerimeterProgress', () => {
  test('0 stays 0', () => {
    expect(normalizePerimeterProgress(0)).toBe(0);
  });

  test('1 wraps to 0', () => {
    expect(normalizePerimeterProgress(1)).toBe(0);
    expect(normalizePerimeterProgress(2)).toBe(0);
    expect(normalizePerimeterProgress(3)).toBe(0);
  });

  test('values > 1 wrap', () => {
    expect(normalizePerimeterProgress(1.25)).toBeCloseTo(0.25, DIGITS);
    expect(normalizePerimeterProgress(4.75)).toBeCloseTo(0.75, DIGITS);
  });

  test('negative values wrap near the end', () => {
    expect(normalizePerimeterProgress(-0.1)).toBeCloseTo(0.9, DIGITS);
    expect(normalizePerimeterProgress(-1)).toBe(0);
    expect(normalizePerimeterProgress(-1.25)).toBeCloseTo(0.75, DIGITS);
  });
});

describe('perimeter length', () => {
  test('radius 0 rectangle is 2(W+H)', () => {
    expect(roundedPerimeterLength(bounds(10, 6, 0))).toBe(32);
    expect(roundedPerimeterLength(bounds(4, 4, 0))).toBe(16);
  });

  test('square rounded rectangle matches 2(W-2R)+2(H-2R)+2πR', () => {
    const W = 10;
    const R = 2;
    const expected = 2 * (W - 2 * R) + 2 * (W - 2 * R) + 2 * Math.PI * R;
    expect(roundedPerimeterLength(bounds(W, W, R))).toBeCloseTo(expected, DIGITS);
  });

  test('non-square rectangle uses true arc length, not an angular shortcut', () => {
    const W = 20;
    const H = 8;
    const R = 2;
    const expected = 2 * (W - 2 * R) + 2 * (H - 2 * R) + 2 * Math.PI * R;
    expect(roundedPerimeterLength(bounds(W, H, R))).toBeCloseTo(expected, DIGITS);
  });

  test('maximum legal radius: circle and stadium', () => {
    expect(roundedPerimeterLength(bounds(10, 10, 5))).toBeCloseTo(10 * Math.PI, DIGITS);
    expect(roundedPerimeterLength(bounds(10, 20, 5))).toBeCloseTo(20 + 10 * Math.PI, DIGITS);
    expect(roundedPerimeterLength(bounds(20, 10, 5))).toBeCloseTo(20 + 10 * Math.PI, DIGITS);
  });
});

describe('known positions', () => {
  const square = createRoundedPerimeterGeometry(bounds(10, 10, 2, 1, 3));
  const wide = createRoundedPerimeterGeometry(bounds(20, 8, 2, 0, 0));
  const tall = createRoundedPerimeterGeometry(bounds(8, 20, 2, 0, 0));

  test('progress 0 and 1 are top-center', () => {
    for (const g of [square, wide, tall]) {
      const { x, y, width } = g.bounds;
      const topCenter = { x: x + width / 2, y };
      expectPoint(g.pointAt(0), topCenter);
      expectPoint(g.pointAt(1), topCenter);
    }
  });

  test('bottom-center is progress 0.5 on square and rectangular boards', () => {
    expect(square.bottomCenterProgress).toBe(ROUNDED_PERIMETER_BOTTOM_CENTER_PROGRESS);
    expect(wide.bottomCenterProgress).toBe(0.5);
    expect(tall.bottomCenterProgress).toBe(0.5);
    for (const g of [square, wide, tall]) {
      const { x, y, width, height } = g.bounds;
      expectPoint(g.pointAt(0.5), { x: x + width / 2, y: y + height });
    }
  });

  test('right-center and left-center on a square sit at quarter progress', () => {
    const { x, y, width, height } = square.bounds;
    expectPoint(square.pointAt(0.25), { x: x + width, y: y + height / 2 });
    expectPoint(square.pointAt(0.75), { x, y: y + height / 2 });
  });

  test('cardinal centers on a non-square are distance-based, still at 0/0.25/0.5/0.75', () => {
    const { x, y, width, height } = wide.bounds;
    expectPoint(wide.pointAt(0), { x: x + width / 2, y });
    expectPoint(wide.pointAt(0.25), { x: x + width, y: y + height / 2 });
    expectPoint(wide.pointAt(0.5), { x: x + width / 2, y: y + height });
    expectPoint(wide.pointAt(0.75), { x, y: y + height / 2 });
  });

  test('representative corner mid-arc points', () => {
    const g = createRoundedPerimeterGeometry(bounds(10, 10, 2, 0, 0));
    const b = boundaryProgress(g);
    const mid = (from: number, to: number) => (from + to) / 2;
    const r = 2;
    const cxTR = 8;
    const cyTR = 2;
    const midTopRight = g.pointAt(mid(b.topToTopRight, b.topRightToRight));
    expectPoint(midTopRight, {
      x: cxTR + r * Math.cos(-Math.PI / 4),
      y: cyTR + r * Math.sin(-Math.PI / 4),
    });
    const midBottomRight = g.pointAt(mid(b.rightToBottomRight, b.bottomRightToBottom));
    expectPoint(midBottomRight, {
      x: 8 + r * Math.cos(Math.PI / 4),
      y: 8 + r * Math.sin(Math.PI / 4),
    });
  });

  test('standalone helpers agree with the factory', () => {
    const spec = bounds(12, 7, 1.5, 3, 4);
    const g = createRoundedPerimeterGeometry(spec);
    expectPoint(pointAtRoundedPerimeterProgress(spec, 0.3), g.pointAt(0.3));
    expectPoint(inwardNormalAtRoundedPerimeterProgress(spec, 0.3), g.inwardNormalAt(0.3));
  });
});

describe('continuity at segment boundaries', () => {
  const shapes = [
    createRoundedPerimeterGeometry(bounds(10, 10, 2)),
    createRoundedPerimeterGeometry(bounds(20, 8, 2)),
    createRoundedPerimeterGeometry(bounds(8, 20, 2)),
    createRoundedPerimeterGeometry(bounds(10, 10, 0)),
    createRoundedPerimeterGeometry(bounds(10, 10, 5)),
  ];

  test.each([
    ['top → topRight', 'topToTopRight'],
    ['topRight → right', 'topRightToRight'],
    ['right → bottomRight', 'rightToBottomRight'],
    ['bottomRight → bottom', 'bottomRightToBottom'],
    ['bottom → bottomLeft', 'bottomToBottomLeft'],
    ['bottomLeft → left', 'bottomLeftToLeft'],
    ['left → topLeft', 'leftToTopLeft'],
    ['topLeft → top', 'topLeftToTop'],
  ] as const)('%s has no position jump', (_label, key) => {
    for (const g of shapes) {
      const p = boundaryProgress(g)[key];
      const before = g.pointAt(p - 1e-9);
      const at = g.pointAt(p);
      const after = g.pointAt(p + 1e-9);
      expect(distance(before, at)).toBeLessThan(1e-6);
      expect(distance(at, after)).toBeLessThan(1e-6);
    }
  });

  test('progress 0 and 1 are the same point (wrap)', () => {
    for (const g of shapes) {
      expectPoint(g.pointAt(0), g.pointAt(1));
      expectPoint(g.pointAt(-1e-9), g.pointAt(1e-9), 6);
    }
  });
});

describe('inward normals', () => {
  const g = createRoundedPerimeterGeometry(bounds(10, 8, 2, 0, 0));

  test('straight-edge normals are exact axis unit vectors', () => {
    expectPoint(g.inwardNormalAt(0), { x: 0, y: 1 });
    expectPoint(g.inwardNormalAt(0.25), { x: -1, y: 0 });
    expectPoint(g.inwardNormalAt(0.5), { x: 0, y: -1 });
    expectPoint(g.inwardNormalAt(0.75), { x: 1, y: 0 });
  });

  test('corner normals are unit length and point at the corner-circle centre', () => {
    const b = boundaryProgress(g);
    const samples: { from: number; to: number; cx: number; cy: number }[] = [
      { from: b.topToTopRight, to: b.topRightToRight, cx: 8, cy: 2 },
      { from: b.rightToBottomRight, to: b.bottomRightToBottom, cx: 8, cy: 6 },
      { from: b.bottomToBottomLeft, to: b.bottomLeftToLeft, cx: 2, cy: 6 },
      { from: b.leftToTopLeft, to: b.topLeftToTop, cx: 2, cy: 2 },
    ];
    for (const s of samples) {
      for (const t of [0.15, 0.5, 0.85]) {
        const p = s.from + t * (s.to - s.from);
        const point = g.pointAt(p);
        const n = g.inwardNormalAt(p);
        expectUnit(n);
        const toCenter = { x: s.cx - point.x, y: s.cy - point.y };
        const mag = Math.hypot(toCenter.x, toCenter.y);
        expectPoint(n, { x: toCenter.x / mag, y: toCenter.y / mag });
      }
    }
  });

  test('normals are continuous across rounded-corner junctions', () => {
    const b = boundaryProgress(g);
    const junctions: number[] = [
      b.topToTopRight,
      b.topRightToRight,
      b.rightToBottomRight,
      b.bottomRightToBottom,
      b.bottomToBottomLeft,
      b.bottomLeftToLeft,
      b.leftToTopLeft,
      b.topLeftToTop,
    ];
    for (const p of junctions) {
      const before = g.inwardNormalAt(p - 1e-8);
      const after = g.inwardNormalAt(p + 1e-8);
      expect(distance(before, after)).toBeLessThan(1e-5);
      expectUnit(before);
      expectUnit(after);
    }
  });

  test('clockwise tangent is perpendicular to the inward normal', () => {
    for (const p of [0, 0.12, 0.25, 0.4, 0.5, 0.66, 0.75, 0.91]) {
      const n = g.inwardNormalAt(p);
      const t = g.tangentAt(p);
      expectUnit(t);
      expect(n.x * t.x + n.y * t.y).toBeCloseTo(0, 8);
      // Y-down clockwise: tangent = rotate inward +90° → (n.y, -n.x)
      expectPoint(t, { x: n.y, y: -n.x }, 8);
    }
  });
});

describe('rectangular support', () => {
  test.each([
    ['square', bounds(12, 12, 3)],
    ['wider-than-tall', bounds(24, 10, 3)],
    ['taller-than-wide', bounds(10, 24, 3)],
  ] as const)('%s stays on the perimeter and travels clockwise', (_label, spec) => {
    const g = createRoundedPerimeterGeometry(spec);
    const { x, y, width, height, radius } = g.bounds;
    const innerLeft = x + radius;
    const innerRight = x + width - radius;
    const innerTop = y + radius;
    const innerBottom = y + height - radius;

    let previous = g.pointAt(0);
    const steps = 80;
    for (let i = 1; i <= steps; i += 1) {
      const p = i / steps;
      const point = g.pointAt(p);
      const onTop = Math.abs(point.y - y) < 1e-8 && point.x >= innerLeft - 1e-8 && point.x <= innerRight + 1e-8;
      const onBottom = Math.abs(point.y - (y + height)) < 1e-8
        && point.x >= innerLeft - 1e-8 && point.x <= innerRight + 1e-8;
      const onLeft = Math.abs(point.x - x) < 1e-8 && point.y >= innerTop - 1e-8 && point.y <= innerBottom + 1e-8;
      const onRight = Math.abs(point.x - (x + width)) < 1e-8
        && point.y >= innerTop - 1e-8 && point.y <= innerBottom + 1e-8;
      const inTopRight = distance(point, { x: innerRight, y: innerTop }) <= radius + 1e-8
        && point.x >= innerRight - 1e-8 && point.y <= innerTop + 1e-8;
      const inBottomRight = distance(point, { x: innerRight, y: innerBottom }) <= radius + 1e-8
        && point.x >= innerRight - 1e-8 && point.y >= innerBottom - 1e-8;
      const inBottomLeft = distance(point, { x: innerLeft, y: innerBottom }) <= radius + 1e-8
        && point.x <= innerLeft + 1e-8 && point.y >= innerBottom - 1e-8;
      const inTopLeft = distance(point, { x: innerLeft, y: innerTop }) <= radius + 1e-8
        && point.x <= innerLeft + 1e-8 && point.y <= innerTop + 1e-8;
      expect(
        onTop || onBottom || onLeft || onRight
        || inTopRight || inBottomRight || inBottomLeft || inTopLeft,
      ).toBe(true);

      // Chord length ≈ path length at this sample rate; a speed jump at a
      // corner would show up as a step far from length/steps.
      if (i < steps) {
        expect(distance(previous, point)).toBeCloseTo(g.length / steps, 2);
      }
      previous = point;
    }
  });

  test('segment identity covers all eight named portions', () => {
    const g = createRoundedPerimeterGeometry(bounds(16, 10, 2));
    const b = boundaryProgress(g);
    const mid = (a: number, c: number) => (a + c) / 2;
    const expected: [number, RoundedPerimeterSegment][] = [
      [mid(0, b.topToTopRight), 'top'],
      [mid(b.topToTopRight, b.topRightToRight), 'topRight'],
      [mid(b.topRightToRight, b.rightToBottomRight), 'right'],
      [mid(b.rightToBottomRight, b.bottomRightToBottom), 'bottomRight'],
      [mid(b.bottomRightToBottom, b.bottomToBottomLeft), 'bottom'],
      [mid(b.bottomToBottomLeft, b.bottomLeftToLeft), 'bottomLeft'],
      [mid(b.bottomLeftToLeft, b.leftToTopLeft), 'left'],
      [mid(b.leftToTopLeft, b.topLeftToTop), 'topLeft'],
      [mid(b.topLeftToTop, 1), 'top'],
    ];
    for (const [p, id] of expected) {
      expect(g.segmentAt(p)).toBe(id);
    }
  });
});

describe('radius edge cases', () => {
  test('radius 0 is a sharp rectangle; corners are vertices', () => {
    const g = createRoundedPerimeterGeometry(bounds(8, 6, 0, 1, 2));
    expect(g.bounds.radius).toBe(0);
    expect(g.length).toBe(28);
    expectPoint(g.pointAt(0), { x: 5, y: 2 });
    expectPoint(g.pointAt(0.5), { x: 5, y: 8 });
    const b = boundaryProgress(g);
    expectPoint(g.pointAt(b.topToTopRight), { x: 9, y: 2 });
    expectPoint(g.pointAt(b.rightToBottomRight), { x: 9, y: 8 });
    expectPoint(g.inwardNormalAt(0.25), { x: -1, y: 0 });
  });

  test('radius exactly min(width,height)/2 is accepted as a stadium or circle', () => {
    const circle = createRoundedPerimeterGeometry(bounds(10, 10, 5));
    expect(circle.bounds.radius).toBe(5);
    expect(circle.length).toBeCloseTo(10 * Math.PI, DIGITS);
    expectPoint(circle.pointAt(0), { x: 5, y: 0 });
    expectPoint(circle.pointAt(0.5), { x: 5, y: 10 });
    expectUnit(circle.inwardNormalAt(0.125));

    const stadium = createRoundedPerimeterGeometry(bounds(10, 18, 5));
    expect(stadium.bounds.radius).toBe(5);
    expect(stadium.length).toBeCloseTo(16 + 10 * Math.PI, DIGITS);
    expectPoint(stadium.pointAt(0), { x: 5, y: 0 });
    expectPoint(stadium.pointAt(0.5), { x: 5, y: 18 });
  });

  test('oversized and invalid radii clamp; negative radius becomes 0', () => {
    expect(clampCornerRadius(10, 8, 100)).toBe(4);
    expect(clampCornerRadius(10, 8, -2)).toBe(0);
    expect(clampCornerRadius(10, 8, Number.NaN)).toBe(0);
    expect(clampCornerRadius(0, 8, 2)).toBe(0);
    const clamped = createRoundedPerimeterGeometry(bounds(10, 8, 99));
    expect(clamped.bounds.radius).toBe(4);
    expect(clamped.length).toBeCloseTo(roundedPerimeterLength(bounds(10, 8, 4)), DIGITS);
    const sharp = createRoundedPerimeterGeometry(bounds(10, 8, -3));
    expect(sharp.bounds.radius).toBe(0);
    expect(sharp.length).toBe(36);
  });

  test('does not mutate the caller bounds object', () => {
    const spec = bounds(10, 8, 99);
    createRoundedPerimeterGeometry(spec);
    expect(spec.radius).toBe(99);
  });
});

describe('path-distance parameterization', () => {
  test('equal progress steps cover equal path length, including across corners', () => {
    const g = createRoundedPerimeterGeometry(bounds(14, 9, 2.5));
    const n = 200;
    const step = g.length / n;
    const lengths: number[] = [];
    for (let i = 0; i < n; i += 1) {
      lengths.push(distance(g.pointAt(i / n), g.pointAt((i + 1) / n)));
    }
    const max = Math.max(...lengths);
    const min = Math.min(...lengths);
    expect(max).toBeCloseTo(step, 2);
    expect(min).toBeCloseTo(step, 2);
    expect(max - min).toBeLessThan(step * 0.02);
  });
});
