import path from 'path';
import fs from 'fs';
import { createGame } from '@/game/engine/createGame';
import { resolveAction } from '@/game/engine/resolveLaunch';
import { solve } from '@/game/engine/solver';
import type { LevelDefinition } from '@/game/engine/types';
import { analyzeAuthoredLevel } from '../analyze';
import { compileLevels } from '../compile';
import { loadAuthoredFile, parseAuthoredJSON } from '../loader';
import { validateLevelPacket, validateLevelStructure } from '../validate';

const VALID_SAMPLE_JSON = JSON.stringify({
  worldId: 'test-world',
  worldTitle: 'Test World',
  themeId: 'first-light',
  levels: [
    {
      id: 991,
      title: 'Simple Crescent',
      difficulty: 'easy',
      holding: 3,
      grid: [
        '.WW.',
        'W..W',
        'W...',
        '.WW.',
      ],
      tunnels: [
        [{ color: 'white', capacity: 3 }],
        [{ color: 'white', capacity: 2 }],
        [{ color: 'white', capacity: 2 }],
      ],
    },
  ],
});

describe('Level Authoring Pipeline — Stage A (Structural Validation & Compiler)', () => {
  it('parses valid authored JSON and normalizes to strict LevelDefinition', () => {
    const { levels, errors } = parseAuthoredJSON(VALID_SAMPLE_JSON, 'test.json');
    expect(errors).toHaveLength(0);
    expect(levels).toHaveLength(1);

    const lvl = levels[0]!;
    expect(lvl.id).toBe(991);
    expect(lvl.title).toBe('Simple Crescent');
    expect(lvl.themeId).toBe('first-light');
    expect(lvl.holdingCapacity).toBe(3);
    expect(lvl.pixelArt).toHaveLength(4);
    expect(lvl.tunnels).toHaveLength(3);
  });

  it('validates structural correctness without invoking the solver', () => {
    const { levels } = parseAuthoredJSON(VALID_SAMPLE_JSON);
    const result = validateLevelStructure(levels[0]!);
    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
  });

  it('rejects ragged rows with unequal lengths', () => {
    const badDef: LevelDefinition = {
      id: 992,
      title: 'Ragged',
      themeId: 'first-light',
      difficulty: 'easy',
      holdingCapacity: 3,
      pixelArt: [
        '..WW..',
        '..WWW...', // 8 chars vs 6
      ],
      tunnels: [[{ color: 'white', capacity: 5 }], [], []],
    };

    const res = validateLevelStructure(badDef);
    expect(res.valid).toBe(false);
    expect(res.diagnostics.some((d) => d.code === 'RAGGED_ROW')).toBe(true);
  });

  it('rejects unknown pixel characters not declared in the legend', () => {
    const badDef: LevelDefinition = {
      id: 993,
      title: 'Unknown Char',
      themeId: 'first-light',
      difficulty: 'easy',
      holdingCapacity: 3,
      pixelArt: [
        '..W..',
        '..Z..', // Z is not in default legend
      ],
      tunnels: [[{ color: 'white', capacity: 1 }], [], []],
    };

    const res = validateLevelStructure(badDef);
    expect(res.valid).toBe(false);
    expect(res.diagnostics.some((d) => d.code === 'UNKNOWN_PIXEL_CHAR')).toBe(true);
  });

  it('rejects tunnel count mismatch when not exactly 3 tunnels', () => {
    const badDef: LevelDefinition = {
      id: 994,
      title: 'Bad Tunnels',
      themeId: 'first-light',
      difficulty: 'easy',
      holdingCapacity: 3,
      pixelArt: ['WW'],
      tunnels: [
        [{ color: 'white', capacity: 2 }],
        [{ color: 'white', capacity: 0 }], // invalid 2 tunnels
      ],
    };

    const res = validateLevelStructure(badDef);
    expect(res.valid).toBe(false);
    expect(res.diagnostics.some((d) => d.code === 'TUNNEL_COUNT_MISMATCH')).toBe(true);
  });

  it('rejects charge budget underflow and overflow', () => {
    const underDef: LevelDefinition = {
      id: 995,
      title: 'Under Budget',
      themeId: 'first-light',
      difficulty: 'easy',
      holdingCapacity: 3,
      pixelArt: ['WWWW'],
      tunnels: [
        [{ color: 'white', capacity: 2 }],
        [],
        [],
      ],
    };
    const underRes = validateLevelStructure(underDef);
    expect(underRes.valid).toBe(false);
    expect(underRes.diagnostics.some((d) => d.code === 'BUDGET_UNDERFLOW')).toBe(true);

    const overDef: LevelDefinition = {
      id: 996,
      title: 'Over Budget',
      themeId: 'first-light',
      difficulty: 'easy',
      holdingCapacity: 3,
      pixelArt: ['WW'],
      tunnels: [
        [{ color: 'white', capacity: 10 }],
        [],
        [],
      ],
    };
    const overRes = validateLevelStructure(overDef);
    expect(overRes.valid).toBe(false);
    expect(overRes.diagnostics.some((d) => d.code === 'BUDGET_OVERFLOW')).toBe(true);
  });

  it('rejects unused color charges in tunnels', () => {
    const unusedDef: LevelDefinition = {
      id: 997,
      title: 'Unused Color',
      themeId: 'first-light',
      difficulty: 'easy',
      holdingCapacity: 3,
      pixelArt: ['WW'],
      tunnels: [
        [{ color: 'white', capacity: 2 }],
        [{ color: 'red', capacity: 5 }], // red is not on board
        [],
      ],
    };

    const res = validateLevelStructure(unusedDef);
    expect(res.valid).toBe(false);
    expect(res.diagnostics.some((d) => d.code === 'UNUSED_COLOR_CHARGE')).toBe(true);
  });

  it('compiles authored files quickly to a TypeScript bundle without solver', () => {
    const tempTarget = path.resolve(process.cwd(), 'src/game/levels/__tests__/tempCompiled.ts');
    const result = compileLevels({
      sourceFile: path.resolve(process.cwd(), 'content/levels/world-02.example.json'),
      targetFile: tempTarget,
      ignoreLegacyCollisions: true,
    });

    expect(result.success).toBe(true);
    expect(result.count).toBe(10);
    expect(fs.existsSync(tempTarget)).toBe(true);

    // Clean up temporary file
    fs.unlinkSync(tempTarget);
  });
});

