import { createGame } from '../../engine/createGame';
import { addCharge, createBlankLevel, eraseCell, paintCell } from '../model';
import {
  MODIFIER_KINDS, MODIFIER_SPECS, defaultConfig, fromModifierInstance, linkGroups,
  linkGroupMembers, makeModifier, nextLinkGroup, removeModifier,
  setModifier, toModifierInstance, updateModifierConfig,
} from '../modifiers';
import { fromLevelDefinition, toLevelDefinition, toModifierMap } from '../serialize';
import { validateStudioLevel } from '../validate';
import type { StudioLevel } from '../types';

function board(): StudioLevel {
  let level = createBlankLevel({ width: 7, height: 7 });
  for (let x = 0; x < 4; x += 1) level = paintCell(level, x, 0, 'white');
  level = addCharge(level, 0, { color: 'white', capacity: 8 });
  return level;
}

describe('applying / removing / configuring modifiers', () => {
  test('setModifier only lands on a painted cell and seeds an in-bounds config', () => {
    let level = board();
    level = setModifier(level, 9, 9, 'frozen'); // no pixel there
    expect(level.modifiers).toBeUndefined();

    level = setModifier(level, 0, 0, 'frozen');
    expect(level.modifiers!['0,0']).toEqual({ kind: 'frozen', config: { layers: 1 } });

    // switching kind reseeds; same kind keeps the object
    const same = setModifier(level, 0, 0, 'frozen');
    expect(same.modifiers!['0,0']).toBe(level.modifiers!['0,0']);
    const armored = setModifier(level, 0, 0, 'armored');
    expect(armored.modifiers!['0,0']).toEqual({ kind: 'armored', config: { layers: 2 } });
  });

  test('removeModifier drops the key and the map when it empties', () => {
    let level = setModifier(board(), 0, 0, 'wild');
    expect(level.modifiers!['0,0']).toEqual({ kind: 'wild', config: {} });
    level = removeModifier(level, 0, 0);
    expect(level.modifiers).toBeUndefined();
  });

  test('erasing a pixel also removes any modifier on it', () => {
    let level = setModifier(board(), 1, 0, 'shielded');
    level = eraseCell(level, 1, 0);
    expect(level.modifiers?.['1,0']).toBeUndefined();
  });

  test('updateModifierConfig clamps nothing but prunes cleared fields', () => {
    let level = setModifier(board(), 0, 0, 'armored');
    level = updateModifierConfig(level, 0, 0, { layers: 4 });
    expect(level.modifiers!['0,0']!.config.layers).toBe(4);
    level = updateModifierConfig(level, 0, 0, { group: '' });
    expect(level.modifiers!['0,0']!.config.group).toBeUndefined();
  });

  test('every kind has a spec and a default config', () => {
    for (const kind of MODIFIER_KINDS) {
      const spec = MODIFIER_SPECS[kind];
      expect(spec.kind).toBe(kind);
      const cfg = defaultConfig(kind);
      if (spec.layers) expect(cfg.layers).toBe(spec.layers.default);
    }
  });
});

describe('link groups', () => {
  test('members / groups / nextLinkGroup', () => {
    let level = board();
    level = paintCell(level, 5, 0, 'white');
    level = setModifier(level, 0, 0, 'linked');
    level = updateModifierConfig(level, 0, 0, { group: 'link-1' });
    level = setModifier(level, 5, 0, 'linked');
    level = updateModifierConfig(level, 5, 0, { group: 'link-1' });
    expect(linkGroups(level)).toEqual(['link-1']);
    expect(linkGroupMembers(level, 'link-1').sort()).toEqual(['0,0', '5,0']);
    expect(nextLinkGroup(level)).toBe('link-2');
  });
});

