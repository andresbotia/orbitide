import type { ModifierKind } from '@/game/engine/types';
import {
  layerIndex,
  materialDetail,
  modifierOverflow,
  resolveModifier,
} from '../specialPixels';
import { GAMEPLAY_COLORS, colorMark, markContrast, simplifiedMark, markDetail } from '@/theme/colorAssist';

const KINDS: ModifierKind[] = ['frozen', 'shielded', 'armored', 'locked', 'bomb', 'wild', 'linked', 'hidden'];
const DENSITIES = [7, 9, 11, 13, 15, 17];

test('Color Assist always composes above the modifier shell and damage layers', () => {
  expect(layerIndex('modifierInner')).toBeLessThan(layerIndex('modifierShell'));
  expect(layerIndex('modifierShell')).toBeLessThan(layerIndex('colorAssist'));
  expect(layerIndex('damageState')).toBeLessThan(layerIndex('colorAssist'));
  expect(layerIndex('transientHit')).toBeLessThan(layerIndex('colorAssist'));
});

test('dense-board matrix: every modifier + colour stays identifiable and non-merging at 7..17', () => {
  for (const density of DENSITIES) {
    const detail = materialDetail(density);
    for (const kind of KINDS) {
      const overflow = modifierOverflow(kind, detail);
      // Two adjacent maxed modifiers never reach each other's centre.
      expect(2 * overflow).toBeLessThanOrEqual(0.5);

      for (const color of GAMEPLAY_COLORS) {
        const r = resolveModifier({ kind, seed: 7 }, density);
        // A countable identity survives at every density.
        const countable =
          r.counts.plates + r.counts.cracks + r.counts.facets + r.counts.sockets
          + r.counts.scanlines + (r.shell ? 1 : 0);
        expect(countable).toBeGreaterThan(0);

        // The Color Assist mark for this colour is still renderable + distinct.
        const mark = simplifiedMark(color, markDetail(density));
        expect(mark.parts.length).toBeGreaterThanOrEqual(1);
        expect(mark.minStroke).toBeGreaterThanOrEqual(0.08);
        expect(markContrast(color).fill.startsWith('#')).toBe(true);
      }
    }
  }
});

test('state → visual mapping is a pure function of the instance (no hidden RNG)', () => {
  for (const kind of KINDS) {
    const a = resolveModifier({ kind, state: 'x', level: 2, progress: 0.5, seed: 11 }, 11);
    const b = resolveModifier({ kind, state: 'x', level: 2, progress: 0.5, seed: 11 }, 11);
    expect(a).toEqual(b);
  }
});

test('modifiers keep the cube grammar: no modifier reports the base as gone unless it truly breaks', () => {
  // Only frozen "breaking" compromises the base cube in these presentation states.
  for (const kind of KINDS) {
    for (const state of ['intact', 'stressed', 'locked', 'dormant', 'idle', 'concealed', 'warning', 'unlocking']) {
      const r = resolveModifier({ kind, state }, 9);
      if (!(kind === 'frozen' && state === 'breaking')) {
        expect(r.baseCompromised).toBe(false);
      }
    }
  }
  expect(resolveModifier({ kind: 'frozen', state: 'breaking' }, 9).baseCompromised).toBe(true);
});

test('mark identity is colour-scoped, not object-scoped (same everywhere)', () => {
  // The mark for a colour is one stable value — pixel / charge / tunnel / holding
  // all read `colorMark(color)`.
  for (const color of GAMEPLAY_COLORS) {
    expect(colorMark(color)).toBe(colorMark(color));
    expect(colorMark(color).color).toBe(color);
  }
});
