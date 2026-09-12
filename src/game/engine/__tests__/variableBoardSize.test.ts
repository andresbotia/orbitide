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
  it('exposes maximum dimensions of 24x24', () => {
    expect(MAX_BOARD_WIDTH).toBe(24);
    expect(MAX_BOARD_HEIGHT).toBe(24);
    expect(MAX_BOARD_DIMENSION).toBe(24);
    expect(MIN_BOARD_DIMENSION).toBe(1);
    expect(GRID_RANGE.max).toBe(24);
    expect(Math.max(...TUNED_GRID_SIZES)).toBe(24);
    expect(TUNED_GRID_SIZES.every((s) => s <= 24)).toBe(true);
    expect((TUNED_GRID_SIZES as readonly number[]).includes(24)).toBe(true);
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

  it('validates a 20x20 level (still works)', () => {
    const lvl20 = makeSyntheticLevel(9120, 'Synthetic 20x20', 20, 20);
    const result = validateLevelStructure(lvl20);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(20);
    expect(result.height).toBe(20);
  });

  it('validates a 21x21 level', () => {
    const lvl21 = makeSyntheticLevel(9121, 'Synthetic 21x21', 21, 21);
    const result = validateLevelStructure(lvl21);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(21);
    expect(result.height).toBe(21);
  });

  it('validates a 22x22 level', () => {
    const lvl22 = makeSyntheticLevel(9122, 'Synthetic 22x22', 22, 22);
    const result = validateLevelStructure(lvl22);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(22);
    expect(result.height).toBe(22);
  });

  it('validates a 23x23 level', () => {
    const lvl23 = makeSyntheticLevel(9123, 'Synthetic 23x23', 23, 23);
    const result = validateLevelStructure(lvl23);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(23);
    expect(result.height).toBe(23);
  });

  it('validates a 24x24 level', () => {
    const lvl24 = makeSyntheticLevel(9124, 'Synthetic 24x24', 24, 24);
    const result = validateLevelStructure(lvl24);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(24);
    expect(result.height).toBe(24);
  });

  it('validates a 24x18 rectangular level', () => {
    const lvl24x18 = makeSyntheticLevel(9125, 'Synthetic 24x18', 24, 18);
    const result = validateLevelStructure(lvl24x18);
    expect(result.valid).toBe(true);
    expect(result.width).toBe(24);
    expect(result.height).toBe(18);
  });

  it('rejects a 25x24 level with GRID_WIDTH_OOB', () => {
    const lvl25x24 = makeSyntheticLevel(9126, 'Too Wide 25x24', 25, 24);
    const result = validateLevelStructure(lvl25x24);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'GRID_WIDTH_OOB')).toBe(true);
  });

  it('rejects a 24x25 level with GRID_HEIGHT_OOB', () => {
    const lvl24x25 = makeSyntheticLevel(9127, 'Too Tall 24x25', 24, 25);
    const result = validateLevelStructure(lvl24x25);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'GRID_HEIGHT_OOB')).toBe(true);
  });

  it('rejects inconsistent row widths with RAGGED_ROW', () => {
    const rows = [
      'WWWWWWWWWWWWWWWWWWWWWWWW', // 24 chars
      'WWWWWWWWWWWWWWWWWWWWWWW',  // 23 chars
      ...Array(22).fill('WWWWWWWWWWWWWWWWWWWWWWWW'),
    ];
    const ragged = makeSyntheticLevel(9128, 'Ragged Rows', 24, 24, rows);
    const result = validateLevelStructure(ragged);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'RAGGED_ROW')).toBe(true);
  });

  it('verifies existing Levels 1-50 all remain structurally valid unchanged', () => {
    const campaignLevels = LEVEL_DEFINITIONS.filter((l) => l.id >= 1 && l.id <= 50);
    expect(campaignLevels).toHaveLength(50);

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

  it('calculates square cells and preserves aspect ratio for rectangular boards (including 24x18)', () => {
    for (const size of SIZES) {
      // 24 wide x 18 high (4:3 aspect ratio)
      const geoRect = computeBoardGeometry(size, 24, 18);
      // Square cells
      expect(geoRect.cell).toBeGreaterThan(0);
      expect(geoRect.gridWidth).toBe(geoRect.cell * 24);
      expect(geoRect.gridHeight).toBe(geoRect.cell * 18);
      expect(geoRect.gridWidth / geoRect.gridHeight).toBeCloseTo(24 / 18);

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

  it('keeps 24x24 board and all its pixels within orbit rail clearance across all screen sizes', () => {
    for (const size of SIZES) {
      const geo24 = computeBoardGeometry(size, 24, 24);

      expect(geo24.orbitRadius + geo24.chargeRadius).toBeLessThan(size / 2);
      expect(geo24.innerGuideRadius).toBeLessThan(geo24.orbitRadius);
      expect(geo24.cell).toBeGreaterThanOrEqual(4);

      for (let x = 0; x < 24; x++) {
        for (let y = 0; y < 24; y++) {
          const cx = geo24.gridOrigin.x + x * geo24.cell + geo24.cell / 2;
          const cy = geo24.gridOrigin.y + y * geo24.cell + geo24.cell / 2;
          const reach = Math.hypot(cx - geo24.center.x, cy - geo24.center.y) + geo24.cell / Math.SQRT2;
          expect(reach).toBeLessThan(geo24.orbitRadius - geo24.chargeRadius);
        }
      }
    }
  });

  it('keeps 24x18 rectangular board and all its pixels within orbit rail clearance across all screen sizes', () => {
    for (const size of SIZES) {
      const geo24x18 = computeBoardGeometry(size, 24, 18);
      expect(geo24x18.orbitRadius + geo24x18.chargeRadius).toBeLessThan(size / 2);
      expect(geo24x18.innerGuideRadius).toBeLessThan(geo24x18.orbitRadius);

      for (let x = 0; x < 24; x++) {
        for (let y = 0; y < 18; y++) {
          const cx = geo24x18.gridOrigin.x + x * geo24x18.cell + geo24x18.cell / 2;
          const cy = geo24x18.gridOrigin.y + y * geo24x18.cell + geo24x18.cell / 2;
          const reach = Math.hypot(cx - geo24x18.center.x, cy - geo24x18.center.y) + geo24x18.cell / Math.SQRT2;
          expect(reach).toBeLessThan(geo24x18.orbitRadius - geo24x18.chargeRadius);
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

    let state = createGame(rectLvl);
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

  it('confirms first-winning-witness solver solves a 21x21 level and replays to won', () => {
    const lvl21 = makeSyntheticLevel(9221, 'Solvable 21x21', 21, 21);
    const packetRes = validateLevelPacket(lvl21, { nodeCap: 10_000 });
    expect(packetRes.valid).toBe(true);

    const solveRes = findFirstWinningWitness(lvl21, { nodeCap: 10_000 });
    expect(solveRes.solved).toBe(true);
    expect(solveRes.moves.length).toBeGreaterThan(0);

    let state = createGame(lvl21);
    for (const move of solveRes.moves) {
      const outcome = resolveAction(state, move);
      expect(outcome.accepted).toBe(true);
      state = outcome.state;
    }
    expect(state.status).toBe('won');
    expect(state.pixels.every((p) => p.cleared)).toBe(true);
  });

  it('confirms first-winning-witness solver solves a 22x22 level and replays to won', () => {
    const lvl22 = makeSyntheticLevel(9222, 'Solvable 22x22', 22, 22);
    const packetRes = validateLevelPacket(lvl22, { nodeCap: 10_000 });
    expect(packetRes.valid).toBe(true);

    const solveRes = findFirstWinningWitness(lvl22, { nodeCap: 10_000 });
    expect(solveRes.solved).toBe(true);
    expect(solveRes.moves.length).toBeGreaterThan(0);

    let state = createGame(lvl22);
    for (const move of solveRes.moves) {
      const outcome = resolveAction(state, move);
      expect(outcome.accepted).toBe(true);
      state = outcome.state;
    }
    expect(state.status).toBe('won');
    expect(state.pixels.every((p) => p.cleared)).toBe(true);
  });

  it('confirms first-winning-witness solver solves a 23x23 level and replays to won', () => {
    const lvl23 = makeSyntheticLevel(9223, 'Solvable 23x23', 23, 23);
    const packetRes = validateLevelPacket(lvl23, { nodeCap: 10_000 });
    expect(packetRes.valid).toBe(true);

    const solveRes = findFirstWinningWitness(lvl23, { nodeCap: 10_000 });
    expect(solveRes.solved).toBe(true);
    expect(solveRes.moves.length).toBeGreaterThan(0);

    let state = createGame(lvl23);
    for (const move of solveRes.moves) {
      const outcome = resolveAction(state, move);
      expect(outcome.accepted).toBe(true);
      state = outcome.state;
    }
    expect(state.status).toBe('won');
    expect(state.pixels.every((p) => p.cleared)).toBe(true);
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

  it('confirms first-winning-witness solver solves a 24x18 rectangular level and replays to won', () => {
    const lvl24x18 = makeSyntheticLevel(9225, 'Solvable 24x18', 24, 18);
    const packetRes = validateLevelPacket(lvl24x18, { nodeCap: 10_000 });
    expect(packetRes.valid).toBe(true);

    const solveRes = findFirstWinningWitness(lvl24x18, { nodeCap: 10_000 });
    expect(solveRes.solved).toBe(true);
    expect(solveRes.moves.length).toBeGreaterThan(0);

    let state = createGame(lvl24x18);
    for (const move of solveRes.moves) {
      const outcome = resolveAction(state, move);
      expect(outcome.accepted).toBe(true);
      state = outcome.state;
    }
    expect(state.status).toBe('won');
    expect(state.pixels.every((p) => p.cleared)).toBe(true);
  });
});
