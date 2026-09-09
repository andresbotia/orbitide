import {
  COLOR_MARKS,
  GAMEPLAY_COLORS,
  colorMark,
  luminance,
  markContrast,
  markDetail,
  recommendColorAssist,
  simplifiedMark,
} from '@/theme/colorAssist';
import { orbColors, orbGlow, orbLabel } from '@/theme/colors';
import type { OrbColor } from '@/game/engine/types';

test('the gameplay palette is exactly the 15 approved colours, in hue-wheel order', () => {
  expect(GAMEPLAY_COLORS).toEqual([
    'white', 'yellow', 'gold', 'orange', 'red', 'coral', 'pink', 'magenta',
    'purple', 'indigo', 'blue', 'cyan', 'teal', 'green', 'lime',
  ]);
  // Every palette token map covers all 15 with no extras.
  for (const map of [orbColors, orbGlow, orbLabel]) {
    expect(Object.keys(map).sort()).toEqual([...GAMEPLAY_COLORS].sort());
  }
});

test('15/15 colour coverage: one mark per colour, every mark name unique', () => {
  expect(Object.keys(COLOR_MARKS).sort()).toEqual([...GAMEPLAY_COLORS].sort());
  const names = GAMEPLAY_COLORS.map((c) => colorMark(c).name);
  expect(new Set(names).size).toBe(15);
});

test('every mark is topologically unique (not just colour or rotation)', () => {
  const signature = (c: OrbColor) =>
    JSON.stringify(colorMark(c).parts.map((p) => ({ ...p, offset: undefined })));
  const sigs = GAMEPLAY_COLORS.map(signature);
  expect(new Set(sigs).size).toBe(15);

  // At most one pure single-bar rotation pair in the whole set.
  const singleBars = GAMEPLAY_COLORS.filter((c) => {
    const parts = colorMark(c).parts;
    return parts.length === 1 && parts[0]!.p === 'bar';
  });
  expect(singleBars.length).toBeLessThanOrEqual(2);
});

test('marks build from a small shared primitive vocabulary (machine language)', () => {
  const allowed = new Set(['dot', 'ring', 'bar', 'tri', 'sq', 'arc']);
  for (const c of GAMEPLAY_COLORS) {
    for (const part of colorMark(c).parts) {
      expect(allowed.has(part.p)).toBe(true);
    }
    expect(colorMark(c).parts.length).toBeGreaterThanOrEqual(1);
    expect(colorMark(c).parts.length).toBeLessThanOrEqual(3);
  }
});

test('contrast strategy is driven by base luminance and always resolves', () => {
  const strategies = new Set<string>();
  for (const c of GAMEPLAY_COLORS) {
    const l = luminance(orbColors[c]);
    const { strategy, fill, halo } = markContrast(c);
    strategies.add(strategy);
    if (l >= 0.5) expect(strategy).toBe('darkOnLight');
    else if (l <= 0.24) expect(strategy).toBe('lightOnDark');
    else expect(strategy).toBe('lightHaloed');
    expect(fill.startsWith('#')).toBe(true);
    if (strategy === 'lightHaloed') expect(halo).not.toBeNull();
    else expect(halo).toBeNull();
  }
  // Bright and dark bodies both exist in the palette.
  expect(strategies.has('darkOnLight')).toBe(true);
  expect(strategies.has('lightOnDark')).toBe(true);
});

test('density fallback simplifies without losing identity and raises min stroke', () => {
  expect(markDetail(7)).toBe('full');
  expect(markDetail(9)).toBe('full');
  expect(markDetail(11)).toBe('compact');
  expect(markDetail(13)).toBe('compact');
  expect(markDetail(15)).toBe('minimal');
  expect(markDetail(17)).toBe('minimal');

  for (const c of GAMEPLAY_COLORS) {
    const full = simplifiedMark(c, 'full');
    const min = simplifiedMark(c, 'minimal');
    expect(min.parts.length).toBeGreaterThanOrEqual(1);
    expect(min.parts.length).toBeLessThanOrEqual(full.parts.length);
    expect(min.minStroke).toBeGreaterThan(full.minStroke);
    // The dominant (first) part always survives — the identity anchor.
    expect(min.parts[0]).toEqual(full.parts[0]);
  }
  // Even minimal marks stay distinct by their dominant part + colour count.
  const minPrimary = GAMEPLAY_COLORS.map((c) => simplifiedMark(c, 'minimal').parts[0]!.p);
  expect(new Set(minPrimary).size).toBeGreaterThanOrEqual(5);
});

test('Color Assist is only ever recommended, never forced, on colour-dense levels', () => {
  expect(recommendColorAssist(3)).toBe(false);
  expect(recommendColorAssist(5)).toBe(false);
  expect(recommendColorAssist(6)).toBe(true);
  expect(recommendColorAssist(15)).toBe(true);
});