describe('Level Authoring Pipeline — Stage B (Validation & Solver)', () => {
  it('validates solvability and verifies witness replay for a valid level', () => {
    const { levels } = parseAuthoredJSON(VALID_SAMPLE_JSON);
    const result = validateLevelPacket(levels[0]!, { nodeCap: 10_000 });
    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
  });

  it('detects impossible levels and flags LEVEL_UNSOLVABLE', () => {
    // A white perimeter enclosing purple and blue.
    // Charges arrive: purple, blue, white.
    // Purple enters holding (1/1 full). Blue arrives, blocked by white, cannot enter holding -> DEADLOCK.
    const deadlockedDef: LevelDefinition = {
      id: 998,
      title: 'Guaranteed Deadlock',
      themeId: 'first-light',
      difficulty: 'hard',
      holdingCapacity: 1,
      pixelArt: [
        'WWWW',
        'WPWW',
        'WBWW',
        'WWWW',
      ],
      tunnels: [
        [
          { color: 'purple', capacity: 1 },
          { color: 'blue', capacity: 1 },
          { color: 'white', capacity: 14 },
        ],
        [],
        [],
      ],
    };

    const result = validateLevelPacket(deadlockedDef, { nodeCap: 50_000 });
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'LEVEL_UNSOLVABLE')).toBe(true);
  });
});

describe('Level Authoring Pipeline — Stage C & D (Analysis & Single-Level Debug)', () => {
  it('analyzes a single level and computes difficulty and anti-spam metrics', async () => {
    const { levels } = parseAuthoredJSON(VALID_SAMPLE_JSON);
    const report = await analyzeAuthoredLevel(levels[0]!, { nodeCap: 10_000 });

    expect(report.id).toBe(991);
    expect(report.title).toBe('Simple Crescent');
    expect(report.solvable).toBe(true);
    expect(report.replaysSuccessfully).toBe(true);
    expect(report.antiSpam).toBeDefined();
    expect(report.antiSpam.status).toBeDefined();
    expect(report.difficultyScore).toBeGreaterThanOrEqual(0);
  });
});

describe('Runtime Engine Compatibility Proof', () => {
  it('proves authored level directly initializes game state and plays to completion', () => {
    const sampleFile = path.resolve(process.cwd(), 'content/levels/world-02.example.json');
    const { levels } = loadAuthoredFile(sampleFile);
    expect(levels.length).toBe(10);

    const level11 = levels[0]!;
    expect(level11.id).toBe(11);
    expect(level11.title).toBe('Ladybird');

    // Runtime state creation
    const state = createGame(level11);
    expect(state.status).toBe('playing');
    expect(state.pixels.length).toBe(37);
    expect(state.tunnels.length).toBe(3);

    // Runtime solve
    const solveRes = solve(level11, { mode: 'sequential-compat' });
    expect(solveRes.solved).toBe(true);
    expect(solveRes.moves.length).toBeGreaterThan(0);

    // Replay through actual engine resolveAction
    let curState = state;
    for (const move of solveRes.moves) {
      const outcome = resolveAction(curState, move);
      expect(outcome.accepted).toBe(true);
      curState = outcome.state;
    }
    expect(curState.status).toBe('won');
    expect(curState.pixels.every((p) => p.cleared)).toBe(true);
  });
});
