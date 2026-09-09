import { createGame } from '../../engine/createGame';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import { createBlankLevel, paintCell, addCharge } from '../model';
import {
  fromLevelDefinition, requiredLegend, serializeToJSON, serializeToTS,
  toLevelDefinition, toPixelArt,
} from '../serialize';

describe('board → pixelArt', () => {
  test('row-major, full-width, "." for empty', () => {
    let level = createBlankLevel({ width: 4, height: 3 });
    level = paintCell(level, 0, 0, 'white');
    level = paintCell(level, 3, 2, 'white');
    expect(toPixelArt(level)).toEqual(['W...', '....', '...W']);
  });

  test('non-default colours use stable extra chars and force a legend', () => {
    let level = createBlankLevel({ width: 2, height: 1 });
    level = paintCell(level, 0, 0, 'gold');
    level = paintCell(level, 1, 0, 'teal');
    level = addCharge(level, 0, { color: 'gold', capacity: 1 });
    level = addCharge(level, 0, { color: 'teal', capacity: 1 });
    expect(toPixelArt(level)).toEqual(['AT']);
    expect(requiredLegend(level)).toEqual({ A: 'gold', T: 'teal' });
    const def = toLevelDefinition(level);
    expect(def.legend).toEqual({ A: 'gold', T: 'teal' });
    // and it still parses
    expect(createGame(def).pixels.map((p) => p.color)).toEqual(['gold', 'teal']);
  });

  test('a level with only default colours serialises with no legend', () => {
    let level = createBlankLevel({ width: 2, height: 1 });
    level = paintCell(level, 0, 0, 'blue');
    expect(requiredLegend(level)).toBeUndefined();
    expect(toLevelDefinition(level).legend).toBeUndefined();
  });
});

describe('deterministic text output', () => {
  test('serializeToJSON / serializeToTS are stable across calls', () => {
    const level = fromLevelDefinition(LEVEL_DEFINITIONS[3]!);
    expect(serializeToJSON(level)).toBe(serializeToJSON(level));
    expect(serializeToTS(level)).toBe(serializeToTS(level));
  });

  test('serializeToTS emits a paste-ready object literal', () => {
    let level = createBlankLevel({ id: 42, width: 3, height: 1, title: "O'Brien", themeId: 'comet-trail', difficulty: 'medium' });
    level = paintCell(level, 1, 0, 'white');
    level = addCharge(level, 0, { color: 'white', capacity: 1 });
    const ts = serializeToTS(level);
    expect(ts).toContain('id: 42, title: \'O\\\'Brien\', themeId: \'comet-trail\',');
    expect(ts).toContain("difficulty: 'medium', holdingCapacity: 3,");
    expect(ts).toContain("'.W.',");
    expect(ts).toContain('[{ color: \'white\', capacity: 1 }],');
    expect(ts.trim().startsWith('{')).toBe(true);
    expect(ts.trim().endsWith('}')).toBe(true);
  });
});

describe('fromLevelDefinition', () => {
  test('reads the engine parser output, keeping reveal + legend', () => {
    const level = fromLevelDefinition(LEVEL_DEFINITIONS[0]!);
    expect(level.width).toBe(7);
    expect(level.height).toBe(7);
    expect(level.reveal?.name).toBe('THE CRESCENT');
    expect(Object.keys(level.cells).length).toBe(createGame(LEVEL_DEFINITIONS[0]!).pixels.length);
  });
});