describe('engine ↔ studio round-trip', () => {
  test.each(MODIFIER_KINDS)('modifier "%s" survives toModifierInstance → fromModifierInstance', (kind) => {
    const m = makeModifier(kind, kind === 'linked' || kind === 'locked' ? { group: 'g1' } : kind === 'bomb' ? { timer: 3 } : {});
    const back = fromModifierInstance(toModifierInstance(m));
    expect(back).toEqual(m);
  });

  test('a level with modifiers round-trips losslessly through a LevelDefinition', () => {
    let level = board();
    level = paintCell(level, 5, 0, 'white');
    level = setModifier(level, 0, 0, 'frozen');
    level = updateModifierConfig(level, 0, 0, { layers: 3 });
    level = setModifier(level, 1, 0, 'linked');
    level = updateModifierConfig(level, 1, 0, { group: 'a' });
    level = setModifier(level, 5, 0, 'linked');
    level = updateModifierConfig(level, 5, 0, { group: 'a' });

    const def = toLevelDefinition(level);
    expect(Object.keys(def.modifiers!)).toEqual(['0,0', '1,0', '5,0']); // row-major
    const back = toLevelDefinition(fromLevelDefinition(def));
    expect(back.modifiers).toEqual(def.modifiers);
    // idempotent
    expect(JSON.stringify(back)).toBe(JSON.stringify(toLevelDefinition(fromLevelDefinition(back))));
  });

  test('a normal level never emits a modifiers field', () => {
    const level = board();
    expect(toModifierMap(level)).toBeUndefined();
    expect(toLevelDefinition(level).modifiers).toBeUndefined();
    expect(createGame(toLevelDefinition(level)).pixels.every((p) => !p.modifier)).toBe(true);
  });

  test('toModifierMap drops a modifier stranded on an erased cell', () => {
    let level = setModifier(board(), 0, 0, 'frozen');
    level = { ...level, cells: (() => { const c = { ...level.cells }; delete c['0,0']; return c; })() };
    expect(toModifierMap(level)).toBeUndefined();
  });
});

describe('validation', () => {
  const codes = (l: StudioLevel) => validateStudioLevel(l).errors.map((i) => i.code);
  const warns = (l: StudioLevel) => validateStudioLevel(l).warnings.map((i) => i.code);

  test('modifier on an empty cell is an error', () => {
    const level = { ...board(), modifiers: { '6,6': { kind: 'frozen' as const, config: { layers: 1 } } } };
    expect(codes(level)).toContain('modifier/empty-cell');
  });

  test('out-of-range Frozen / Armor layers are errors', () => {
    let level = setModifier(board(), 0, 0, 'frozen');
    level = updateModifierConfig(level, 0, 0, { layers: 9 });
    expect(codes(level)).toContain('modifier/config-range');
  });

  test('a lone Linked member is an orphan error; a pair is clean', () => {
    let level = board();
    level = paintCell(level, 5, 0, 'white');
    level = setModifier(level, 0, 0, 'linked');
    level = updateModifierConfig(level, 0, 0, { group: 'g' });
    expect(codes(level)).toContain('modifier/linked-orphan');

    level = setModifier(level, 5, 0, 'linked');
    level = updateModifierConfig(level, 5, 0, { group: 'g' });
    expect(codes(level)).not.toContain('modifier/linked-orphan');
  });

  test('Linked with no group id is an error', () => {
    const level = setModifier(board(), 0, 0, 'linked');
    expect(codes(level)).toContain('modifier/linked-group-missing');
  });

  test('Linked rejects oversized groups and malformed ids', () => {
    let level = board();
    for (const x of [0, 1, 2]) {
      level = setModifier(level, x, 0, 'linked');
      level = updateModifierConfig(level, x, 0, { group: 'bad group' });
    }
    expect(codes(level)).toContain('modifier/linked-group-size');
    expect(codes(level)).toContain('modifier/linked-group-id');
  });

  test('unknown modifier kind is an error', () => {
    const level = { ...board(), modifiers: { '0,0': { kind: 'portal' as never, config: {} } } };
    expect(codes(level)).toContain('modifier/kind');
  });

  test('a bomb timer is a non-blocking placeholder warning', () => {
    let level = setModifier(board(), 0, 0, 'bomb');
    level = updateModifierConfig(level, 0, 0, { timer: 3 });
    const r = validateStudioLevel(level);
    expect(r.warnings.map((i) => i.code)).toContain('modifier/bomb-placeholder');
    expect(r.exportable).toBe(true);
  });

  test('a valid special pixel does not block export', () => {
    let level = setModifier(board(), 0, 0, 'frozen');
    level = updateModifierConfig(level, 0, 0, { layers: 2 });
    expect(validateStudioLevel(level).exportable).toBe(true);
    expect(warns(level)).not.toContain('modifier/config-range');
  });
});
