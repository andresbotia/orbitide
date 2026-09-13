import { clampToTier, motion, motionTier, type MotionPreset } from '../motion';

test('every named preset falls inside its own declared tier range', () => {
  for (const [name, preset] of Object.entries(motion) as [string, MotionPreset][]) {
    const { min, max } = motionTier[preset.tier];
    expect(preset.durationMs).toBeGreaterThanOrEqual(min);
    expect(preset.durationMs).toBeLessThanOrEqual(max);
    if (preset.easing === 'spring') {
      expect(preset.spring).toBeDefined();
    } else {
      expect(preset.spring).toBeUndefined();
    }
    expect(['end-state', 'static-hold']).toContain(preset.reducedMotion);
    expect(name.length).toBeGreaterThan(0);
  }
});

test('tiers are ordered and non-overlapping at the boundaries the brief specifies', () => {
  expect(motionTier.micro).toEqual({ min: 50, max: 150 });
  expect(motionTier.standard).toEqual({ min: 150, max: 350 });
  expect(motionTier.major).toEqual({ min: 350, max: 800 });
});

test('clampToTier keeps a value within its tier bounds', () => {
  expect(clampToTier('micro', 10)).toBe(50);
  expect(clampToTier('micro', 1000)).toBe(150);
  expect(clampToTier('major', 500)).toBe(500);
});
