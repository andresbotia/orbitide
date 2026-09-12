import fs from 'fs';
import path from 'path';
import { createGame } from '@/game/engine/createGame';
import { resolveAction } from '@/game/engine/resolveLaunch';
import { solve } from '@/game/engine/solver';
import type { LevelDefinition } from '@/game/engine/types';
import { LEVEL_DEFINITIONS as LEGACY_LEVEL_DEFINITIONS } from '@/game/levels/levelDefinitions';
import { combineLevelDefinitions } from '@/game/levels/levels';
import { compileLevels } from '../compile';
import { parseAuthoredJSON } from '../loader';
import { validateLevelPacket, validateLevelStructure } from '../validate';

/**
 * Test fixture representing an externally authored level packet (JSON).
 * ID 101 is beyond the legacy 1-100 campaign range, simulating future authored batches.
 */
const FIXTURE_AUTHORED_JSON = JSON.stringify({
  worldId: 'world-11',
  worldTitle: 'Outer Expanse',
  themeId: 'starforge',
  levels: [
    {
      id: 101,
      title: 'Photon Gate',
      difficulty: 'easy',
      holding: 3,
      grid: [
        '.YYYYY.',
        'YY...YY',
        'Y..O..Y',
        'YY...YY',
        '.YYYYY.',
      ],
      tunnels: [
        [{ color: 'orange', capacity: 1 }, { color: 'yellow', capacity: 7 }],
        [{ color: 'yellow', capacity: 7 }],
        [{ color: 'yellow', capacity: 6 }],
      ],
    },
  ],
});

describe('Runtime Integration Proof — Authored JSON to Engine Replay', () => {
  let authoredLevel: LevelDefinition;

  it('Step 1: reads and parses the authored JSON source format', () => {
    const { levels, errors } = parseAuthoredJSON(FIXTURE_AUTHORED_JSON, 'fixture-101.json');
    expect(errors).toHaveLength(0);
    expect(levels).toHaveLength(1);

    authoredLevel = levels[0]!;
    expect(authoredLevel.id).toBe(101);
    expect(authoredLevel.title).toBe('Photon Gate');
    expect(authoredLevel.themeId).toBe('starforge');
    expect(authoredLevel.difficulty).toBe('easy');
    expect(authoredLevel.holdingCapacity).toBe(3);
    expect(authoredLevel.pixelArt).toHaveLength(5);
    expect(authoredLevel.tunnels).toHaveLength(3);
  });

  it('Step 2: passes fast structural validation without solver', () => {
    const structResult = validateLevelStructure(authoredLevel);
    expect(structResult.valid).toBe(true);
    expect(structResult.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
  });

  it('Step 3: compiles and normalizes into a strict runtime LevelDefinition bundle', () => {
    const tempDir = path.resolve(__dirname, 'temp_integration');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const fixturePath = path.join(tempDir, 'world-11.fixture.json');
    const compiledPath = path.join(tempDir, 'compiledFixture.ts');

    fs.writeFileSync(fixturePath, FIXTURE_AUTHORED_JSON, 'utf-8');

    const result = compileLevels({
      sourceFile: fixturePath,
      targetFile: compiledPath,
    });

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(fs.existsSync(compiledPath)).toBe(true);

    const content = fs.readFileSync(compiledPath, 'utf-8');
    expect(content).toContain('"id": 101');
    expect(content).toContain('"title": "Photon Gate"');
    expect(content).toContain('"themeId": "starforge"');

    // Clean up temporary files
    fs.unlinkSync(fixturePath);
    fs.unlinkSync(compiledPath);
    fs.rmdirSync(tempDir);
  });

  it('Step 4: integrates into production level loader and verifies collision protection', () => {
    // 4a. Proves new authored level merges into campaign level definitions
    const merged = combineLevelDefinitions(LEGACY_LEVEL_DEFINITIONS, [authoredLevel]);
    expect(merged.length).toBe(LEGACY_LEVEL_DEFINITIONS.length + 1);

    const retrieved = merged.find((l) => l.id === 101);
    expect(retrieved).toBeDefined();
    expect(retrieved?.title).toBe('Photon Gate');

    // 4b. Proves runtime rejects collisions with legacy level IDs
    const collidingLevel: LevelDefinition = {
      ...authoredLevel,
      id: 1, // ID 1 already exists in legacy levelDefinitions.ts
    };

    expect(() => {
      combineLevelDefinitions(LEGACY_LEVEL_DEFINITIONS, [collidingLevel]);
    }).toThrow(/Level ID collision detected/);

    // 4c. Proves compiler also rejects collisions with legacy level IDs
    const tempDir = path.resolve(__dirname, 'temp_collision');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const collidingJsonPath = path.join(tempDir, 'colliding.fixture.json');
    const collidingCompiledPath = path.join(tempDir, 'collidingOut.ts');

    fs.writeFileSync(
      collidingJsonPath,
      JSON.stringify({
        levels: [
          {
            id: 1, // Collides with legacy level 1
            title: 'Colliding Level 1',
            difficulty: 'easy',
            holding: 3,
            grid: ['W'],
            tunnels: [[{ color: 'white', capacity: 1 }], [], []],
          },
        ],
      }),
      'utf-8',
    );

    const compileResult = compileLevels({
      sourceFile: collidingJsonPath,
      targetFile: collidingCompiledPath,
    });

    expect(compileResult.success).toBe(false);
    expect(compileResult.errors.some((e) => e.includes('[ID_COLLISION]'))).toBe(true);

    fs.unlinkSync(collidingJsonPath);
    fs.rmdirSync(tempDir);
  });

  it('Step 5: initializes successfully through actual game engine createGame()', () => {
    const state = createGame(authoredLevel);
    expect(state.levelId).toBe(101);
    expect(state.status).toBe('playing');
    expect(state.holdingCapacity).toBe(3);
    expect(state.holding).toHaveLength(0);
    expect(state.pixels.length).toBe(21); // 20 yellow + 1 orange
    expect(state.tunnels).toHaveLength(3);
  });

  it('Step 6: executes and replays winning moves through runtime resolveAction() rules', () => {
    // Gameplay validation through authoring validator
    const valResult = validateLevelPacket(authoredLevel, { nodeCap: 10_000 });
    expect(valResult.valid).toBe(true);

    // Engine solver
    const solveRes = solve(authoredLevel, { mode: 'sequential-compat' });
    expect(solveRes.solved).toBe(true);
    expect(solveRes.moves.length).toBeGreaterThan(0);

    // Replay through the REAL production runtime resolveAction
    let state = createGame(authoredLevel);
    for (const move of solveRes.moves) {
      const outcome = resolveAction(state, move);
      expect(outcome.accepted).toBe(true);
      state = outcome.state;
    }

    expect(state.status).toBe('won');
    expect(state.pixels.every((p) => p.cleared)).toBe(true);
  });
});
