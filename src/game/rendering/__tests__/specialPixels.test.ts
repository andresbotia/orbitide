import type { ModifierInstance, ModifierKind } from '@/game/engine/types';
import {
  deterministicDetail,
  hashSeed,
  IDLE_ANIMATION_BUDGET,
  IDLE_MOTIONS,
  layerIndex,
  materialDetail,
  MATERIAL_LAYERS,
  MAX_OVERFLOW,
  modifierOverflow,
  pickIdleAnimated,
  resolveModifier,
} from '../specialPixels';

const KINDS: ModifierKind[] = ['frozen', 'shielded', 'armored', 'locked', 'bomb', 'wild', 'linked', 'hidden'];
const DENSITIES = [7, 9, 11, 13, 15, 17];

test('density maps to three material detail buckets', () => {
  expect(materialDetail(7)).toBe('full');
  expect(materialDetail(9)).toBe('full');
  expect(materialDetail(11)).toBe('medium');
  expect(materialDetail(13)).toBe('medium');
  expect(materialDetail(15)).toBe('minimal');
  expect(materialDetail(17)).toBe('minimal');
});

test('overflow never exceeds the hard cap and shrinks monotonically with density', () => {
  for (const kind of KINDS) {
    const byD = DENSITIES.map((d) => modifierOverflow(kind, materialDetail(d)));
    for (const v of byD) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(MAX_OVERFLOW + 1e-9);
    }
    for (let i = 1; i < byD.length; i++) expect(byD[i]!).toBeLessThanOrEqual(byD[i - 1]! + 1e-9);
  }
  // Bomb is recessed — barely any overflow at any density.
  expect(modifierOverflow('bomb', 'full')).toBeLessThan(0.05);
});

test('the material z-order is a fixed, unique, ordered list ending at colorAssist', () => {
  expect(new Set(MATERIAL_LAYERS).size).toBe(MATERIAL_LAYERS.length);
  expect(MATERIAL_LAYERS[0]).toBe('shadow');
  expect(MATERIAL_LAYERS[MATERIAL_LAYERS.length - 1]).toBe('colorAssist');
  expect(layerIndex('coloredBody')).toBeLessThan(layerIndex('modifierShell'));
  expect(layerIndex('modifierShell')).toBeLessThan(layerIndex('damageState'));
  expect(layerIndex('damageState')).toBeLessThan(layerIndex('colorAssist'));
});

test('every kind resolves at every density with a shell, valid counts and features', () => {
  for (const kind of KINDS) {
    for (const density of DENSITIES) {
      const r = resolveModifier({ kind, seed: 1 }, density);
      expect(r.kind).toBe(kind);
      expect(r.shell).toBeTruthy();
      expect(r.detail).toBe(materialDetail(density));
      expect(r.overflow).toBe(modifierOverflow(kind, r.detail));
      expect(r.progression).toBeGreaterThanOrEqual(0);
      expect(r.progression).toBeLessThanOrEqual(1);
      for (const v of Object.values(r.counts)) expect(v).toBeGreaterThanOrEqual(0);
    }
  }
});

test('frozen state machine: crack count and compromise escalate through the five states', () => {
  const states = ['intact', 'cracked1', 'cracked2', 'fracturing', 'breaking'];
  const cracks = states.map((state) => resolveModifier({ kind: 'frozen', state }, 7).counts.cracks);
  expect(cracks).toEqual([0, 1, 2, 3, 3]);
  const prog = states.map((state) => resolveModifier({ kind: 'frozen', state }, 7).progression);
  for (let i = 1; i < prog.length; i++) expect(prog[i]!).toBeGreaterThanOrEqual(prog[i - 1]!);
  expect(resolveModifier({ kind: 'frozen', state: 'breaking' }, 7).baseCompromised).toBe(true);
  expect(resolveModifier({ kind: 'frozen', state: 'intact' }, 7).baseCompromised).toBe(false);
  // progress (0..1) is an accepted alternative driver.
  expect(resolveModifier({ kind: 'frozen', progress: 0 }, 7).counts.cracks).toBe(0);
  expect(resolveModifier({ kind: 'frozen', progress: 1 }, 7).baseCompromised).toBe(true);
});

