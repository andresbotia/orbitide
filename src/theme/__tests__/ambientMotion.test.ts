import { WORLD_SKIN_THEME_IDS, worldSkin } from '../worldSkins';
import { ambientMotion, ambientParticleCount, type AmbientIntensity } from '../ambientMotion';

const INTENSITIES: AmbientIntensity[] = ['low', 'medium', 'high'];

test('every real world ambientId has a motion spec', () => {
  for (const themeId of WORLD_SKIN_THEME_IDS) {
    const { ambientId } = worldSkin(themeId);
    const spec = ambientMotion(ambientId);
    expect(spec).toBeDefined();
    expect(['driftUp', 'driftSide', 'twinkle', 'sway']).toContain(spec.kind);
    expect(['dot', 'square', 'line']).toContain(spec.shape);
    expect(spec.density).toBeGreaterThan(0);
    expect(spec.periodMs).toBeGreaterThan(1000);
  }
});

test('particle counts stay bounded and increase with intensity', () => {
  for (const themeId of WORLD_SKIN_THEME_IDS) {
    const { ambientId } = worldSkin(themeId);
    const counts = INTENSITIES.map((tier) => ambientParticleCount(tier, ambientId));
    for (const c of counts) {
      expect(c).toBeGreaterThanOrEqual(2);
      expect(c).toBeLessThanOrEqual(12); // "largest count, still bounded" — mobile UI ambience, not a particle demo
    }
    // Non-decreasing as intensity rises (low <= medium <= high) for the same world.
    expect(counts[0]).toBeLessThanOrEqual(counts[1]!);
    expect(counts[1]).toBeLessThanOrEqual(counts[2]!);
  }
});

test('cosmic-frontier is the one world whose motion kind is starfield-appropriate (twinkle)', () => {
  const spec = ambientMotion(worldSkin('cosmic-frontier').ambientId);
  expect(spec.kind).toBe('twinkle');
});
