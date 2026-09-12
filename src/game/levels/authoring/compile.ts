import fs from 'fs';
import path from 'path';
import type { LevelDefinition } from '@/game/engine/types';
import { LEVEL_DEFINITIONS as LEGACY_LEVEL_DEFINITIONS } from '../levelDefinitions';
import { loadAuthoredDirectory, loadAuthoredFile } from './loader';
import { validateLevelStructure } from './validate';

export interface CompileOptions {
  sourceDir?: string;
  sourceFile?: string;
  targetFile?: string;
  ignoreLegacyCollisions?: boolean;
}

export interface CompileResult {
  success: boolean;
  count: number;
  errors: string[];
  targetFile: string;
}

const DEFAULT_SOURCE_DIR = path.resolve(process.cwd(), 'content/levels');
const DEFAULT_TARGET_FILE = path.resolve(process.cwd(), 'src/game/levels/compiledLevels.ts');

/**
 * Compiles authored JSON level packets from content/levels/ (or a specified file)
 * into a strongly-typed TypeScript bundle consumed by the game.
 * Performs fast structural validation ONLY (schema, grid, colors, row lengths,
 * tunnel format, charge totals, IDs, duplicate IDs). NEVER runs the solver.
 */
export function compileLevels(options: CompileOptions = {}): CompileResult {
  const targetFile = options.targetFile ?? DEFAULT_TARGET_FILE;

  let levels: LevelDefinition[] = [];
  let loadErrors: string[] = [];

  if (options.sourceFile) {
    const res = loadAuthoredFile(options.sourceFile);
    levels = res.levels;
    loadErrors = res.errors;
  } else {
    const sourceDir = options.sourceDir ?? DEFAULT_SOURCE_DIR;
    const res = loadAuthoredDirectory(sourceDir);
    levels = res.levels;
    loadErrors = res.errors;
  }

  if (loadErrors.length > 0) {
    return {
      success: false,
      count: 0,
      errors: loadErrors,
      targetFile,
    };
  }

  if (levels.length === 0) {
    return {
      success: false,
      count: 0,
      errors: [`No valid authored levels found`],
      targetFile,
    };
  }

  // Fast structural validation of each level before compilation (no solver!)
  const validationErrors: string[] = [];
  for (const lvl of levels) {
    const res = validateLevelStructure(lvl);
    if (!res.valid) {
      for (const diag of res.diagnostics.filter((d) => d.severity === 'error')) {
        validationErrors.push(`[Level ${lvl.id} "${lvl.title}"] ${diag.code}: ${diag.message}`);
      }
    }
  }

  // Collision protection: ensure no authored level collides with legacy levelDefinitions.ts
  if (!options.ignoreLegacyCollisions) {
    const legacyIds = new Set(LEGACY_LEVEL_DEFINITIONS.map((l) => l.id));
    for (const lvl of levels) {
      if (legacyIds.has(lvl.id)) {
        validationErrors.push(
          `[ID_COLLISION] Authored level ID ${lvl.id} ("${lvl.title}") collides with an existing level in legacy levelDefinitions.ts. Each level ID must be unique across legacy and authored levels.`,
        );
      }
    }
  }

  if (validationErrors.length > 0) {
    return {
      success: false,
      count: 0,
      errors: validationErrors,
      targetFile,
    };
  }

  // Ensure target directory exists
  const targetDir = path.dirname(targetFile);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const sourceDesc = options.sourceFile
    ? path.relative(process.cwd(), options.sourceFile)
    : path.relative(process.cwd(), options.sourceDir ?? DEFAULT_SOURCE_DIR);

  const header = `/**
 * AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY.
 * Produced by Orbitide Level Authoring Compiler from:
 * ${sourceDesc}
 * Total compiled levels: ${levels.length}
 */
import type { LevelDefinition } from '../engine/types';

export const COMPILED_LEVELS: LevelDefinition[] = `;

  const content = `${header}${JSON.stringify(levels, null, 2)};\n`;
  fs.writeFileSync(targetFile, content, 'utf-8');

  return {
    success: true,
    count: levels.length,
    errors: [],
    targetFile,
  };
}
