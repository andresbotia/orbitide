import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import { createGame } from '../../engine/createGame';
import { cellKey } from '../grid';
import { addCharge, createBlankLevel, paintCell } from '../model';
import { setModifier } from '../modifiers';
import { ensureReveal, addRevealNode } from '../reveal';
import { fromLevelDefinition, toLevelDefinition } from '../serialize';
import {
  copyArtwork, copyTunnelQueue, mirrorHorizontal, mirrorVertical, pasteArtwork,
  pasteTunnelQueue, renumber, replaceColor, rotate90, withId,
} from '../transforms';
import { validateStudioLevel } from '../validate';
import type { StudioLevel } from '../types';

function shape(): StudioLevel {
  let level = createBlankLevel({ width: 5, height: 5, title: 'Shape' });
  level = paintCell(level, 0, 0, 'white');
  level = paintCell(level, 1, 0, 'blue');
  level = paintCell(level, 4, 4, 'white');
  level = addCharge(level, 0, { color: 'white', capacity: 2 });
  level = addCharge(level, 1, { color: 'blue', capacity: 1 });
  level = setModifier(level, 0, 0, 'frozen');
  level = ensureReveal(level, 'S');
  level = addRevealNode(level, 0, 0);
  level = addRevealNode(level, 4, 4);
  level = addRevealNode(level, 1, 0);
  return level;
}

describe('mirror', () => {
  test('mirrorHorizontal remaps cells, modifiers and reveal nodes', () => {
    const { level, revealWarning } = mirrorHorizontal(shape());
    expect(revealWarning).toBeUndefined();
    expect(level.cells[cellKey(4, 0)]).toBe('white'); // (0,0) → (4,0)
    expect(level.cells[cellKey(3, 0)]).toBe('blue');  // (1,0) → (3,0)
    expect(level.cells[cellKey(0, 4)]).toBe('white'); // (4,4) → (0,4)
    expect(level.modifiers![cellKey(4, 0)]).toEqual({ kind: 'frozen', config: { layers: 1 } });
    expect(level.reveal!.nodes[0]).toEqual({ x: 4, y: 0 });
  });

  test('mirrorVertical is an involution', () => {
    const once = mirrorVertical(shape()).level;
    const twice = mirrorVertical(once).level;
    expect(twice.cells).toEqual(shape().cells);
    expect(twice.modifiers).toEqual(shape().modifiers);
  });
});

describe('rotate90', () => {
  test('square board rotates cells + modifiers + reveal', () => {
    const { level } = rotate90(shape());
    // (x,y) → (n-1-y, x); n=5 → (0,0)→(4,0)
    expect(level.cells[cellKey(4, 0)]).toBe('white');
    expect(level.modifiers![cellKey(4, 0)]).toBeTruthy();
    // four rotations return to start
    let r = shape();
    for (let i = 0; i < 4; i += 1) r = rotate90(r).level;
    expect(r.cells).toEqual(shape().cells);
  });

  test('non-square board is a no-op with a warning', () => {
    const level = createBlankLevel({ width: 4, height: 3 });
    const res = rotate90(level);
    expect(res.level).toBe(level);
    expect(res.revealWarning).toMatch(/square/);
  });
});

describe('replaceColor', () => {
  test('swaps board pixels and matching charges, keeps the level valid', () => {
    const next = replaceColor(shape(), 'blue', 'red');
    expect(next.cells[cellKey(1, 0)]).toBe('red');
    expect(next.tunnels[1]![0]!.color).toBe('red');
    expect(validateStudioLevel(next).exportable).toBe(true);
  });

  test('from === to is a no-op', () => {
    const s = shape();
    expect(replaceColor(s, 'white', 'white')).toBe(s);
  });
});

describe('artwork / queue clipboard', () => {
  test('copy then paste reproduces the artwork and grid', () => {
    const clip = copyArtwork(shape());
    let target = createBlankLevel({ width: 9, height: 9 });
    target = pasteArtwork(target, clip);
    expect(target.width).toBe(5);
    expect(target.cells).toEqual(shape().cells);
    expect(target.modifiers).toEqual(shape().modifiers);
  });

  test('tunnel queue copy/paste', () => {
    const q = copyTunnelQueue(shape(), 0);
    let target = createBlankLevel();
    target = pasteTunnelQueue(target, 2, q);
    expect(target.tunnels[2]).toEqual([{ color: 'white', capacity: 2 }]);
  });
});

describe('renumber', () => {
  test('sequential ids from a start', () => {
    const out = renumber([shape(), shape(), shape()], 20);
    expect(out.map((l) => l.id)).toEqual([20, 21, 22]);
    expect(withId(shape(), 99).id).toBe(99);
  });
});

test('mirror of a real campaign level stays engine-valid', () => {
  const level = fromLevelDefinition(LEVEL_DEFINITIONS[6]!); // Satellite, 7×7
  const flipped = mirrorHorizontal(level).level;
  expect(() => createGame(toLevelDefinition(flipped))).not.toThrow();
  expect(Object.keys(flipped.cells).length).toBe(Object.keys(level.cells).length);
});
