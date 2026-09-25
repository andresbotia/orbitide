/**
 * M8E large-board readiness fixture. Synthetic boards only — not campaign
 * content. Proves that 30×30 … 40×40 (and the 48 hard maximum) validate,
 * pack into the same physical Core V2 board, produce render data, and keep
 * cell targeting exact.
 */
import { createGame } from '@/game/engine/createGame';
import { listAttackBins } from '@/game/engine/directionalTargeting';
import { isPixelReachable, renderExteriorMask } from '@/game/engine/pixels';
import { resolveAction } from '@/game/engine/resolveLaunch';
import type { LevelDefinition, OrbColor } from '@/game/engine/types';
import { MAX_BOARD_DIMENSION } from '@/game/engine/boardLimits';
import { validateLevelStructure } from '@/game/levels/authoring/validate';
import { cellCenter, computeBoardGeometry, fitRoundedRectCanvas } from '../boardGeometry';
import { buildPixelBuckets } from '../pixelField';

const LARGE = [30, 32, 34, 36, 38, 40] as const;
/** Board boxes measured as GameScreen does: screen width − 2×14pt side pad. */
const BOXES = [
  { name: '375pt phone', width: 347, height: 430 },
  { name: '393pt phone', width: 365, height: 450 },
  { name: '430pt phone', width: 402, height: 500 },
] as const;
const RATIOS = [2, 3] as const;

const COLORS: OrbColor[] = ['cyan', 'magenta', 'gold', 'blue'];
const CHARS = ['C', 'M', 'Y', 'B'];

/** A dense, fully painted board: four colour quadrants with a hollow core. */
function makeLargeLevel(cols: number, rows: number): LevelDefinition {
  const pixelArt: string[] = [];
  const counts = [0, 0, 0, 0];
  for (let y = 0; y < rows; y++) {
    let row = '';
    for (let x = 0; x < cols; x++) {
      const core = Math.abs(x - cols / 2) < cols / 8 && Math.abs(y - rows / 2) < rows / 8;
      if (core) { row += '.'; continue; }
      const q = (x < cols / 2 ? 0 : 1) + (y < rows / 2 ? 0 : 2);
      counts[q]! += 1;
      row += CHARS[q];
    }
    pixelArt.push(row);
  }
  const legend = Object.fromEntries(CHARS.map((c, i) => [c, COLORS[i]!])) as Record<string, OrbColor>;
  return {
    id: 9900 + cols,
    title: `Large ${cols}x${rows}`,
    themeId: 'first-light',
    difficulty: 'hard',
    holdingCapacity: 3,
    ruleset: 'coreV2',
    legend,
    pixelArt,
    tunnels: [
      [{ color: COLORS[0]!, capacity: counts[0]! }, { color: COLORS[3]!, capacity: counts[3]! }],
      [{ color: COLORS[1]!, capacity: counts[1]! }],
      [{ color: COLORS[2]!, capacity: counts[2]! }],
    ],
  };
}

describe('large boards — validation', () => {
  test.each([...LARGE, MAX_BOARD_DIMENSION])('%i-wide square board validates and builds a game state', (n) => {
    const def = makeLargeLevel(n, n);
    const result = validateLevelStructure(def);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.width).toBe(n);
    expect(result.height).toBe(n);
    const state = createGame(def);
    expect(state.width).toBe(n);
    expect(state.pixels.length).toBeGreaterThan(n * n * 0.9);
  });

  test('one past the maximum is rejected', () => {
    const def = makeLargeLevel(MAX_BOARD_DIMENSION + 1, MAX_BOARD_DIMENSION);
    const result = validateLevelStructure(def);
    expect(result.diagnostics.some((d) => d.code === 'GRID_WIDTH_OOB')).toBe(true);
  });
});

