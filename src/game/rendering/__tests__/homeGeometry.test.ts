import {
  ambientChargeSpecs,
  computeHomeLayout,
  homeLevelPreview,
  previewGrid,
} from '../homeGeometry';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import { requireLevel } from '../../levels/levels';
import { DEFAULT_ART_LEGEND, parsePixelArt } from '../../engine/art';

const REF = { width: 358, height: 780 };

test('centerpiece is the dominant object: bounded, fits the column, sits in the band', () => {
  for (const height of [560, 620, 720, 780, 900]) {
    const layout = computeHomeLayout({ width: 358, height });
    expect(layout.machineRadius * 2).toBeGreaterThanOrEqual(190 - 1e-6);
    expect(layout.machineRadius * 2).toBeLessThanOrEqual(360 + 1e-6);
    expect(layout.machineRadius * 2).toBeLessThanOrEqual(358 * 0.94 + 1e-6);
    expect(layout.center.y).toBeGreaterThan(0);
    expect(layout.center.y).toBeLessThan(height);
    // Preview box sits inside the orbit rail.
    expect(layout.preview.size).toBeLessThan(layout.orbitRadius * 2);
    expect(layout.orbitRadius).toBeLessThan(layout.machineRadius);
  }
});

test('responsive: decorative layers shed as height shrinks, never the centerpiece', () => {
  const big = computeHomeLayout({ ...REF, height: 900 });
  const small = computeHomeLayout({ ...REF, height: 600 });
  expect(small.starCountFar).toBeLessThan(big.starCountFar);
  expect(small.ambientChargeCount).toBeLessThanOrEqual(big.ambientChargeCount);
  expect(big.showForeground).toBe(true);
  expect(small.showForeground).toBe(false);
  // Centerpiece stays a real size even on the small phone.
  expect(small.machineRadius * 2).toBeGreaterThanOrEqual(190 - 1e-6);
});

test('reduced motion drops to one ambient charge, no near-parallax stars, no foreground', () => {
  const layout = computeHomeLayout({ ...REF, reducedMotion: true });
  expect(layout.ambientChargeCount).toBe(1);
  expect(layout.starCountNear).toBe(0);
  expect(layout.showForeground).toBe(false);
});

test('level preview is derived from the real authored board', () => {
  for (const level of LEVEL_DEFINITIONS) {
    const preview = homeLevelPreview(level);
    const parsed = parsePixelArt(level.id, level.pixelArt, { ...DEFAULT_ART_LEGEND, ...(level.legend ?? {}) });
    expect(preview.cols).toBe(parsed.width);
    expect(preview.rows).toBe(parsed.height);
    expect(preview.cells).toHaveLength(parsed.pixels.length);
    // Colour relationships preserved (same distinct set, first-seen order).
    const distinct = [...new Set(parsed.pixels.map((p) => p.color))];
    expect(preview.colors).toEqual(distinct);
    expect(preview.simplify).toBe(Math.max(parsed.width, parsed.height) >= 13);
  }
});

test('preview grid fits inside its box with a positive cell size', () => {
  const preview = homeLevelPreview(requireLevel(7));
  const grid = previewGrid(preview, { size: 200 });
  expect(grid.cell).toBeGreaterThanOrEqual(2);
  expect(grid.originX).toBeGreaterThanOrEqual(0);
  expect(grid.originY).toBeGreaterThanOrEqual(0);
  expect(grid.cell * preview.cols).toBeLessThanOrEqual(200);
  expect(grid.cell * preview.rows).toBeLessThanOrEqual(200);
});

test('ambient charge specs are deterministic, clamped, and drawn from the level palette', () => {
  const level = requireLevel(6);
  const a = ambientChargeSpecs(level, 3);
  const b = ambientChargeSpecs(level, 3);
  expect(a).toEqual(b);
  expect(a).toHaveLength(3);
  expect(ambientChargeSpecs(level, 9)).toHaveLength(3);
  expect(ambientChargeSpecs(level, 0)).toHaveLength(0);

  const levelColors = new Set(level.tunnels.flat().map((s) => s.color));
  for (const spec of a) {
    expect(levelColors.has(spec.color)).toBe(true);
    expect(spec.phase).toBeGreaterThanOrEqual(0);
    expect(spec.phase).toBeLessThan(1);
    expect(spec.periodMs).toBeGreaterThan(8000);
    expect(spec.periodMs).toBeLessThan(20000);
    expect(spec.direction).toBe(1);
  }
  // No two charges share a period — the set never reads as one synced loop.
  expect(new Set(a.map((s) => s.periodMs)).size).toBe(a.length);
});
