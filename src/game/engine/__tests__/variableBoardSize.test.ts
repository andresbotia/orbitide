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
import { computeBoardGeometry, cellCenter } from '@/game/rendering/boardGeometry';
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
  it('exposes maximum dimensions of 48x48 (M8E large boards)', () => {
    expect(MAX_BOARD_WIDTH).toBe(48);
    expect(MAX_BOARD_HEIGHT).toBe(48);
    expect(MAX_BOARD_DIMENSION).toBe(48);
    expect(MIN_BOARD_DIMENSION).toBe(1);
    expect(GRID_RANGE.max).toBe(MAX_BOARD_DIMENSION);
    expect(Math.max(...TUNED_GRID_SIZES)).toBe(40);
    expect(TUNED_GRID_SIZES.every((s) => s <= MAX_BOARD_DIMENSION)).toBe(true);
    for (const s of [28, 30, 32, 34, 36, 38, 40]) {
      expect((TUNED_GRID_SIZES as readonly number[]).includes(s)).toBe(true);
    }
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

  it('validates a 24x24 level (still works)', () => {
    const lvl24 = makeSyntheticLevel(9124, 'Synthetic 24x24', 24, 24);
    const result = validateLevelStructure(lvl24);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(24);
    expect(result.height).toBe(24);
  });

  it('validates a 25x25 level', () => {
    const lvl25 = makeSyntheticLevel(9125, 'Synthetic 25x25', 25, 25);
    const result = validateLevelStructure(lvl25);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(25);
    expect(result.height).toBe(25);
  });

  it('validates a 26x26 level', () => {
    const lvl26 = makeSyntheticLevel(9126, 'Synthetic 26x26', 26, 26);
    const result = validateLevelStructure(lvl26);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(26);
    expect(result.height).toBe(26);
  });

  it('validates a 27x27 level', () => {
    const lvl27 = makeSyntheticLevel(9127, 'Synthetic 27x27', 27, 27);
    const result = validateLevelStructure(lvl27);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(27);
    expect(result.height).toBe(27);
  });

  it('validates a 28x28 level', () => {
    const lvl28 = makeSyntheticLevel(9128, 'Synthetic 28x28', 28, 28);
    const result = validateLevelStructure(lvl28);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(28);
    expect(result.height).toBe(28);
  });

  it('validates a 28x22 rectangular level', () => {
    const lvl28x22 = makeSyntheticLevel(9129, 'Synthetic 28x22', 28, 22);
    const result = validateLevelStructure(lvl28x22);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(28);
    expect(result.height).toBe(22);
  });

  it('validates a 22x28 rectangular level', () => {
    const lvl22x28 = makeSyntheticLevel(9130, 'Synthetic 22x28', 22, 28);
    const result = validateLevelStructure(lvl22x28);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(22);
    expect(result.height).toBe(28);
  });

  it('rejects a 49x28 level with GRID_WIDTH_OOB', () => {
    const lvl49x28 = makeSyntheticLevel(9131, 'Too Wide 49x28', 49, 28);
    const result = validateLevelStructure(lvl49x28);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'GRID_WIDTH_OOB')).toBe(true);
  });

  it('rejects a 28x49 level with GRID_HEIGHT_OOB', () => {
    const lvl28x49 = makeSyntheticLevel(9132, 'Too Tall 28x49', 28, 49);
    const result = validateLevelStructure(lvl28x49);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'GRID_HEIGHT_OOB')).toBe(true);
  });

  it('rejects inconsistent row widths with RAGGED_ROW', () => {
    const rows = [
      'WWWWWWWWWWWWWWWWWWWWWWWWWWWW', // 28 chars
      'WWWWWWWWWWWWWWWWWWWWWWWWWWW',  // 27 chars
      ...Array(26).fill('WWWWWWWWWWWWWWWWWWWWWWWWWWWW'),
    ];
    const ragged = makeSyntheticLevel(9133, 'Ragged Rows', 28, 28, rows);
    const result = validateLevelStructure(ragged);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'RAGGED_ROW')).toBe(true);
  });

  it('verifies existing Levels 1-60 all remain structurally valid unchanged', () => {
    const campaignLevels = LEVEL_DEFINITIONS.filter((l) => l.id >= 1 && l.id <= 60);
    expect(campaignLevels).toHaveLength(60);

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

  it('calculates square cells and preserves aspect ratio for rectangular boards (including 28x22 and 22x28)', () => {
    for (const size of SIZES) {
      for (const [cols, rows] of [[28, 22], [22, 28]] as const) {
        const geoRect = computeBoardGeometry(size, cols, rows);
        // Square cells
        expect(geoRect.cell).toBeGreaterThan(0);
        expect(geoRect.gridWidth).toBe(geoRect.cell * cols);
        expect(geoRect.gridHeight).toBe(geoRect.cell * rows);
        expect(geoRect.gridWidth / geoRect.gridHeight).toBeCloseTo(cols / rows);

        // Centered on board
        expect(geoRect.gridOrigin.x).toBeCloseTo((size - geoRect.gridWidth) / 2);
        expect(geoRect.gridOrigin.y).toBeCloseTo((size - geoRect.gridHeight) / 2);
      }
    }
  });

  it('keeps 28x28 board and all its pixels within orbit rail clearance across all screen sizes', () => {
    for (const size of SIZES) {
      const geo28 = computeBoardGeometry(size, 28, 28);

      expect(geo28.orbitRadius + geo28.chargeRadius).toBeLessThan(size / 2);
      expect(geo28.innerGuideRadius).toBeLessThan(geo28.orbitRadius);
      expect(geo28.cell).toBeGreaterThanOrEqual(3);

      for (let x = 0; x < 28; x++) {
        for (let y = 0; y < 28; y++) {
          const cx = geo28.gridOrigin.x + x * geo28.cell + geo28.cell / 2;
          const cy = geo28.gridOrigin.y + y * geo28.cell + geo28.cell / 2;
          const reach = Math.hypot(cx - geo28.center.x, cy - geo28.center.y) + geo28.cell / Math.SQRT2;
          expect(reach).toBeLessThan(geo28.orbitRadius - geo28.chargeRadius);
        }
      }
    }
  });

  it('keeps 28x22 rectangular board and all its pixels within orbit rail clearance across all screen sizes', () => {
    for (const size of SIZES) {
      const geo28x22 = computeBoardGeometry(size, 28, 22);
      expect(geo28x22.orbitRadius + geo28x22.chargeRadius).toBeLessThan(size / 2);
      expect(geo28x22.innerGuideRadius).toBeLessThan(geo28x22.orbitRadius);

      for (let x = 0; x < 28; x++) {
        for (let y = 0; y < 22; y++) {
          const cx = geo28x22.gridOrigin.x + x * geo28x22.cell + geo28x22.cell / 2;
          const cy = geo28x22.gridOrigin.y + y * geo28x22.cell + geo28x22.cell / 2;
          const reach = Math.hypot(cx - geo28x22.center.x, cy - geo28x22.center.y) + geo28x22.cell / Math.SQRT2;
          expect(reach).toBeLessThan(geo28x22.orbitRadius - geo28x22.chargeRadius);
        }
      }
    }
  });

  it('keeps 22x28 rectangular board and all its pixels within orbit rail clearance across all screen sizes', () => {
    for (const size of SIZES) {
      const geo22x28 = computeBoardGeometry(size, 22, 28);
      expect(geo22x28.orbitRadius + geo22x28.chargeRadius).toBeLessThan(size / 2);
      expect(geo22x28.innerGuideRadius).toBeLessThan(geo22x28.orbitRadius);

      for (let x = 0; x < 22; x++) {
        for (let y = 0; y < 28; y++) {
          const cx = geo22x28.gridOrigin.x + x * geo22x28.cell + geo22x28.cell / 2;
          const cy = geo22x28.gridOrigin.y + y * geo22x28.cell + geo22x28.cell / 2;
          const reach = Math.hypot(cx - geo22x28.center.x, cy - geo22x28.center.y) + geo22x28.cell / Math.SQRT2;
          expect(reach).toBeLessThan(geo22x28.orbitRadius - geo22x28.chargeRadius);
        }
      }
    }
  });

  it('keeps cell targeting aligned with rendered cells across 28x28 and rectangular boards', () => {
    for (const [cols, rows] of [[28, 28], [28, 22], [22, 28]] as const) {
      const geo = computeBoardGeometry(358, cols, rows);
      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          const pt = cellCenter(geo, x, y);
          expect(pt.x).toBe(geo.gridOrigin.x + x * geo.cell + geo.cell / 2);
          expect(pt.y).toBe(geo.gridOrigin.y + y * geo.cell + geo.cell / 2);
          expect(pt.x).toBeGreaterThan(geo.artwork.x);
          expect(pt.x).toBeLessThan(geo.artwork.x + geo.artwork.width);
          expect(pt.y).toBeGreaterThan(geo.artwork.y);
          expect(pt.y).toBeLessThan(geo.artwork.y + geo.artwork.height);
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

  it('confirms first-winning-witness solver solves a 24x24 level and replays to won', () => {
    const lvl24 = makeSyntheticLevel(9224, 'Solvable 24x24', 24, 24);
    const packetRes = validateLevelPacket(lvl24, { nodeCap: 10_000 });
    expect(packetRes.valid).toBe(true);

    const solveRes = findFirstWinningWitness(lvl24, { nodeCap: 10_000 });
    expect(solveRes.solved).toBe(true);
    expect(solveRes.moves.length).toBeGreaterThan(0);

    let state = createGame(lvl24);
    for (const move of solveRes.moves) {
      const outcome = resolveAction(state, move);
      expect(outcome.accepted).toBe(true);
      state = outcome.state;
    }
    expect(state.status).toBe('won');
    expect(state.pixels.every((p) => p.cleared)).toBe(true);
  });

  it('confirms first-winning-witness solver solves a 25x25 level and replays to won', () => {
    const lvl25 = makeSyntheticLevel(9225, 'Solvable 25x25', 25, 25);
    const packetRes = validateLevelPacket(lvl25, { nodeCap: 10_000 });
    expect(packetRes.valid).toBe(true);

    const solveRes = findFirstWinningWitness(lvl25, { nodeCap: 10_000 });
    expect(solveRes.solved).toBe(true);
    expect(solveRes.moves.length).toBeGreaterThan(0);

    let state = createGame(lvl25);
    for (const move of solveRes.moves) {
      const outcome = resolveAction(state, move);
      expect(outcome.accepted).toBe(true);
      state = outcome.state;
    }
    expect(state.status).toBe('won');
    expect(state.pixels.every((p) => p.cleared)).toBe(true);
  });

  it('confirms first-winning-witness solver solves a 26x26 level and replays to won', () => {
    const lvl26 = makeSyntheticLevel(9226, 'Solvable 26x26', 26, 26);
    const packetRes = validateLevelPacket(lvl26, { nodeCap: 10_000 });
    expect(packetRes.valid).toBe(true);

    const solveRes = findFirstWinningWitness(lvl26, { nodeCap: 10_000 });
    expect(solveRes.solved).toBe(true);
    expect(solveRes.moves.length).toBeGreaterThan(0);

    let state = createGame(lvl26);
    for (const move of solveRes.moves) {
      const outcome = resolveAction(state, move);
      expect(outcome.accepted).toBe(true);
      state = outcome.state;
    }
    expect(state.status).toBe('won');
    expect(state.pixels.every((p) => p.cleared)).toBe(true);
  });

  it('confirms first-winning-witness solver solves a 27x27 level and replays to won', () => {
    const lvl27 = makeSyntheticLevel(9227, 'Solvable 27x27', 27, 27);
    const packetRes = validateLevelPacket(lvl27, { nodeCap: 10_000 });
    expect(packetRes.valid).toBe(true);

    const solveRes = findFirstWinningWitness(lvl27, { nodeCap: 10_000 });
    expect(solveRes.solved).toBe(true);
    expect(solveRes.moves.length).toBeGreaterThan(0);

    let state = createGame(lvl27);
    for (const move of solveRes.moves) {
      const outcome = resolveAction(state, move);
      expect(outcome.accepted).toBe(true);
      state = outcome.state;
    }
    expect(state.status).toBe('won');
    expect(state.pixels.every((p) => p.cleared)).toBe(true);
  });

  it('confirms first-winning-witness solver solves a 28x28 level and replays to won', () => {
    const lvl28 = makeSyntheticLevel(9228, 'Solvable 28x28', 28, 28);
    const packetRes = validateLevelPacket(lvl28, { nodeCap: 10_000 });
    expect(packetRes.valid).toBe(true);

    const solveRes = findFirstWinningWitness(lvl28, { nodeCap: 10_000 });
    expect(solveRes.solved).toBe(true);
    expect(solveRes.moves.length).toBeGreaterThan(0);

    let state = createGame(lvl28);
    for (const move of solveRes.moves) {
      const outcome = resolveAction(state, move);
      expect(outcome.accepted).toBe(true);
      state = outcome.state;
    }
    expect(state.status).toBe('won');
    expect(state.pixels.every((p) => p.cleared)).toBe(true);
  });

  it('confirms first-winning-witness solver solves a 28x22 rectangular level and replays to won', () => {
    const lvl28x22 = makeSyntheticLevel(9229, 'Solvable 28x22', 28, 22);
    const packetRes = validateLevelPacket(lvl28x22, { nodeCap: 10_000 });
    expect(packetRes.valid).toBe(true);

    const solveRes = findFirstWinningWitness(lvl28x22, { nodeCap: 10_000 });
    expect(solveRes.solved).toBe(true);
    expect(solveRes.moves.length).toBeGreaterThan(0);

    let state = createGame(lvl28x22);
    for (const move of solveRes.moves) {
      const outcome = resolveAction(state, move);
      expect(outcome.accepted).toBe(true);
      state = outcome.state;
    }
    expect(state.status).toBe('won');
    expect(state.pixels.every((p) => p.cleared)).toBe(true);
  });
});
