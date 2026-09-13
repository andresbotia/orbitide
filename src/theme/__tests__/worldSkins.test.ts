import { orbColors } from '../colors';
import { WORLD_SKIN_THEME_IDS, worldSkin } from '../worldSkins';

const REAL_CAMPAIGN_THEME_IDS = [
  'first-light', 'wild-garden', 'neon-nights', 'mechanical-city', 'cosmic-frontier',
  'world-landmarks', 'ocean-depths', 'mythic-realm', 'prehistoric-titans', 'masterpiece-gallery',
];

test('every real campaign world has a skin entry', () => {
  for (const themeId of REAL_CAMPAIGN_THEME_IDS) {
    expect(WORLD_SKIN_THEME_IDS).toContain(themeId);
  }
  expect(WORLD_SKIN_THEME_IDS).toHaveLength(REAL_CAMPAIGN_THEME_IDS.length);
});

test('every skin has valid, distinct accent/secondaryAccent colours', () => {
  const seen = new Set<string>();
  for (const themeId of WORLD_SKIN_THEME_IDS) {
    const skin = worldSkin(themeId);
    expect(skin.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(skin.secondaryAccent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(skin.accent).not.toBe(skin.secondaryAccent);
    expect(seen.has(skin.accent)).toBe(false);
    seen.add(skin.accent);
  }
});

test('world accents never reuse a gameplay orb colour (brand <-> gameplay separation)', () => {
  const gameplayHexes = new Set(Object.values(orbColors).map((c) => c.toUpperCase()));
  for (const themeId of WORLD_SKIN_THEME_IDS) {
    const skin = worldSkin(themeId);
    expect(gameplayHexes.has(skin.accent.toUpperCase())).toBe(false);
    expect(gameplayHexes.has(skin.secondaryAccent.toUpperCase())).toBe(false);
  }
});

test('an unknown themeId falls back safely instead of throwing', () => {
  expect(() => worldSkin('not-a-real-world')).not.toThrow();
  expect(() => worldSkin(undefined)).not.toThrow();
  const fallback = worldSkin('not-a-real-world');
  expect(fallback.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
});
