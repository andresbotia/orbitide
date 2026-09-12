import { DEFAULT_ART_LEGEND } from '@/game/engine/art';
import { createGame, TUNNEL_COUNT } from '@/game/engine/createGame';
import { resolveAction } from '@/game/engine/resolveLaunch';
import { solve } from '@/game/engine/solver';
import type { LevelDefinition, OrbColor } from '@/game/engine/types';
import type { LevelValidationResult, ValidationDiagnostic } from './types';

export const VALID_ORB_COLORS = new Set<OrbColor>([
  'blue', 'cyan', 'white', 'purple', 'pink', 'yellow', 'orange', 'red',
  'green', 'gold', 'coral', 'magenta', 'indigo', 'teal', 'lime',
]);

export const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'super-hard', 'extreme']);

export const MAX_BOARD_DIMENSION = 15;
export const MIN_BOARD_DIMENSION = 1;

export interface ValidationOptions {
  /** Skip solving and replaying (for rapid structural/syntactic linting). Default: false */
  skipSolvability?: boolean;
  /** Maximum node expansion cap for solver. Default: 100,000 */
  nodeCap?: number;
  /** Allow tunnels to contain more charges than pixels require. Default: false */
  allowOverBudget?: boolean;
}

export interface StructuralValidationOptions {
  /** Allow tunnels to contain more charges than pixels require. Default: false */
  allowOverBudget?: boolean;
}

/**
 * Validates purely structural correctness of an authored level:
 * schema integrity, grid dimensions, supported colors, row lengths,
 * tunnel format, and charge totals. Does NOT run the solver.
 */