describe('large boards — Core V2 geometry', () => {
  const geoFor = (box: { width: number; height: number }, n: number, pixelRatio: number) =>
    computeBoardGeometry(Math.max(box.width, box.height), n, n, { roundedRect: true, box, pixelRatio });

  test('the physical board, rail and Pal stay the same size; only the cells shrink', () => {
    for (const box of BOXES) {
      for (const pr of RATIOS) {
        const ref = geoFor(box, 28, pr);
        for (const n of LARGE) {
          const geo = geoFor(box, n, pr);
          // Same Pal, same rail inset → same rail thickness and Gate clearance.
          expect(geo.chargeRadius).toBe(ref.chargeRadius);
          expect(geo.perimeter!.x).toBe(ref.perimeter!.x);
          // Artwork keeps ≥ 94% of the 28×28 board's physical width (worst
          // case is a 2× screen, whose snap step is 0.5pt).
          expect(geo.gridWidth).toBeGreaterThanOrEqual(ref.gridWidth * 0.94);
          expect(geo.cell).toBeLessThan(ref.cell + 1e-9);
          // Gate stays bottom-centre of the rail.
          expect(geo.gateTerminal.x).toBeCloseTo(geo.width / 2, 6);
          expect(geo.gateTerminal.y).toBeCloseTo(geo.perimeter!.y + geo.perimeter!.height, 6);
        }
      }
    }
  });

  test('cells are crisp (whole device pixels) and readable down to 40×40 on the narrowest phone', () => {
    for (const box of BOXES) {
      for (const pr of RATIOS) {
        for (const n of [...LARGE, MAX_BOARD_DIMENSION]) {
          const geo = geoFor(box, n, pr);
          expect(Math.abs(geo.cell * pr - Math.round(geo.cell * pr))).toBeLessThan(1e-6);
          expect(Number.isInteger(geo.gridOrigin.x)).toBe(true);
          expect(Number.isInteger(geo.gridOrigin.y)).toBe(true);
          expect(geo.cell).toBeGreaterThanOrEqual(n <= 40 ? 6.5 : 5.25);
          // The adaptive gutter still separates neighbours by ≥ 1 device pixel.
          expect(geo.adaptive.gutter * pr).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  test('artwork sits inside the rail interior with clearance', () => {
    for (const box of BOXES) {
      for (const n of LARGE) {
        const geo = geoFor(box, n, 3);
        const p = geo.perimeter!;
        expect(geo.artwork.x).toBeGreaterThan(p.x);
        expect(geo.artwork.y).toBeGreaterThan(p.y);
        expect(geo.artwork.x + geo.artwork.width).toBeLessThan(p.x + p.width);
        expect(geo.artwork.y + geo.artwork.height).toBeLessThan(p.y + p.height);
        expect(geo.width).toBeLessThanOrEqual(box.width + 1e-9);
        expect(geo.height).toBeLessThanOrEqual(box.height + 1e-9);
      }
    }
  });

  test('re-packing the fitted canvas reproduces the same cell (no float drift)', () => {
    for (const box of BOXES) {
      for (const pr of RATIOS) {
        for (const n of LARGE) {
          const geo = geoFor(box, n, pr);
          const fitted = fitRoundedRectCanvas(geo.width, geo.height, n, n, pr);
          const again = geoFor(fitted, n, pr);
          expect(again.cell).toBe(geo.cell);
        }
      }
    }
  });

  test('cell centres and tap → cell inversion stay exact (Bomb targeting math)', () => {
    for (const n of [32, 36, 40]) {
      const geo = geoFor(BOXES[0], n, 3);
      for (let x = 0; x < n; x++) {
        for (let y = 0; y < n; y++) {
          const c = cellCenter(geo, x, y);
          expect(Math.floor((c.x - geo.gridOrigin.x) / geo.cell)).toBe(x);
          expect(Math.floor((c.y - geo.gridOrigin.y) / geo.cell)).toBe(y);
        }
      }
    }
  });

  test('pixelRatio 1 keeps the old whole-point cells', () => {
    const box = BOXES[1];
    const geo = geoFor(box, 32, 1);
    expect(Number.isInteger(geo.cell)).toBe(true);
  });
});

describe('large boards — render data and targeting', () => {
  test.each([32, 36, 40])('%i-wide square board builds bounded paint buckets for every drawn pixel', (n) => {
    const state = createGame(makeLargeLevel(n, n));
    const mask = renderExteriorMask(state);
    const buckets = buildPixelBuckets(state.pixels, new Set(), new Map(), (p) => isPixelReachable(mask, p));
    const drawn = [...buckets.values()].reduce((sum, b) => sum + b.members.length, 0);
    expect(drawn).toBe(state.pixels.length);
    // Work is bounded by paint variants, not by cell count.
    expect(buckets.size).toBeLessThanOrEqual(COLORS.length * 2);
  });

  test.each([32, 36, 40, MAX_BOARD_DIMENSION])('%i-wide square board: one lap fires first-visible shots, at most one per attack line', (n) => {
    const state = createGame(makeLargeLevel(n, n));
    const bins = listAttackBins(n, n);
    expect(bins.length).toBeGreaterThanOrEqual(4 * n);
    const outcome = resolveAction(state, { kind: 'tunnel', id: state.tunnels[0]!.id });
    expect(outcome.accepted).toBe(true);
    const hits = outcome.pass!.encounters;
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThanOrEqual(bins.length);
    const byId = new Map(state.pixels.map((p) => [p.id, p]));
    for (const e of hits) {
      const p = byId.get(e.pixelId)!;
      expect(p.color).toBe(COLORS[0]);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(n);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(n);
    }
    expect(new Set(hits.map((e) => e.pixelId)).size).toBe(hits.length);
  });
});
