import { orbColors } from '../colors';
import { material } from '../material';

const HEX_OR_RGBA = /^(#[0-9A-Fa-f]{6}|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\))$/;

test('every material token is a valid colour string', () => {
  for (const [name, value] of Object.entries(material)) {
    expect(value).toMatch(HEX_OR_RGBA);
    expect(name.length).toBeGreaterThan(0);
  }
});

test('structure/raised/recessed surfaces are three distinct tones', () => {
  const tones = new Set([material.structuralSurface, material.raisedSurface, material.recessedSurface]);
  expect(tones.size).toBe(3);
});

test('bevel highlight is lighter than bevel shadow (upper-left light / lower-right dark)', () => {
  const luminance = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
  };
  expect(luminance(material.bevelHighlight)).toBeGreaterThan(luminance(material.bevelShadow));
});

test('material never reuses a gameplay orb colour (brand <-> gameplay separation)', () => {
  const gameplayHexes = new Set(Object.values(orbColors).map((c) => c.toUpperCase()));
  for (const value of Object.values(material)) {
    if (value.startsWith('#')) expect(gameplayHexes.has(value.toUpperCase())).toBe(false);
  }
});
