import { createGame } from '@/game/engine/createGame';
import { resolveAction } from '@/game/engine/resolveLaunch';
import { findFirstWinningWitness } from '@/game/engine/solver';
import type { LevelDefinition } from '@/game/engine/types';
import {
  MAX_BOARD_DIMENSION,
  MAX_BOARD_HEIGHT,
  MAX_BOARD_WIDTH,
  MIN_BOARD_DIMENSION,
  validateLevelPacket,
  validateLevelStructure,
} from '@/game/levels/authoring/validate';
import { LEVEL_DEFINITIONS, requireLevel } from '@/game/levels/levels';
import { computeBoardGeometry } from '@/game/rendering/boardGeometry';
import { GRID_RANGE, TUNED_GRID_SIZES } from '@/game/studio/grid';

// Helper to construct a synthetic level with uniform rows
function makeSyntheticLevel(
  id: number,
  title: string,
  cols: number,
  rows: number,
  customRows?: string[],
): LevelDefinition {
  if (customRows) {
    const totalW = customRows.reduce((acc, r) => acc + (r.match(/W/g) || []).length, 0);
    return {
      id,
      title,
      themeId: 'first-light',
      difficulty: 'easy',
      holdingCapacity: 3,
      pixelArt: customRows,
      tunnels: [
        [{ color: 'white', capacity: totalW }],
        [],
        [],
      ],
    };
  }

  // Generate a ring/perimeter with 4 exposed corner pixels
  const grid: string[] = [];
  for (let y = 0; y < rows; y++) {
    let row = '';
    for (let x = 0; x < cols; x++) {
      if ((x === 0 || x === cols - 1) && (y === 0 || y === rows - 1)) {
        row += 'W';
      } else {
        row += '.';
      }
    }
    grid.push(row);
  }

  return {
    id,
    title,
    themeId: 'first-light',
    difficulty: 'easy',
    holdingCapacity: 3,
    pixelArt: grid,
    tunnels: [
      [{ color: 'white', capacity: 2 }],
      [{ color: 'white', capacity: 2 }],
      [],
    ],
  };
}

describe('Variable Board Size — Validation & Authoring Limits', () => {
  it('exposes maximum dimensions of 20x20', () => {
    expect(MAX_BOARD_WIDTH).toBe(20);
    expect(MAX_BOARD_HEIGHT).toBe(20);
    expect(MAX_BOARD_DIMENSION).toBe(20);
    expect(MIN_BOARD_DIMENSION).toBe(1);
    expect(GRID_RANGE.max).toBe(20);
    expect(Math.max(...TUNED_GRID_SIZES)).toBe(20);
    expect(TUNED_GRID_SIZES.every((s) => s <= 20)).toBe(true);
  });

  it('validates and infers dimensions for an existing 15x15 level (Level 21)', () => {
    const lvl21 = requireLevel(21);
    expect(lvl21.pixelArt.length).toBe(15);
    expect(lvl21.pixelArt[0]!.length).toBe(15);

    const result = validateLevelStructure(lvl21);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(15);
    expect(result.height).toBe(15);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
  });

  it('validates and infers dimensions for a smaller rectangular level (12x8)', () => {
    const rectLvl = makeSyntheticLevel(9100, 'Small Rectangular', 12, 8);
    const result = validateLevelStructure(rectLvl);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(12);
    expect(result.height).toBe(8);
  });

  it('validates an 18x18 level', () => {
    const lvl18 = makeSyntheticLevel(9118, 'Synthetic 18x18', 18, 18);
    const result = validateLevelStructure(lvl18);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(18);
    expect(result.height).toBe(18);
  });

  it('validates a 20x20 level', () => {
    const lvl20 = makeSyntheticLevel(9120, 'Synthetic 20x20', 20, 20);
    const result = validateLevelStructure(lvl20);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(20);
    expect(result.height).toBe(20);
  });

  it('rejects a 21x20 level with GRID_WIDTH_OOB', () => {
    const lvl21x20 = makeSyntheticLevel(9121, 'Too Wide 21x20', 21, 20);
    const result = validateLevelStructure(lvl21x20);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'GRID_WIDTH_OOB')).toBe(true);
  });

  it('rejects a 20x21 level with GRID_HEIGHT_OOB', () => {
    const lvl20x21 = makeSyntheticLevel(9122, 'Too Tall 20x21', 20, 21);
    const result = validateLevelStructure(lvl20x21);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'GRID_HEIGHT_OOB')).toBe(true);
  });

  it('rejects inconsistent row widths with RAGGED_ROW', () => {
    const rows = [
      'WWWWWWWWWWWWWWWWWWWW', // 20 chars
      'WWWWWWWWWWWWWWWWWWW',  // 19 chars
      ...Array(18).fill('WWWWWWWWWWWWWWWWWWWW'),
    ];
    const ragged = makeSyntheticLevel(9123, 'Ragged Rows', 20, 20, rows);
    const result = validateLevelStructure(ragged);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'RAGGED_ROW')).toBe(true);
  });

  it('verifies existing Levels 1-40 all remain valid', () => {
    const campaignLevels = LEVEL_DEFINITIONS.filter((l) => l.id >= 1 && l.id <= 40);
    expect(campaignLevels).toHaveLength(40);

    for (const lvl of campaignLevels) {
      const result = validateLevelStructure(lvl);
      expect(result.valid).toBe(true);
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);

      const state = createGame(lvl);
      expect(state.width).toBe(lvl.pixelArt[0]!.length);
      expect(state.height).toBe(lvl.pixelArt.length);
      expect(state.pixels.length).toBeGreaterThan(0);
    }
  });
});

