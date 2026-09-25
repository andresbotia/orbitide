import { MAX_BOARD_DIMENSION } from '../../engine/boardLimits';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import { addCharge, createBlankLevel, paintCell, setGridSize, setMeta } from '../model';
import { fromLevelDefinition } from '../serialize';
import { validateStudioLevel } from '../validate';
import type { StudioLevel } from '../types';

const codes = (level: StudioLevel) => {
  const r = validateStudioLevel(level);
  return { errors: r.errors.map((i) => i.code), warnings: r.warnings.map((i) => i.code), r };
};

/** A minimal, fully-valid level: one white pixel, one matching white charge. */
function tiny(): StudioLevel {
  let level = createBlankLevel({ width: 7, height: 7 });
  level = paintCell(level, 3, 3, 'white');
  level = addCharge(level, 0, { color: 'white', capacity: 1 });
  return level;
}

describe('the ten campaign levels validate with zero errors', () => {
  test.each(LEVEL_DEFINITIONS)('level $id has no errors', (def) => {
    const r = validateStudioLevel(fromLevelDefinition(def));
    expect(r.errors).toEqual([]);
    expect(r.exportable).toBe(true);
  });
});

describe('error rules block export', () => {
  test('empty board', () => {
    const { errors, r } = codes(createBlankLevel());
    expect(errors).toContain('board/empty');
    expect(r.exportable).toBe(false);
  });

  test('a board colour with no matching charge', () => {
    let level = createBlankLevel({ width: 7, height: 7 });
    level = paintCell(level, 1, 1, 'red');
    expect(codes(level).errors).toContain('color/no-charge');
  });

  test('invalid capacity', () => {
    let level = tiny();
    level = addCharge(level, 1, { color: 'white', capacity: 0 });
    expect(codes(level).errors).toContain('charge/capacity');
  });

  test('bad metadata', () => {
    let level = setMeta(tiny(), { id: 0 });
    level = { ...level, difficulty: 'legendary' as StudioLevel['difficulty'] };
    const { errors } = codes(level);
    expect(errors).toContain('meta/id');
    expect(errors).toContain('meta/difficulty');
  });

  test('grid dimension outside the supported range', () => {
    const level = setGridSize(tiny(), MAX_BOARD_DIMENSION + 1, 7);
    expect(codes(level).errors).toContain('meta/width');
  });

  test('a pixel outside the grid', () => {
    let level = tiny();
    level = { ...level, cells: { ...level.cells, '99,0': 'white' } };
    expect(codes(level).errors).toContain('board/oob');
  });
});

describe('warnings do not block export', () => {
  test('under- and over-budget colour capacity are warnings', () => {
    let under = createBlankLevel({ width: 7, height: 7 });
    under = paintCell(paintCell(under, 0, 0, 'white'), 1, 0, 'white');
    under = addCharge(under, 0, { color: 'white', capacity: 1 });
    const uw = codes(under);
    expect(uw.warnings).toContain('color/under-budget');
    expect(uw.r.exportable).toBe(true);

    let over = createBlankLevel({ width: 7, height: 7 });
    over = paintCell(over, 0, 0, 'white');
    over = addCharge(over, 0, { color: 'white', capacity: 5 });
    expect(codes(over).warnings).toContain('color/over-budget');
  });

  test('an empty tunnel and an off-tuned grid size warn only', () => {
    const level = setGridSize(tiny(), 8, 8); // 8 is legal, not renderer-tuned
    const { warnings, r } = codes(level);
    expect(warnings).toContain('tunnels/empty');
    expect(warnings).toContain('meta/width-tuned');
    expect(r.exportable).toBe(true);
  });

  test('charges for a colour not on the board warn', () => {
    let level = tiny();
    level = addCharge(level, 1, { color: 'pink', capacity: 2 });
    expect(codes(level).warnings).toContain('color/unused-charge');
  });
});

test('a dense 15×15 board with 90 pixels is accepted (no 30-pixel cap)', () => {
  let level = createBlankLevel({ width: 15, height: 15 });
  let placed = 0;
  for (let y = 0; y < 15 && placed < 90; y += 1) {
    for (let x = 0; x < 15 && placed < 90; x += 1) {
      level = paintCell(level, x, y, 'cyan');
      placed += 1;
    }
  }
  level = addCharge(level, 0, { color: 'cyan', capacity: 90 });
  const r = validateStudioLevel(level);
  expect(r.errors).toEqual([]);
  expect(r.exportable).toBe(true);
});
