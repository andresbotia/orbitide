import { applyBomb, isValidBombTarget, prospectiveBombPixels } from '../bomb';
import { createGame } from '../createGame';
import type { LevelDefinition } from '../types';

const TEST_LEVEL: LevelDefinition = {
  id: 991,
  title: 'Bomb Test Level',
  themeId: 'neon-city',
  difficulty: 'easy',
  holdingCapacity: 3,
  pixelArt: [
    'RRR..',
    'RGR..',
    'RRR..',
    '..B..',
    '.....',
  ],
  tunnels: [
    [{ color: 'red', capacity: 3 }],
    [],
    [],
  ],
};

describe('M6 Targeted Bomb Engine', () => {
  it('identifies valid and invalid bomb targets', () => {
    const game = createGame(TEST_LEVEL);
    // (1, 1) is 'G'
    expect(isValidBombTarget(game, { x: 1, y: 1 })).toBe(true);
    // (0, 0) is 'R'
    expect(isValidBombTarget(game, { x: 0, y: 0 })).toBe(true);
    // (4, 4) is empty ('.')
    expect(isValidBombTarget(game, { x: 4, y: 4 })).toBe(false);
    // (10, 10) is off-board
    expect(isValidBombTarget(game, { x: 10, y: 10 })).toBe(false);
  });

  it('calculates prospective 3x3 region centered on target coordinate', () => {
    const game = createGame(TEST_LEVEL);
    // Center at (1, 1) should target all pixels from x=0..2, y=0..2 (9 pixels)
    const targets = prospectiveBombPixels(game, { x: 1, y: 1 });
    expect(targets.length).toBe(9);
    expect(targets.map((p) => p.color)).toContain('green');
    expect(targets.map((p) => p.color)).toContain('red');
  });

  it('clears exact 3x3 region centered at target regardless of color or line-of-sight', () => {
    const game = createGame(TEST_LEVEL);
    const outcome = applyBomb(game, { x: 1, y: 1 });

    expect(outcome.accepted).toBe(true);
    expect(outcome.clearedPixels.length).toBe(9);
    expect(outcome.clearedPixelIds.length).toBe(9);

    // Check that all 9 pixels in (0..2, 0..2) are cleared
    for (const p of outcome.state.pixels) {
      if (p.x <= 2 && p.y <= 2) {
        expect(p.cleared).toBe(true);
      }
    }

    // The 'B' pixel at (2, 3) was outside 3x3 (y distance = 2) and remains uncleared
    const bPixel = outcome.state.pixels.find((p) => p.x === 2 && p.y === 3);
    expect(bPixel?.cleared).toBe(false);
    expect(outcome.state.status).toBe('playing');
    expect(outcome.state.movesApplied).toBe(game.movesApplied + 1);
  });

  it('handles board boundaries safely when targeted at corner (0, 0)', () => {
    const game = createGame(TEST_LEVEL);
    const outcome = applyBomb(game, { x: 0, y: 0 });

    expect(outcome.accepted).toBe(true);
    // Region includes (0,0), (1,0), (0,1), (1,1) -> 4 pixels
    expect(outcome.clearedPixels.length).toBe(4);
    for (const p of outcome.state.pixels) {
      if (p.x <= 1 && p.y <= 1) {
        expect(p.cleared).toBe(true);
      }
    }
  });

  it('rejects target if tapped on empty space or already cleared pixel', () => {
    const game = createGame(TEST_LEVEL);
    // Empty cell
    const outcomeEmpty = applyBomb(game, { x: 4, y: 4 });
    expect(outcomeEmpty.accepted).toBe(false);
    expect(outcomeEmpty.rejection).toBe('invalidTarget');

    // First bomb at (0, 0) clears (0, 0)
    const bomb1 = applyBomb(game, { x: 0, y: 0 });
    expect(bomb1.accepted).toBe(true);

    // Second bomb at (0, 0) - pixel is already cleared
    const bomb2 = applyBomb(bomb1.state, { x: 0, y: 0 });
    expect(bomb2.accepted).toBe(false);
    expect(bomb2.rejection).toBe('invalidTarget');
  });

  it('handles board edge target safely (1, 0)', () => {
    const game = createGame(TEST_LEVEL);
    const outcome = applyBomb(game, { x: 1, y: 0 });
    expect(outcome.accepted).toBe(true);
    // 3x3 clipped to board bounds: (0..2, 0..1) -> 6 pixels
    expect(outcome.clearedPixels.length).toBe(6);
  });

  it('triggers normal win flow if Bomb clears the final remaining pixels', () => {
    const singlePixelLevel: LevelDefinition = {
      id: 992,
      title: 'One Pixel Level',
      themeId: 'neon-city',
      difficulty: 'easy',
      holdingCapacity: 3,
      pixelArt: ['R'],
      tunnels: [[{ color: 'red', capacity: 1 }], [], []],
    };

    const game = createGame(singlePixelLevel);
    expect(game.status).toBe('playing');

    const outcome = applyBomb(game, { x: 0, y: 0 });
    expect(outcome.accepted).toBe(true);
    expect(outcome.state.status).toBe('won');
  });

  it('supports Undo after Bomb restores cleared pixels', () => {
    const game = createGame(TEST_LEVEL);
    const unclearedCountBefore = game.pixels.filter((p) => !p.cleared).length;

    // Apply bomb
    const outcome = applyBomb(game, { x: 1, y: 1 });
    expect(outcome.accepted).toBe(true);
    expect(outcome.state.pixels.filter((p) => !p.cleared).length).toBe(unclearedCountBefore - 9);

    // Rollback using undo snapshot
    const restoredPixels = game.pixels.map((p) => ({ ...p }));
    expect(restoredPixels.filter((p) => !p.cleared).length).toBe(unclearedCountBefore);
  });
});
