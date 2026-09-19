import { comboTierCrossed, COMBO_SOUND_TIERS, GP_MOTION, nextComboChain, pulseEnvelope } from '../gameplayMotion';
import { GP } from '../gameplayUi';
import { revealTimeline } from '../../game/rendering/revealGeometry';

describe('combo chain', () => {
  const W = GP_MOTION.comboWindowMs;

  test('hits inside the window extend the chain, across any number of Pals', () => {
    let chain = 0;
    let last = -1e9;
    for (let i = 0; i < 8; i++) {
      const at = i * 110; // one Pal sweeping a row: PIXEL_CLEAR_INTERVAL apart
      chain = nextComboChain(chain, last, at, 1, W);
      last = at;
    }
    expect(chain).toBe(8);
  });

  test('a gap longer than the window restarts at the new hits', () => {
    expect(nextComboChain(12, 0, W + 1, 1, W)).toBe(1);
    expect(nextComboChain(12, 0, W, 1, W)).toBe(13);
  });

  test('several hits landing in one frame all count; zero hits change nothing', () => {
    expect(nextComboChain(3, 0, 16, 3, W)).toBe(6);
    expect(nextComboChain(3, 0, 16, 0, W)).toBe(3);
  });

  test('each sound tier fires once, only when crossed upward', () => {
    expect(comboTierCrossed(5, 6)).toBe(6);
    expect(comboTierCrossed(6, 7)).toBe(0);
    expect(comboTierCrossed(4, 12)).toBe(10);
    expect(comboTierCrossed(12, 1)).toBe(0);
    expect(COMBO_SOUND_TIERS[0]).toBe(GP_MOTION.comboChipAt);
  });

  test('momentum thresholds escalate edge -> chip -> gold', () => {
    expect(GP_MOTION.comboEdgeAt).toBeLessThan(GP_MOTION.comboChipAt);
    expect(GP_MOTION.comboChipAt).toBeLessThan(GP_MOTION.comboGoldAt);
  });
});

test('pulse envelope rises, falls and is zero outside its window', () => {
  expect(pulseEnvelope(-1, 300, 60)).toBe(0);
  expect(pulseEnvelope(30, 300, 60)).toBeCloseTo(0.5);
  expect(pulseEnvelope(60, 300, 60)).toBeCloseTo(1);
  expect(pulseEnvelope(180, 300, 60)).toBeCloseTo(0.5);
  expect(pulseEnvelope(300, 300, 60)).toBe(0);
});

test('ACTIVE capacity refusal keeps its locked behaviour (~1.14x danger flash)', () => {
  expect(GP_MOTION.capacityScale).toBeCloseTo(0.14);
  expect(GP_MOTION.capacityRiseMs + GP_MOTION.capacityFallMs).toBe(500);
});

test('win reveal shows the restored artwork before any text, NEXT stays in its window', () => {
  for (const reduced of [false, true]) {
    const tl = revealTimeline(reduced);
    expect(tl.restoreMs).toBeLessThanOrEqual(tl.settleMs);
    expect(tl.settleMs).toBeLessThanOrEqual(tl.nodesStartMs);
    expect(tl.restoreMs).toBeLessThan(tl.titleMs);
    expect(tl.edgeMs).toBeLessThan(tl.titleMs);
  }
  const full = revealTimeline(false);
  // At least ~0.45 s of finished art on its own before the trace begins.
  expect(full.nodesStartMs).toBeGreaterThanOrEqual(450);
});

test('gameplay palette has no purple / violet / lavender', () => {
  const hue = (hex: string) => {
    const n = parseInt(hex.slice(1, 7), 16);
    const r = ((n >> 16) & 255) / 255; const g = ((n >> 8) & 255) / 255; const b = (n & 255) / 255;
    const max = Math.max(r, g, b); const min = Math.min(r, g, b); const d = max - min;
    if (d < 0.08) return -1; // neutral
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; return h < 0 ? h + 360 : h;
  };
  for (const [name, value] of Object.entries(GP)) {
    if (!value.startsWith('#')) continue;
    const h = hue(value);
    expect({ name, purple: h >= 255 && h <= 300 }).toEqual({ name, purple: false });
  }
});
