import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import { addCharge, createBlankLevel, paintCell } from '../model';
import { setModifier } from '../modifiers';
import { thumbnailDataUri, thumbnailModel, thumbnailSVG } from '../thumbnail';

describe('thumbnailModel', () => {
  test('reads the artwork into flat coloured cells', () => {
    const m = thumbnailModel(LEVEL_DEFINITIONS[0]!); // Moon, 7×7 white
    expect(m.width).toBe(7);
    expect(m.height).toBe(7);
    expect(m.colors).toEqual(['white']);
    expect(m.cells.length).toBeGreaterThan(0);
    expect(m.cells.every((c) => c.color === 'white' && !c.marker)).toBe(true);
  });

  test('carries modifier markers when a level has special pixels', () => {
    let level = createBlankLevel({ width: 4, height: 1 });
    level = paintCell(level, 0, 0, 'white');
    level = paintCell(level, 1, 0, 'white');
    level = addCharge(level, 0, { color: 'white', capacity: 2 });
    level = setModifier(level, 0, 0, 'frozen');
    const m = thumbnailModel(level);
    expect(m.cells.find((c) => c.x === 0)?.marker).toBeTruthy();
    expect(m.cells.find((c) => c.x === 1)?.marker).toBeUndefined();
  });
});

describe('thumbnailSVG', () => {
  test('is deterministic for a given level', () => {
    const a = thumbnailSVG(LEVEL_DEFINITIONS[4]!);
    const b = thumbnailSVG(LEVEL_DEFINITIONS[4]!);
    expect(a).toBe(b);
  });

  test('every campaign level renders a non-empty, timestamp-free SVG', () => {
    for (const def of LEVEL_DEFINITIONS) {
      const svg = thumbnailSVG(def, { cell: 6 });
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('<rect');
      expect(svg).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });

  test('cell size scales the viewport', () => {
    const svg = thumbnailSVG(LEVEL_DEFINITIONS[0]!, { cell: 10 });
    expect(svg).toContain('width="70" height="70"');
  });

  test('markers option draws an outline ring only on special pixels', () => {
    let level = createBlankLevel({ width: 2, height: 1 });
    level = paintCell(level, 0, 0, 'white');
    level = paintCell(level, 1, 0, 'white');
    level = addCharge(level, 0, { color: 'white', capacity: 2 });
    level = setModifier(level, 1, 0, 'bomb');
    const withMarkers = thumbnailSVG(level, { markers: true });
    const without = thumbnailSVG(level, { markers: false });
    expect(withMarkers).toContain('<circle');
    expect(without).not.toContain('<circle');
  });

  test('data URI is deterministic and inline (no base64)', () => {
    const uri = thumbnailDataUri(LEVEL_DEFINITIONS[1]!);
    expect(uri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(uri).toBe(thumbnailDataUri(LEVEL_DEFINITIONS[1]!));
  });
});