describe('Variable Board Size — Rendering & Geometry Calculations', () => {
  const SIZES = [180, 240, 320, 358, 430];

  it('maintains identical rendering geometry for existing 15x15 levels', () => {
    const size = 358;
    const geo15 = computeBoardGeometry(size, 15, 15);

    expect(geo15.cell).toBe(13);
    expect(geo15.gridWidth).toBe(195);
    expect(geo15.gridHeight).toBe(195);
    expect(geo15.gridOrigin.x).toBe(81.5);
    expect(geo15.gridOrigin.y).toBe(81.5);
    expect(geo15.density).toBe(15);
  });

  it('calculates square cells and preserves aspect ratio for rectangular boards', () => {
    for (const size of SIZES) {
      // 16 wide x 8 high (2:1 aspect ratio)
      const geoRect = computeBoardGeometry(size, 16, 8);
      // Square cells
      expect(geoRect.cell).toBeGreaterThan(0);
      expect(geoRect.gridWidth).toBe(geoRect.cell * 16);
      expect(geoRect.gridHeight).toBe(geoRect.cell * 8);
      expect(geoRect.gridWidth / geoRect.gridHeight).toBeCloseTo(2);

      // Centered on board
      expect(geoRect.gridOrigin.x).toBeCloseTo((size - geoRect.gridWidth) / 2);
      expect(geoRect.gridOrigin.y).toBeCloseTo((size - geoRect.gridHeight) / 2);
    }
  });

  it('keeps 20x20 board and all its pixels within orbit rail clearance across all screen sizes', () => {
    for (const size of SIZES) {
      const geo20 = computeBoardGeometry(size, 20, 20);

      // Outer rail fits in board viewport
      expect(geo20.orbitRadius + geo20.chargeRadius).toBeLessThan(size / 2);
      // Inner guide sits inside outer rail
      expect(geo20.innerGuideRadius).toBeLessThan(geo20.orbitRadius);

      // Every pixel corner must fit inside rail with clearance
      for (let x = 0; x < 20; x++) {
        for (let y = 0; y < 20; y++) {
          const cx = geo20.gridOrigin.x + x * geo20.cell + geo20.cell / 2;
          const cy = geo20.gridOrigin.y + y * geo20.cell + geo20.cell / 2;
          const reach = Math.hypot(cx - geo20.center.x, cy - geo20.center.y) + geo20.cell / Math.SQRT2;
          expect(reach).toBeLessThan(geo20.orbitRadius - geo20.chargeRadius);
        }
      }
    }
  });

  it('keeps 18x18 board and all its pixels within orbit rail clearance across all screen sizes', () => {
    for (const size of SIZES) {
      const geo18 = computeBoardGeometry(size, 18, 18);
      expect(geo18.orbitRadius + geo18.chargeRadius).toBeLessThan(size / 2);
      expect(geo18.innerGuideRadius).toBeLessThan(geo18.orbitRadius);

      for (let x = 0; x < 18; x++) {
        for (let y = 0; y < 18; y++) {
          const cx = geo18.gridOrigin.x + x * geo18.cell + geo18.cell / 2;
          const cy = geo18.gridOrigin.y + y * geo18.cell + geo18.cell / 2;
          const reach = Math.hypot(cx - geo18.center.x, cy - geo18.center.y) + geo18.cell / Math.SQRT2;
          expect(reach).toBeLessThan(geo18.orbitRadius - geo18.chargeRadius);
        }
      }
    }
  });
});

