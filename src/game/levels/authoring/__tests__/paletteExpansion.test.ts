import fs from 'fs';
import path from 'path';
import { createGame } from '@/game/engine/createGame';
import { resolveAction } from '@/game/engine/resolveLaunch';
import { solve } from '@/game/engine/solver';
import type { LevelDefinition } from '@/game/engine/types';
import { LEVEL_DEFINITIONS } from '@/game/levels/levels';
import { compileLevels } from '../compile';
import { normalizeAuthoredLevel } from '../normalize';
import { parseAuthoredJSON } from '../loader';
import { validateLevelStructure } from '../validate';
import { orbColors, orbGlow, orbLabel, palette } from '@/theme/colors';
import { colorMark, markContrast, GAMEPLAY_COLORS, luminance } from '@/theme/colorAssist';
import { COLOR_TO_CHAR, isDefaultLegendColor } from '@/game/studio/grid';
import { DEFAULT_ART_LEGEND } from '@/game/engine/art';

describe('Gameplay Color Palette Expansion — Blue & Purple', () => {
  // ── 1 & 2. Authored Pixels Accepted ──────────────────────────────────────
  describe('Authored Pixel Acceptance', () => {
    it('accepts blue authored pixels using standard symbol B (with and without explicit legend)', () => {
      // Without explicit legend (relies on DEFAULT_ART_LEGEND B -> blue)
      const defImplicit: LevelDefinition = {
        id: 901,
        title: 'Blue Implicit',
        themeId: 'cosmic-frontier',
        difficulty: 'medium',
        holdingCapacity: 3,
        pixelArt: [
          '..BB..',
          '.BBBB.',
          '..BB..',
        ],
        tunnels: [
          [{ color: 'blue', capacity: 8 }],
          [],
          [],
        ],
      };
      const resImplicit = validateLevelStructure(defImplicit);
      expect(resImplicit.valid).toBe(true);
      expect(resImplicit.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);

      const gameImplicit = createGame(defImplicit);
      expect(gameImplicit.pixels.every((p) => p.color === 'blue')).toBe(true);
      expect(gameImplicit.pixels).toHaveLength(8);

      // With explicit legend entry
      const defExplicit: LevelDefinition = {
        ...defImplicit,
        id: 902,
        title: 'Blue Explicit',
        legend: { B: 'blue' },
      };
      const resExplicit = validateLevelStructure(defExplicit);
      expect(resExplicit.valid).toBe(true);
      expect(resExplicit.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    });

    it('accepts purple authored pixels using standard symbol P (with and without explicit legend)', () => {
      // Without explicit legend (relies on DEFAULT_ART_LEGEND P -> purple)
      const defImplicit: LevelDefinition = {
        id: 903,
        title: 'Purple Implicit',
        themeId: 'cosmic-frontier',
        difficulty: 'medium',
        holdingCapacity: 3,
        pixelArt: [
          '..PP..',
          '.PPPP.',
          '..PP..',
        ],
        tunnels: [
          [{ color: 'purple', capacity: 8 }],
          [],
          [],
        ],
      };
      const resImplicit = validateLevelStructure(defImplicit);
      expect(resImplicit.valid).toBe(true);
      expect(resImplicit.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);

      const gameImplicit = createGame(defImplicit);
      expect(gameImplicit.pixels.every((p) => p.color === 'purple')).toBe(true);
      expect(gameImplicit.pixels).toHaveLength(8);

      // With explicit legend entry
      const defExplicit: LevelDefinition = {
        ...defImplicit,
        id: 904,
        title: 'Purple Explicit',
        legend: { P: 'purple' },
      };
      const resExplicit = validateLevelStructure(defExplicit);
      expect(resExplicit.valid).toBe(true);
      expect(resExplicit.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    });

    it('accepts combined blue and purple pixels alongside existing World 4 colors (A, O, T, D, G, L)', () => {
      const defAll8: LevelDefinition = {
        id: 905,
        title: 'Cosmic Frontier 8-Color Showcase',
        themeId: 'cosmic-frontier',
        difficulty: 'hard',
        holdingCapacity: 3,
        legend: { A: 'gold', O: 'orange', T: 'teal', D: 'coral', G: 'green', L: 'lime', B: 'blue', P: 'purple' },
        pixelArt: [
          'AOTDGLBP',
          'PBLGDOAT',
        ],
        tunnels: [
          [
            { color: 'gold', capacity: 2 },
            { color: 'orange', capacity: 2 },
            { color: 'teal', capacity: 2 },
            { color: 'coral', capacity: 2 },
          ],
          [
            { color: 'green', capacity: 2 },
            { color: 'lime', capacity: 2 },
          ],
          [
            { color: 'blue', capacity: 2 },
            { color: 'purple', capacity: 2 },
          ],
        ],
      };
      const res = validateLevelStructure(defAll8);
      expect(res.valid).toBe(true);
      expect(res.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);

      const game = createGame(defAll8);
      expect(game.pixels).toHaveLength(16);
      expect(game.pixels.filter((p) => p.color === 'blue')).toHaveLength(2);
      expect(game.pixels.filter((p) => p.color === 'purple')).toHaveLength(2);
    });
  });

  // ── 3 & 4. Tunnel Capacity Auditing ──────────────────────────────────────
  describe('Tunnel Capacity Auditing for Blue & Purple', () => {
    it('validates blue tunnel capacities strictly against blue artwork count', () => {
      const baseLevel: LevelDefinition = {
        id: 910,
        title: 'Blue Budget Test',
        themeId: 'cosmic-frontier',
        difficulty: 'medium',
        holdingCapacity: 3,
        pixelArt: [
          '.BBB.',
          'BBBBB',
          '.BBB.',
        ], // 11 blue pixels
        tunnels: [
          [{ color: 'blue', capacity: 11 }],
          [],
          [],
        ],
      };

      // Exact match passes
      expect(validateLevelStructure(baseLevel).valid).toBe(true);

      // Under-budget fails
      const underDef: LevelDefinition = {
        ...baseLevel,
        tunnels: [[{ color: 'blue' as const, capacity: 9 }], [], []],
      };
      const underRes = validateLevelStructure(underDef);
      expect(underRes.valid).toBe(false);
      expect(underRes.diagnostics.some((d) => d.code === 'BUDGET_UNDERFLOW')).toBe(true);

      // Over-budget fails
      const overDef: LevelDefinition = {
        ...baseLevel,
        tunnels: [[{ color: 'blue' as const, capacity: 13 }], [], []],
      };
      const overRes = validateLevelStructure(overDef);
      expect(overRes.valid).toBe(false);
      expect(overRes.diagnostics.some((d) => d.code === 'BUDGET_OVERFLOW')).toBe(true);

      // Missing color charge fails
      const missingDef: LevelDefinition = {
        ...baseLevel,
        tunnels: [[{ color: 'white' as const, capacity: 11 }], [], []],
      };
      const missingRes = validateLevelStructure(missingDef);
      expect(missingRes.valid).toBe(false);
      expect(missingRes.diagnostics.some((d) => d.code === 'MISSING_COLOR_CHARGE')).toBe(true);

      // Unused color charge fails
      const unusedDef: LevelDefinition = {
        id: 911,
        title: 'Unused Blue Charge',
        themeId: 'cosmic-frontier',
        difficulty: 'easy',
        holdingCapacity: 3,
        pixelArt: ['.WW.'],
        tunnels: [
          [{ color: 'white', capacity: 2 }],
          [{ color: 'blue', capacity: 5 }],
          [],
        ],
      };
      const unusedRes = validateLevelStructure(unusedDef);
      expect(unusedRes.valid).toBe(false);
      expect(unusedRes.diagnostics.some((d) => d.code === 'UNUSED_COLOR_CHARGE')).toBe(true);
    });

    it('validates purple tunnel capacities strictly against purple artwork count', () => {
      const baseLevel: LevelDefinition = {
        id: 912,
        title: 'Purple Budget Test',
        themeId: 'cosmic-frontier',
        difficulty: 'medium',
        holdingCapacity: 3,
        pixelArt: [
          '.PPP.',
          'PPPPP',
          '.PPP.',
        ], // 11 purple pixels
        tunnels: [
          [{ color: 'purple', capacity: 11 }],
          [],
          [],
        ],
      };

      // Exact match passes
      expect(validateLevelStructure(baseLevel).valid).toBe(true);

      // Under-budget fails
      const underDef: LevelDefinition = {
        ...baseLevel,
        tunnels: [[{ color: 'purple' as const, capacity: 10 }], [], []],
      };
      const underRes = validateLevelStructure(underDef);
      expect(underRes.valid).toBe(false);
      expect(underRes.diagnostics.some((d) => d.code === 'BUDGET_UNDERFLOW')).toBe(true);

      // Over-budget fails
      const overDef: LevelDefinition = {
        ...baseLevel,
        tunnels: [[{ color: 'purple' as const, capacity: 12 }], [], []],
      };
      const overRes = validateLevelStructure(overDef);
      expect(overRes.valid).toBe(false);
      expect(overRes.diagnostics.some((d) => d.code === 'BUDGET_OVERFLOW')).toBe(true);

      // Missing color charge fails
      const missingDef: LevelDefinition = {
        ...baseLevel,
        tunnels: [[{ color: 'white' as const, capacity: 11 }], [], []],
      };
      const missingRes = validateLevelStructure(missingDef);
      expect(missingRes.valid).toBe(false);
      expect(missingRes.diagnostics.some((d) => d.code === 'MISSING_COLOR_CHARGE')).toBe(true);

      // Unused color charge fails
      const unusedDef: LevelDefinition = {
        id: 913,
        title: 'Unused Purple Charge',
        themeId: 'cosmic-frontier',
        difficulty: 'easy',
        holdingCapacity: 3,
        pixelArt: ['.WW.'],
        tunnels: [
          [{ color: 'white', capacity: 2 }],
          [{ color: 'purple', capacity: 5 }],
          [],
        ],
      };
      const unusedRes = validateLevelStructure(unusedDef);
      expect(unusedRes.valid).toBe(false);
      expect(unusedRes.diagnostics.some((d) => d.code === 'UNUSED_COLOR_CHARGE')).toBe(true);
    });
  });

  // ── 5. Normalization & Compilation ───────────────────────────────────────
  describe('Normalization and Compiler Pipeline', () => {
    it('normalizes authored JSON containing blue and purple', () => {
      const rawJSON = JSON.stringify({
        worldId: 'world-05',
        worldTitle: 'Cosmic Frontier',
        themeId: 'cosmic-frontier',
        levels: [
          {
            id: 920,
            title: 'Orbital Beacon Test',
            difficulty: 'medium',
            holding: 3,
            legend: { B: 'blue', P: 'purple', A: 'gold' },
            grid: [
              '.BBP..',
              'BAAB..',
              '.PPB..',
            ],
            tunnels: [
              [{ color: 'blue', capacity: 5 }],
              [{ color: 'purple', capacity: 3 }],
              [{ color: 'gold', capacity: 2 }],
            ],
          },
        ],
      });

      const { levels, errors } = parseAuthoredJSON(rawJSON, 'test-w5.json');
      expect(errors).toHaveLength(0);
      expect(levels).toHaveLength(1);

      const lvl = levels[0]!;
      expect(lvl.id).toBe(920);
      expect(lvl.themeId).toBe('cosmic-frontier');
      expect(lvl.holdingCapacity).toBe(3);
      expect(lvl.pixelArt).toEqual(['.BBP..', 'BAAB..', '.PPB..']);
      expect(lvl.tunnels[0]![0]!.color).toBe('blue');
      expect(lvl.tunnels[1]![0]!.color).toBe('purple');
      expect(lvl.tunnels[2]![0]!.color).toBe('gold');

      const validation = validateLevelStructure(lvl);
      expect(validation.valid).toBe(true);

      // Direct normalization test
      const directNormalized = normalizeAuthoredLevel({
        id: 922,
        title: 'Direct Normalize BP',
        difficulty: 'medium',
        holding: 3,
        grid: ['B', 'P'],
        tunnels: [[{ color: 'blue', capacity: 1 }], [{ color: 'purple', capacity: 1 }], []],
      });
      expect(directNormalized.pixelArt).toEqual(['B', 'P']);
      expect(directNormalized.tunnels[0]![0]!.color).toBe('blue');
      expect(directNormalized.tunnels[1]![0]!.color).toBe('purple');
    });

    it('compiles authored blue and purple levels into TypeScript bundle preserving color typing', () => {
      const tempJson = path.resolve(process.cwd(), 'src/game/levels/__tests__/tempBluePurple.json');
      const tempTarget = path.resolve(process.cwd(), 'src/game/levels/__tests__/tempCompiledBluePurple.ts');

      const testPacket = {
        worldId: 'world-test-bp',
        worldTitle: 'Test Blue Purple',
        themeId: 'cosmic-frontier',
        replacesLegacy: false,
        levels: [
          {
            id: 921,
            title: 'Compiled Blue Purple Level',
            difficulty: 'medium',
            holding: 3,
            grid: [
              'BP',
              'PB',
            ],
            tunnels: [
              [{ color: 'blue', capacity: 2 }],
              [{ color: 'purple', capacity: 2 }],
              [],
            ],
          },
        ],
      };

      fs.writeFileSync(tempJson, JSON.stringify(testPacket, null, 2), 'utf-8');

      try {
        const compileRes = compileLevels({
          sourceFile: tempJson,
          targetFile: tempTarget,
          ignoreLegacyCollisions: true,
        });

        expect(compileRes.success).toBe(true);
        expect(compileRes.count).toBe(1);
        expect(fs.existsSync(tempTarget)).toBe(true);

        const compiledCode = fs.readFileSync(tempTarget, 'utf-8');
        expect(compiledCode).toContain('"color": "blue"');
        expect(compiledCode).toContain('"color": "purple"');
        expect(compiledCode).toContain('"BP"');
        expect(compiledCode).toContain('"PB"');
      } finally {
        if (fs.existsSync(tempJson)) fs.unlinkSync(tempJson);
        if (fs.existsSync(tempTarget)) fs.unlinkSync(tempTarget);
      }
    });
  });

  // ── 6. Renderer & Color Helpers Support ──────────────────────────────────
  describe('Renderer & Color Helpers', () => {
    it('provides distinct, luminous color tokens for blue and purple in theme/colors.ts', () => {
      expect(orbColors.blue).toBe('#3E7BFF');
      expect(orbColors.purple).toBe('#B07CFF');

      expect(orbGlow.blue).toBe('#8FB4FF');
      expect(orbGlow.purple).toBe('#D6BEFF');

      expect(orbLabel.blue).toBe('BLUE');
      expect(orbLabel.purple).toBe('PURPLE');

      // Clearly distinguishable from each other
      expect(orbColors.blue).not.toBe(orbColors.purple);

      // Clearly distinguishable from teal (#2FD3B4) and coral (#FF6F7D)
      expect(orbColors.blue).not.toBe(orbColors.teal);
      expect(orbColors.blue).not.toBe(orbColors.coral);
      expect(orbColors.purple).not.toBe(orbColors.teal);
      expect(orbColors.purple).not.toBe(orbColors.coral);

      expect(GAMEPLAY_COLORS).toContain('blue');
      expect(GAMEPLAY_COLORS).toContain('purple');

      // High luminance contrast against void background (#05060A)
      const voidLum = luminance(palette.void);
      const blueLum = luminance(orbColors.blue);
      const purpleLum = luminance(orbColors.purple);

      expect(voidLum).toBeLessThan(0.01);
      expect(blueLum).toBeGreaterThan(0.2);
      expect(purpleLum).toBeGreaterThan(0.3);
    });

    it('provides machine-language Color Assist marks and contrast strategies for both', () => {
      const blueMark = colorMark('blue');
      expect(blueMark.name).toBe('diamond');
      expect(blueMark.parts.length).toBeGreaterThanOrEqual(1);

      const purpleMark = colorMark('purple');
      expect(purpleMark.name).toBe('triangle-up');
      expect(purpleMark.parts.length).toBeGreaterThanOrEqual(1);

      // Contrast strategies resolve with non-empty fills
      const blueContrast = markContrast('blue');
      expect(blueContrast.strategy).toBeDefined();
      expect(blueContrast.fill.startsWith('#')).toBe(true);

      const purpleContrast = markContrast('purple');
      expect(purpleContrast.strategy).toBeDefined();
      expect(purpleContrast.fill.startsWith('#')).toBe(true);
    });

    it('maps symbols B -> blue and P -> purple canonically in grid helpers and default legend', () => {
      expect(DEFAULT_ART_LEGEND.B).toBe('blue');
      expect(DEFAULT_ART_LEGEND.P).toBe('purple');

      expect(COLOR_TO_CHAR.blue).toBe('B');
      expect(COLOR_TO_CHAR.purple).toBe('P');

      expect(isDefaultLegendColor('blue')).toBe(true);
      expect(isDefaultLegendColor('purple')).toBe(true);
    });
  });

  // ── 7. Solver Clears Synthetic Blue/Purple Level ──────────────────────────
  describe('Engine Solver Integration', () => {
    it('solves and plays a synthetic level using blue and purple to full completion', () => {
      // 5x5 board with a blue cross and purple corners
      // Holding capacity 3
      // Queue sequencing requires parking charges in holding and clearing
      const syntheticLevel: LevelDefinition = {
        id: 930,
        title: 'Cosmic Convergence',
        themeId: 'cosmic-frontier',
        difficulty: 'medium',
        holdingCapacity: 3,
        pixelArt: [
          'P...P',
          '.BBB.',
          '.BBB.',
          '.BBB.',
          'P...P',
        ], // 4 purple pixels (corners), 9 blue pixels (3x3 center)
        tunnels: [
          // T1: purple 4 (clear corners first)
          [{ color: 'purple', capacity: 4 }],
          // T2: blue 5 (clear outer cross)
          [{ color: 'blue', capacity: 5 }],
          // T3: blue 4 (clear remainder)
          [{ color: 'blue', capacity: 4 }],
        ],
      };

      // 1. Structure validation
      const validation = validateLevelStructure(syntheticLevel);
      expect(validation.valid).toBe(true);

      // 2. Solve
      const result = solve(syntheticLevel);
      expect(result.solved).toBe(true);
      expect(result.moves.length).toBeGreaterThanOrEqual(3);

      // 3. Replay every action on the engine state to verify win
      let state = createGame(syntheticLevel);
      expect(state.status).toBe('playing');
      expect(state.pixels.filter((p) => p.color === 'blue')).toHaveLength(9);
      expect(state.pixels.filter((p) => p.color === 'purple')).toHaveLength(4);

      for (const move of result.moves) {
        const step = resolveAction(state, move);
        expect(step.accepted).toBe(true);
        state = step.state;
      }

      expect(state.status).toBe('won');
      expect(state.pixels.every((p) => p.cleared)).toBe(true);
    });
  });

  // ── 8. Unsupported Colors Rejected ───────────────────────────────────────
  describe('Rejection of Unsupported Colors', () => {
    it('rejects unsupported colors in authored legend', () => {
      const badLegendDef: LevelDefinition = {
        id: 940,
        title: 'Unsupported Legend Color',
        themeId: 'first-light',
        difficulty: 'easy',
        holdingCapacity: 3,
        legend: { X: 'chartreuse' as any },
        pixelArt: ['XX'],
        tunnels: [[{ color: 'chartreuse' as any, capacity: 2 }], [], []],
      };

      const res = validateLevelStructure(badLegendDef);
      expect(res.valid).toBe(false);
      expect(res.diagnostics.some((d) => d.code === 'INVALID_LEGEND_COLOR')).toBe(true);
    });

    it('rejects unsupported colors in tunnel charges', () => {
      const badChargeDef: LevelDefinition = {
        id: 941,
        title: 'Unsupported Charge Color',
        themeId: 'first-light',
        difficulty: 'easy',
        holdingCapacity: 3,
        pixelArt: ['WW'],
        tunnels: [[{ color: 'silver' as any, capacity: 2 }], [], []],
      };

      const res = validateLevelStructure(badChargeDef);
      expect(res.valid).toBe(false);
      expect(res.diagnostics.some((d) => d.code === 'INVALID_CHARGE_COLOR')).toBe(true);
    });

    it('rejects unregistered characters in pixel art', () => {
      const badCharDef: LevelDefinition = {
        id: 942,
        title: 'Unknown Char',
        themeId: 'first-light',
        difficulty: 'easy',
        holdingCapacity: 3,
        pixelArt: ['.Z.'],
        tunnels: [[{ color: 'white', capacity: 1 }], [], []],
      };

      const res = validateLevelStructure(badCharDef);
      expect(res.valid).toBe(false);
      expect(res.diagnostics.some((d) => d.code === 'UNKNOWN_PIXEL_CHAR')).toBe(true);
    });
  });

  // ── 9. Confirmation Levels 1–40 Unchanged & Valid ─────────────────────────
  describe('Campaign Integrity — Levels 1–40', () => {
    it('confirms all existing Levels 1–40 validate with zero structural errors', () => {
      expect(LEVEL_DEFINITIONS.length).toBeGreaterThanOrEqual(40);

      const campaignSlice = LEVEL_DEFINITIONS.slice(0, 40);
      expect(campaignSlice).toHaveLength(40);

      for (const level of campaignSlice) {
        const res = validateLevelStructure(level);
        const errors = res.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toHaveLength(0);
        expect(res.valid).toBe(true);
      }
    });
  });
});