test('frozen dense simplification drops bubbles then refraction/frost', () => {
  const full = resolveModifier({ kind: 'frozen', state: 'intact', seed: 3 }, 7);
  const medium = resolveModifier({ kind: 'frozen', state: 'intact', seed: 3 }, 13);
  const minimal = resolveModifier({ kind: 'frozen', state: 'intact', seed: 3 }, 15);
  expect(full.counts.bubbles).toBeGreaterThan(0);
  expect(medium.counts.bubbles).toBe(0);
  expect(full.features.refraction).toBe(true);
  expect(minimal.features.refraction).toBe(false);
  expect(minimal.features.frostCloud).toBe(false);
  // A readable shell + one crack + rim always survive.
  const cracked = resolveModifier({ kind: 'frozen', state: 'cracked1' }, 15);
  expect(cracked.counts.cracks).toBe(1);
  expect(cracked.features.rimLight).toBe(true);
});

test('shielded collapses the shell before the base pixel is ever compromised', () => {
  for (const state of ['intact', 'stressed', 'collapsing', 'gone']) {
    expect(resolveModifier({ kind: 'shielded', state }, 7).baseCompromised).toBe(false);
  }
  expect(resolveModifier({ kind: 'shielded', state: 'collapsing' }, 7).shellFailing).toBe(true);
  expect(resolveModifier({ kind: 'shielded', state: 'intact' }, 7).features.airGap).toBe(true);
  expect(resolveModifier({ kind: 'shielded', state: 'gone' }, 7).features.airGap).toBe(false);
  // micro-arcs only at full detail.
  expect(resolveModifier({ kind: 'shielded', state: 'intact' }, 7).features.microArc).toBe(true);
  expect(resolveModifier({ kind: 'shielded', state: 'intact' }, 13).features.microArc).toBe(false);
});

test('armored plate count is the durability, clamped 1..4 and countable', () => {
  expect(resolveModifier({ kind: 'armored', level: 1 }, 7).counts.plates).toBe(1);
  expect(resolveModifier({ kind: 'armored', level: 4 }, 7).counts.plates).toBe(4);
  expect(resolveModifier({ kind: 'armored', level: 9 }, 7).counts.plates).toBe(4);
  expect(resolveModifier({ kind: 'armored', level: 0 }, 7).counts.plates).toBe(1);
  // Bolts drop before the plate silhouette.
  expect(resolveModifier({ kind: 'armored', level: 3 }, 7).counts.bolts).toBeGreaterThan(0);
  expect(resolveModifier({ kind: 'armored', level: 3 }, 15).counts.bolts).toBe(0);
  expect(resolveModifier({ kind: 'armored', level: 3 }, 15).counts.plates).toBe(3);
});

test('locked desaturates the base while locked and releases it clean', () => {
  expect(resolveModifier({ kind: 'locked', state: 'locked' }, 7).desaturate).toBeGreaterThan(0);
  expect(resolveModifier({ kind: 'locked', state: 'locked' }, 7).features.pinGlow).toBe(true);
  expect(resolveModifier({ kind: 'locked', state: 'released' }, 7).desaturate).toBe(0);
  expect(resolveModifier({ kind: 'locked', state: 'released' }, 7).features.pinGlow).toBe(false);
});

test('bomb stages drive rim urgency and the pulse motion, never a countdown', () => {
  expect(resolveModifier({ kind: 'bomb', state: 'dormant' }, 7).motion).toBeNull();
  expect(resolveModifier({ kind: 'bomb', state: 'warning' }, 7).motion).toBe('bombPulse');
  expect(resolveModifier({ kind: 'bomb', state: 'critical' }, 7).motion).toBe('bombPulse');
  expect(resolveModifier({ kind: 'bomb', state: 'critical' }, 7).progression).toBe(1);
  expect(resolveModifier({ kind: 'bomb', state: 'dormant' }, 15).features.ledRing).toBe(false);
});

test('wild facet count simplifies with density; idle shimmer vs resolve', () => {
  expect(resolveModifier({ kind: 'wild', state: 'idle' }, 7).counts.facets).toBe(6);
  expect(resolveModifier({ kind: 'wild', state: 'idle' }, 13).counts.facets).toBe(3);
  expect(resolveModifier({ kind: 'wild', state: 'idle' }, 15).counts.facets).toBe(0);
  expect(resolveModifier({ kind: 'wild', state: 'idle' }, 7).motion).toBe('facetShimmer');
  expect(resolveModifier({ kind: 'wild', state: 'resolving' }, 7).motion).toBe('wildResolve');
  expect(resolveModifier({ kind: 'wild', state: 'idle' }, 7).features.travelingHighlight).toBe(true);
});