describe('Variable Board Size — Solver & Gameplay Compatibility', () => {
  it('confirms first-winning-witness solver solves an existing 15x15 level (Level 21)', () => {
    const lvl21 = requireLevel(21);
    const solveRes = findFirstWinningWitness(lvl21, { nodeCap: 50_000 });
    expect(solveRes.solved).toBe(true);
    expect(solveRes.moves.length).toBeGreaterThan(0);
  });

  it('confirms first-winning-witness solver solves a smaller rectangular level (12x8)', () => {
    const rectLvl = makeSyntheticLevel(9200, 'Solvable Rectangular', 12, 8);
    const packetRes = validateLevelPacket(rectLvl, { nodeCap: 10_000 });
    expect(packetRes.valid).toBe(true);

    const solveRes = findFirstWinningWitness(rectLvl, { nodeCap: 10_000 });
    expect(solveRes.solved).toBe(true);
    expect(solveRes.moves.length).toBeGreaterThan(0);

    // Replay through runtime resolveAction
    let state = createGame(rectLvl);
    for (const move of solveRes.moves) {
      const outcome = resolveAction(state, move);
      expect(outcome.accepted).toBe(true);
      state = outcome.state;
    }
    expect(state.status).toBe('won');
    expect(state.pixels.every((p) => p.cleared)).toBe(true);
  });

  it('confirms first-winning-witness solver solves an 18x18 level and replays to won', () => {
    const lvl18 = makeSyntheticLevel(9218, 'Solvable 18x18', 18, 18);
    const packetRes = validateLevelPacket(lvl18, { nodeCap: 10_000 });
    expect(packetRes.valid).toBe(true);

    const solveRes = findFirstWinningWitness(lvl18, { nodeCap: 10_000 });
    expect(solveRes.solved).toBe(true);
    expect(solveRes.moves.length).toBeGreaterThan(0);

    let state = createGame(lvl18);
    for (const move of solveRes.moves) {
      const outcome = resolveAction(state, move);
      expect(outcome.accepted).toBe(true);
      state = outcome.state;
    }
    expect(state.status).toBe('won');
    expect(state.pixels.every((p) => p.cleared)).toBe(true);
  });

  it('confirms first-winning-witness solver solves a 20x20 level and replays to won', () => {
    const lvl20 = makeSyntheticLevel(9220, 'Solvable 20x20', 20, 20);
    const packetRes = validateLevelPacket(lvl20, { nodeCap: 10_000 });
    expect(packetRes.valid).toBe(true);

    const solveRes = findFirstWinningWitness(lvl20, { nodeCap: 10_000 });
    expect(solveRes.solved).toBe(true);
    expect(solveRes.moves.length).toBeGreaterThan(0);

    let state = createGame(lvl20);
    for (const move of solveRes.moves) {
      const outcome = resolveAction(state, move);
      expect(outcome.accepted).toBe(true);
      state = outcome.state;
    }
    expect(state.status).toBe('won');
    expect(state.pixels.every((p) => p.cleared)).toBe(true);
  });
});
