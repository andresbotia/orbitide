import { CAMPAIGN_MANIFEST } from '../campaign';

/**
 * Regression test for redesign-audit finding B.6: `campaign.ts` used to group
 * worlds by the pre-authoring-pipeline legacy `themeId` taxonomy, so World
 * Select/World Levels showed stale placeholder names ("Deep Frost", "Curio
 * Cabinet", "Prism Works", "Frostglass Forge", "Skybound", "Tidal Depths",
 * "Arcane Relics", "Starforge") for 8 of the 10 shipped worlds. This pins the
 * REAL, currently-authored campaign so that mismatch cannot silently return.
 */

const EXPECTED_WORLDS = [
  { id: 'first-light', title: 'First Light', themeId: 'first-light' },
  { id: 'wild-garden', title: 'Wild Garden', themeId: 'wild-garden' },
  { id: 'neon-nights', title: 'Neon Nights', themeId: 'neon-nights' },
  { id: 'mechanical-city', title: 'Mechanical City', themeId: 'mechanical-city' },
  { id: 'cosmic-frontier', title: 'Cosmic Frontier', themeId: 'cosmic-frontier' },
  { id: 'world-landmarks', title: 'World Landmarks', themeId: 'world-landmarks' },
  { id: 'ocean-depths', title: 'Ocean Depths', themeId: 'ocean-depths' },
  { id: 'mythic-realm', title: 'Mythic Realm', themeId: 'mythic-realm' },
  { id: 'prehistoric-titans', title: 'Prehistoric Titans', themeId: 'prehistoric-titans' },
  { id: 'masterpiece-gallery', title: 'Masterpiece Gallery', themeId: 'masterpiece-gallery' },
] as const;

test('the campaign manifest exposes exactly the ten current world names/ids, in order', () => {
  expect(CAMPAIGN_MANIFEST.worlds).toHaveLength(10);
  expect(CAMPAIGN_MANIFEST.worlds.map((w) => ({ id: w.id, title: w.title, themeId: w.themeId }))).toEqual(
    EXPECTED_WORLDS.map((w) => ({ ...w })),
  );
});

test('none of the retired legacy world codenames leak into consumer-facing metadata', () => {
  const retired = [
    'deep-frost', 'curio-cabinet', 'prism-works', 'frostglass-forge',
    'skybound', 'tidal-depths', 'arcane-relics', 'starforge',
    'Deep Frost', 'Curio Cabinet', 'Prism Works', 'Frostglass Forge',
    'Skybound', 'Tidal Depths', 'Arcane Relics', 'Starforge',
  ];
  for (const world of CAMPAIGN_MANIFEST.worlds) {
    expect(retired).not.toContain(world.id);
    expect(retired).not.toContain(world.title);
    expect(retired).not.toContain(world.themeId);
  }
});

test('every world groups exactly ten levels, and its levels each carry the matching themeId', () => {
  for (const world of CAMPAIGN_MANIFEST.worlds) {
    expect(world.levelIds).toHaveLength(10);
  }
  // Levels are globally unique across worlds and cover 1-100 with no gaps.
  const allIds = CAMPAIGN_MANIFEST.worlds.flatMap((w) => w.levelIds).sort((a, b) => a - b);
  expect(allIds).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
});

test('each world has a non-empty subtitle and a real (non-gameplay) accent colour', () => {
  for (const world of CAMPAIGN_MANIFEST.worlds) {
    expect(world.display?.subtitle).toBeTruthy();
    expect(world.display?.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
  }
  // Accents are per-world identity, not the flat "everything reads as one
  // neutral card" language `WorldCard.tsx` used pre-redesign.
  const accents = CAMPAIGN_MANIFEST.worlds.map((w) => w.display?.accent);
  expect(new Set(accents).size).toBe(accents.length);
});
