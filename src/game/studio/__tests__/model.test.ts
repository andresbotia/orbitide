import {
  addCharge, canRedo, canUndo, clearCanvas, commit, createBlankLevel,
  duplicateCharge, eraseCell, initHistory, loadCampaignLevel, moveCharge,
  paintCell, redo, removeCharge, setGridSize, setMeta, undo, updateCharge,
} from '../model';
import { cellKey } from '../grid';
import type { StudioLevel } from '../types';

describe('blank level + loading', () => {
  test('a blank level has an empty board, three empty tunnels and the next free id', () => {
    const level = createBlankLevel();
    expect(Object.keys(level.cells)).toHaveLength(0);
    expect(level.tunnels).toEqual([[], [], []]);
    expect(level.holdingCapacity).toBe(3);
    expect(level.id).toBe(11); // campaign has 1..10
  });

  test('an existing campaign level loads into an editable document', () => {
    const level = loadCampaignLevel(1);
    expect(level.id).toBe(1);
    expect(level.title).toBe('Moon');
    expect(level.width).toBe(7);
    expect(level.height).toBe(7);
    expect(Object.keys(level.cells).length).toBeGreaterThan(0);
    expect(level.reveal?.name).toBe('THE CRESCENT');
  });
});

describe('pixel canvas', () => {
  const base = createBlankLevel({ width: 5, height: 5 });

  test('paint / erase / clear are pure and coordinate-checked', () => {
    const painted = paintCell(base, 2, 3, 'blue');
    expect(painted).not.toBe(base);
    expect(painted.cells[cellKey(2, 3)]).toBe('blue');
    expect(base.cells[cellKey(2, 3)]).toBeUndefined(); // input untouched

    expect(paintCell(painted, 2, 3, 'blue')).toBe(painted); // no-op keeps identity
    expect(paintCell(base, 9, 9, 'blue')).toBe(base);       // out of bounds ignored

    const erased = eraseCell(painted, 2, 3);
    expect(erased.cells[cellKey(2, 3)]).toBeUndefined();
    expect(eraseCell(base, 0, 0)).toBe(base); // nothing to erase

    const filled = paintCell(paintCell(base, 0, 0, 'red'), 1, 1, 'red');
    expect(Object.keys(clearCanvas(filled).cells)).toHaveLength(0);
  });

  test('resizing the grid drops out-of-range pixels', () => {
    let level = paintCell(base, 4, 4, 'green');
    level = paintCell(level, 1, 1, 'green');
    const smaller = setGridSize(level, 3, 3);
    expect(smaller.width).toBe(3);
    expect(smaller.cells[cellKey(4, 4)]).toBeUndefined();
    expect(smaller.cells[cellKey(1, 1)]).toBe('green');
  });
});

describe('tunnel queue editing', () => {
  let level: StudioLevel;
  beforeEach(() => { level = createBlankLevel(); });

  test('add / update / remove / duplicate', () => {
    level = addCharge(level, 0, { color: 'blue', capacity: 5 });
    level = addCharge(level, 0, { color: 'white', capacity: 3 });
    expect(level.tunnels[0]).toEqual([
      { color: 'blue', capacity: 5 },
      { color: 'white', capacity: 3 },
    ]);

    level = updateCharge(level, 0, 1, { capacity: 8 });
    expect(level.tunnels[0]![1]!.capacity).toBe(8);

    level = duplicateCharge(level, 0, 0);
    expect(level.tunnels[0]).toHaveLength(3);
    expect(level.tunnels[0]![1]).toEqual({ color: 'blue', capacity: 5 });

    level = removeCharge(level, 0, 0);
    expect(level.tunnels[0]).toHaveLength(2);
  });

  test('reordering is bounds-checked and deterministic', () => {
    level = addCharge(level, 1, { color: 'blue', capacity: 1 });
    level = addCharge(level, 1, { color: 'red', capacity: 2 });
    level = moveCharge(level, 1, 1, -1);
    expect(level.tunnels[1]!.map((c) => c.color)).toEqual(['red', 'blue']);
    expect(moveCharge(level, 1, 0, -1)).toBe(level); // can't move past the front
    expect(moveCharge(level, 1, 1, 1)).toBe(level);  // can't move past the back
  });

  test('metadata edits are shallow merges', () => {
    const next = setMeta(level, { title: 'Comet', difficulty: 'hard' });
    expect(next.title).toBe('Comet');
    expect(next.difficulty).toBe('hard');
    expect(next.id).toBe(level.id);
  });
});

describe('undo / redo history', () => {
  test('commit clears redo; undo and redo walk the stack', () => {
    let h = initHistory(createBlankLevel({ width: 4, height: 4 }));
    h = commit(h, paintCell(h.present, 0, 0, 'blue'));
    h = commit(h, paintCell(h.present, 1, 1, 'red'));
    expect(canUndo(h)).toBe(true);
    expect(canRedo(h)).toBe(false);

    h = undo(h);
    expect(h.present.cells[cellKey(1, 1)]).toBeUndefined();
    expect(h.present.cells[cellKey(0, 0)]).toBe('blue');
    expect(canRedo(h)).toBe(true);

    h = redo(h);
    expect(h.present.cells[cellKey(1, 1)]).toBe('red');

    // a fresh commit after undo drops the redo branch
    h = undo(h);
    h = commit(h, paintCell(h.present, 2, 2, 'green'));
    expect(canRedo(h)).toBe(false);
    expect(h.present.cells[cellKey(2, 2)]).toBe('green');
  });

  test('committing an unchanged present is a no-op', () => {
    const h = initHistory(createBlankLevel());
    expect(commit(h, h.present)).toBe(h);
  });
});