export function validateLevelStructure(
  def: LevelDefinition,
  options: StructuralValidationOptions = {},
): LevelValidationResult {
  const diagnostics: ValidationDiagnostic[] = [];
  const err = (code: string, message: string, field?: string) => {
    diagnostics.push({ code, severity: 'error', message, field });
  };
  const warn = (code: string, message: string, field?: string) => {
    diagnostics.push({ code, severity: 'warning', message, field });
  };

  const levelTag = `[Level ${def.id} "${def.title ?? 'Untitled'}"]`;

  // ── 1. Metadata Validation ────────────────────────────────────────────────
  if (!Number.isInteger(def.id) || def.id <= 0) {
    err('INVALID_ID', `${levelTag} Level ID must be a positive integer, got ${def.id}`, 'id');
  }

  if (!def.title || def.title.trim().length === 0) {
    warn('MISSING_TITLE', `${levelTag} Level has an empty title`, 'title');
  }

  if (!def.themeId || def.themeId.trim().length === 0) {
    warn('MISSING_THEME', `${levelTag} Level has an empty themeId`, 'themeId');
  }

  if (!VALID_DIFFICULTIES.has(def.difficulty)) {
    err(
      'INVALID_DIFFICULTY',
      `${levelTag} Difficulty '${def.difficulty}' is not one of: ${[...VALID_DIFFICULTIES].join(', ')}`,
      'difficulty',
    );
  }

  if (!Number.isInteger(def.holdingCapacity) || def.holdingCapacity <= 0) {
    err('INVALID_HOLDING', `${levelTag} Holding capacity must be a positive integer, got ${def.holdingCapacity}`, 'holdingCapacity');
  } else if (def.holdingCapacity !== 3) {
    warn('NON_STANDARD_HOLDING', `${levelTag} Holding capacity is ${def.holdingCapacity} (standard campaign level uses 3)`, 'holdingCapacity');
  }

  // ── 2. Grid Dimensions & Character Integrity ─────────────────────────────
  if (!Array.isArray(def.pixelArt) || def.pixelArt.length === 0) {
    err('EMPTY_GRID', `${levelTag} pixelArt must be a non-empty array of strings`, 'pixelArt');
  } else {
    const height = def.pixelArt.length;
    if (height < MIN_BOARD_DIMENSION || height > MAX_BOARD_DIMENSION) {
      err(
        'GRID_HEIGHT_OOB',
        `${levelTag} Grid height ${height} is outside valid range (${MIN_BOARD_DIMENSION}–${MAX_BOARD_DIMENSION})`,
        'pixelArt',
      );
    }

    const firstRowLen = typeof def.pixelArt[0] === 'string' ? def.pixelArt[0].length : 0;
    if (firstRowLen < MIN_BOARD_DIMENSION || firstRowLen > MAX_BOARD_DIMENSION) {
      err(
        'GRID_WIDTH_OOB',
        `${levelTag} Grid width ${firstRowLen} is outside valid range (${MIN_BOARD_DIMENSION}–${MAX_BOARD_DIMENSION})`,
        'pixelArt',
      );
    }

    const effectiveLegend: Record<string, OrbColor> = {
      ...DEFAULT_ART_LEGEND,
      ...(def.legend ?? {}),
    };

    // Check legend validity
    if (def.legend) {
      for (const [char, color] of Object.entries(def.legend)) {
        if (!VALID_ORB_COLORS.has(color)) {
          err('INVALID_LEGEND_COLOR', `${levelTag} Legend character '${char}' maps to unsupported color '${color}'`, 'legend');
        }
      }
    }

    const emptyChars = new Set(['.', ' ']);
    let totalPixels = 0;

    def.pixelArt.forEach((row, rowIndex) => {
      if (typeof row !== 'string') {
        err('MALFORMED_ROW', `${levelTag} Row ${rowIndex} is not a string`, `pixelArt[${rowIndex}]`);
        return;
      }
      if (row.length !== firstRowLen) {
        err(
          'RAGGED_ROW',
          `${levelTag} Row ${rowIndex} has length ${row.length}, expected uniform width ${firstRowLen}`,
          `pixelArt[${rowIndex}]`,
        );
      }

      for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
        const char = row[colIndex] ?? '.';
        if (emptyChars.has(char)) continue;
        totalPixels += 1;
        const color = effectiveLegend[char];
        if (!color) {
          err(
            'UNKNOWN_PIXEL_CHAR',
            `${levelTag} Unknown character '${char}' at row ${rowIndex}, col ${colIndex}. Add to legend or use standard chars (B,C,W,P,K,Y,O,R,G).`,
            `pixelArt[${rowIndex}][${colIndex}]`,
          );
        }
      }
    });

    if (totalPixels === 0) {
      err('NO_PIXELS', `${levelTag} Board has no colored pixels (all cells are empty)`, 'pixelArt');
    }
  }

  // ── 3. Tunnel Structure Integrity ─────────────────────────────────────────
  if (!Array.isArray(def.tunnels)) {
    err('INVALID_TUNNELS', `${levelTag} tunnels must be an array of ChargeSpec queues`, 'tunnels');
  } else if (def.tunnels.length !== TUNNEL_COUNT) {
    err('TUNNEL_COUNT_MISMATCH', `${levelTag} Exactly ${TUNNEL_COUNT} tunnels required, got ${def.tunnels.length}`, 'tunnels');
  } else {
    let totalCharges = 0;
    def.tunnels.forEach((queue, tIndex) => {
      if (!Array.isArray(queue)) {
        err('INVALID_TUNNEL_QUEUE', `${levelTag} Tunnel ${tIndex} is not an array`, `tunnels[${tIndex}]`);
        return;
      }
      queue.forEach((charge, cIndex) => {
        totalCharges += 1;
        if (!charge || typeof charge !== 'object') {
          err('INVALID_CHARGE', `${levelTag} Tunnel ${tIndex} charge ${cIndex} is not an object`, `tunnels[${tIndex}][${cIndex}]`);
          return;
        }
        if (!VALID_ORB_COLORS.has(charge.color)) {
          err(
            'INVALID_CHARGE_COLOR',
            `${levelTag} Tunnel ${tIndex} charge ${cIndex} has invalid color '${charge.color}'`,
            `tunnels[${tIndex}][${cIndex}].color`,
          );
        }
        if (!Number.isInteger(charge.capacity) || charge.capacity <= 0) {
          err(
            'INVALID_CHARGE_CAPACITY',
            `${levelTag} Tunnel ${tIndex} charge ${cIndex} capacity must be a positive integer, got ${charge.capacity}`,
            `tunnels[${tIndex}][${cIndex}].capacity`,
          );
        }
      });
    });

    if (totalCharges === 0) {
      err('EMPTY_TUNNELS', `${levelTag} All tunnels are empty; level has no charges`, 'tunnels');
    }
  }

  // ── 4. Exact Per-Color Charge Budget Validation ───────────────────────────
  if (diagnostics.every((d) => d.severity !== 'error')) {
    try {
      const state = createGame(def);
      const hitsNeededByColor = new Map<string, number>();
      const capacityProvidedByColor = new Map<string, number>();

      for (const pixel of state.pixels) {
        let hits = 1;
        if (pixel.modifier?.kind === 'frozen' || pixel.modifier?.kind === 'shielded') {
          hits += pixel.modifier.level ?? 1;
        }
        hitsNeededByColor.set(pixel.color, (hitsNeededByColor.get(pixel.color) ?? 0) + hits);
      }

      for (const queue of def.tunnels) {
        for (const charge of queue) {
          capacityProvidedByColor.set(
            charge.color,
            (capacityProvidedByColor.get(charge.color) ?? 0) + charge.capacity,
          );
        }
      }

      // Check colors needed on board
      for (const [color, needed] of hitsNeededByColor.entries()) {
        const provided = capacityProvidedByColor.get(color) ?? 0;
        if (provided === 0) {
          err(
            'MISSING_COLOR_CHARGE',
            `${levelTag} Board requires ${needed} '${color}' hits, but no tunnel carries '${color}' charges`,
            'tunnels',
          );
        } else if (provided < needed) {
          err(
            'BUDGET_UNDERFLOW',
            `${levelTag} Under-budget for '${color}': board requires ${needed} hits, tunnels only provide ${provided} (deficit: ${needed - provided})`,
            'tunnels',
          );
        } else if (provided > needed && !options.allowOverBudget) {
          err(
            'BUDGET_OVERFLOW',
            `${levelTag} Over-budget for '${color}': board requires ${needed} hits, tunnels provide ${provided} (surplus: ${provided - needed})`,
            'tunnels',
          );
        }
      }

      // Check charges for colors not on board
      for (const [color, provided] of capacityProvidedByColor.entries()) {
        if (!hitsNeededByColor.has(color) && provided > 0) {
          err(
            'UNUSED_COLOR_CHARGE',
            `${levelTag} Tunnels carry ${provided} '${color}' capacity, but no '${color}' pixels exist on the board`,
            'tunnels',
          );
        }
      }
    } catch (e) {
      err('ENGINE_REJECTED', `${levelTag} Engine failed to initialize game state: ${(e as Error).message}`);
    }
  }

  const valid = diagnostics.every((d) => d.severity !== 'error');

  return {
    levelId: def.id,
    title: def.title,
    valid,
    diagnostics,
    definition: valid ? def : null,
  };
}