test('linked exposes the wiring hooks the connection renderer consumes', () => {
  const solo = resolveModifier({ kind: 'linked' }, 7);
  expect(solo.link).toEqual({ linkId: undefined, linkedPixelIds: [], linkProgress: 0 });
  expect(solo.features.conduit).toBe(false);
  expect(solo.counts.sockets).toBe(1);

  const wired = resolveModifier({ kind: 'linked', linkId: 'L1', linkedPixelIds: ['a', 'b'], linkProgress: 0.5 }, 7);
  expect(wired.link).toEqual({ linkId: 'L1', linkedPixelIds: ['a', 'b'], linkProgress: 0.5 });
  expect(wired.features.conduit).toBe(true);
  expect(wired.counts.sockets).toBe(2);
  expect(wired.progression).toBe(0.5);
  expect(wired.motion).toBe('linkPulse');
});

test('hidden concealment falls as it is revealed; silhouette scanlines simplify', () => {
  expect(resolveModifier({ kind: 'hidden', state: 'concealed' }, 7).concealment).toBe(1);
  expect(resolveModifier({ kind: 'hidden', state: 'partial' }, 7).concealment).toBe(0.5);
  expect(resolveModifier({ kind: 'hidden', state: 'revealed' }, 7).concealment).toBe(0);
  expect(resolveModifier({ kind: 'hidden', state: 'concealed' }, 7).counts.scanlines).toBe(3);
  expect(resolveModifier({ kind: 'hidden', state: 'concealed' }, 15).counts.scanlines).toBe(1);
  expect(resolveModifier({ kind: 'hidden', state: 'concealed' }, 7).features.colorBleed).toBe(true);
});

test('decorative detail is deterministic for a seed and varies across seeds', () => {
  expect(deterministicDetail(42, 5)).toEqual(deterministicDetail(42, 5));
  expect(deterministicDetail(42, 5)).not.toEqual(deterministicDetail(43, 5));
  expect(deterministicDetail(42, 0)).toEqual([]);
  const pts = deterministicDetail(hashSeed('L7-p3-4'), 6, 0.3);
  expect(pts).toHaveLength(6);
  for (const p of pts) {
    expect(Math.abs(p.x)).toBeLessThanOrEqual(0.3);
    expect(Number.isFinite(p.r)).toBe(true);
  }
  // resolveModifier threads instance.seed through deterministically.
  const a = resolveModifier({ kind: 'frozen', state: 'intact', seed: 99 }, 7);
  const b = resolveModifier({ kind: 'frozen', state: 'intact', seed: 99 }, 7);
  expect(a.detailPoints).toEqual(b.detailPoints);
});

test('hashSeed is stable and 32-bit', () => {
  expect(hashSeed('abc')).toBe(hashSeed('abc'));
  expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
  expect(hashSeed('a very long pixel id L15-p14-14')).toBeGreaterThanOrEqual(0);
  expect(hashSeed('x')).toBeLessThan(2 ** 32);
});

test('idle animation budget caps repeating motions, prioritising urgency', () => {
  expect(IDLE_ANIMATION_BUDGET).toBe(6);
  expect([...IDLE_MOTIONS]).toEqual(expect.arrayContaining(['bombPulse', 'facetShimmer', 'linkPulse', 'scanReveal']));

  const make = (id: string, mod: ModifierInstance) => ({ id, render: resolveModifier(mod, 7) });
  const many = [
    make('crit1', { kind: 'bomb', state: 'critical' }),
    make('wild1', { kind: 'wild', state: 'active' }),
    ...Array.from({ length: 8 }, (_, i) => make(`hid${i}`, { kind: 'hidden', state: 'concealed' })),
  ];
  const picked = pickIdleAnimated(many);
  expect(picked.size).toBe(IDLE_ANIMATION_BUDGET);
  // The urgent ones are always in.
  expect(picked.has('crit1')).toBe(true);
  expect(picked.has('wild1')).toBe(true);
  // Deterministic — same input, same set.
  expect(pickIdleAnimated(many)).toEqual(picked);
  // A one-shot-only board animates nothing on idle.
  expect(pickIdleAnimated([make('f', { kind: 'frozen', state: 'breaking' })]).size).toBe(0);
});