/**
 * Validates an authored level definition: first runs fast structural validation,
 * and if valid and solvability is not skipped, runs solver solvability and
 * runtime replay verification.
 */
export function validateLevelPacket(
  def: LevelDefinition,
  options: ValidationOptions = {},
): LevelValidationResult {
  const structResult = validateLevelStructure(def, options);
  if (!structResult.valid || options.skipSolvability) {
    return structResult;
  }

  const diagnostics: ValidationDiagnostic[] = [...structResult.diagnostics];
  const err = (code: string, message: string, field?: string) => {
    diagnostics.push({ code, severity: 'error', message, field });
  };
  const levelTag = `[Level ${def.id} "${def.title ?? 'Untitled'}"]`;

  // ── 5. Solvability & Runtime Replay Verification ──────────────────────────
  const nodeCap = options.nodeCap ?? 100_000;
  try {
    const solveResult = solve(def, {
      mode: 'sequential-compat',
      nodeCap,
      partialOnCap: true,
    });

    if (!solveResult.solved) {
      if (solveResult.nodeCapHit) {
        err(
          'SOLVER_NODE_CAP_EXCEEDED',
          `${levelTag} Level could not be verified within ${nodeCap} solver states`,
        );
      } else {
        err(
          'LEVEL_UNSOLVABLE',
          `${levelTag} Level has no winning sequence! Exhausted all ${solveResult.nodes} reachable states without reaching a win`,
        );
      }
    } else {
      // Replay solver witness actions through actual runtime resolveAction
      let replayState = createGame(def);
      let moveIndex = 0;
      for (const action of solveResult.moves) {
        const outcome = resolveAction(replayState, action);
        if (!outcome.accepted) {
          err(
            'REPLAY_ACTION_REJECTED',
            `${levelTag} Solver witness action #${moveIndex} (${JSON.stringify(action)}) was rejected by runtime: ${outcome.rejection ?? 'unknown'}`,
          );
          break;
        }
        if (outcome.state.holding.length > def.holdingCapacity) {
          err(
            'REPLAY_HOLDING_OVERFLOW',
            `${levelTag} Solver witness action #${moveIndex} overflowed holding bay (${outcome.state.holding.length} > ${def.holdingCapacity})`,
          );
          break;
        }
        replayState = outcome.state;
        moveIndex += 1;
      }

      if (replayState.status !== 'won') {
        err(
          'REPLAY_DID_NOT_WIN',
          `${levelTag} Solver witness finished ${solveResult.moves.length} moves, but end status is '${replayState.status}' instead of 'won'`,
        );
      } else if (!replayState.pixels.every((p) => p.cleared)) {
        const remaining = replayState.pixels.filter((p) => !p.cleared).length;
        err(
          'REPLAY_UNCLEARED_PIXELS',
          `${levelTag} End status is 'won', but ${remaining} pixels remain uncleared on the board`,
        );
      }
    }
  } catch (e) {
    err('SOLVER_EXCEPTION', `${levelTag} Solver crashed during verification: ${(e as Error).message}`);
  }

  const valid = diagnostics.every((d) => d.severity !== 'error');

  return {
    levelId: def.id,
    title: def.title,
    valid,
    diagnostics,
    definition: valid ? def : null,
  };
}

