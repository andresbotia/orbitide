import fs from 'fs';
import path from 'path';
import { analyzeAuthoredLevel } from '@/game/levels/authoring/analyze';
import { compileLevels } from '@/game/levels/authoring/compile';
import { loadAuthoredDirectory, loadAuthoredFile } from '@/game/levels/authoring/loader';
import { validateLevelPacket, validateLevelStructure } from '@/game/levels/authoring/validate';
import { LEVEL_DEFINITIONS } from '@/game/levels/levels';
import type { LevelDefinition } from '@/game/engine/types';

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'help';
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg && arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    }
  }

  return { command, flags };
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

interface ScopedSelection {
  levels: LevelDefinition[];
  scopeLabel: string;
}

/**
 * Resolves the explicit scope for solver or validation commands.
 * Orbitide NEVER runs campaign-wide solvers implicitly.
 */
function resolveScope(flags: Record<string, string | boolean>): ScopedSelection {
  const hasLevel = flags.level !== undefined;
  const hasFrom = flags.from !== undefined;
  const hasTo = flags.to !== undefined;
  const hasWorld = flags.world !== undefined;
  const hasFile = flags.file !== undefined;

  if (!hasLevel && !hasFrom && !hasTo && !hasWorld && !hasFile) {
    console.error(`
No level range supplied.

Use:
  --level 17
  --from 11 --to 20
  --world 2
  --file <path>
`);
    process.exit(1);
  }

  if (hasFrom && !hasTo) {
    console.error('❌ Error: --from requires --to (e.g. --from 11 --to 20). Unbounded ranges are not allowed.');
    process.exit(1);
  }
  if (hasTo && !hasFrom) {
    console.error('❌ Error: --to requires --from (e.g. --from 11 --to 20). Unbounded ranges are not allowed.');
    process.exit(1);
  }

  const pool = new Map<number, LevelDefinition>();

  if (hasFile) {
    const filePath = path.resolve(process.cwd(), String(flags.file));
    const res = loadAuthoredFile(filePath);
    if (res.errors.length > 0) {
      console.error('❌ Errors loading file:');
      res.errors.forEach((e) => console.error(`  • ${e}`));
      process.exit(1);
    }
    for (const lvl of res.levels) {
      pool.set(lvl.id, lvl);
    }
  } else {
    // 1. Seed with TypeScript campaign definitions
    for (const lvl of LEVEL_DEFINITIONS) {
      pool.set(lvl.id, lvl);
    }
    // 2. Overlay with authored JSON files from content/levels/
    const sourceDir = path.resolve(process.cwd(), 'content/levels');
    if (fs.existsSync(sourceDir)) {
      const res = loadAuthoredDirectory(sourceDir);
      if (res.errors.length > 0) {
        console.error('❌ Errors loading content/levels:');
        res.errors.forEach((e) => console.error(`  • ${e}`));
        process.exit(1);
      }
      for (const lvl of res.levels) {
        pool.set(lvl.id, lvl);
      }
    }
  }

  let allLevels = Array.from(pool.values()).sort((a, b) => a.id - b.id);
  let scopeLabel = '';

  if (hasFile && !hasLevel && !hasFrom && !hasWorld) {
    scopeLabel = path.basename(String(flags.file));
  }

  if (hasLevel) {
    const lvlId = parseInt(String(flags.level), 10);
    if (isNaN(lvlId)) {
      console.error(`❌ Invalid --level value: ${flags.level}`);
      process.exit(1);
    }
    allLevels = allLevels.filter((l) => l.id === lvlId);
    scopeLabel = `Level ${lvlId}`;
  } else if (hasFrom && hasTo) {
    const fromId = parseInt(String(flags.from), 10);
    const toId = parseInt(String(flags.to), 10);
    if (isNaN(fromId) || isNaN(toId) || fromId > toId) {
      console.error(`❌ Invalid range: --from ${flags.from} --to ${flags.to}`);
      process.exit(1);
    }
    allLevels = allLevels.filter((l) => l.id >= fromId && l.id <= toId);
    scopeLabel = `Levels ${fromId}–${toId}`;
  } else if (hasWorld) {
    const worldArg = String(flags.world).toLowerCase();
    const worldNum = parseInt(worldArg, 10);
    if (!isNaN(worldNum)) {
      const minId = (worldNum - 1) * 10 + 1;
      const maxId = worldNum * 10;
      allLevels = allLevels.filter((l) => l.id >= minId && l.id <= maxId);
      scopeLabel = `World ${worldNum} (Levels ${minId}–${maxId})`;
    } else {
      allLevels = allLevels.filter((l) => l.themeId.toLowerCase().includes(worldArg));
      scopeLabel = `World "${flags.world}"`;
    }
  }

  if (allLevels.length === 0) {
    console.error(`⚠️ No levels match the specified filters: ${scopeLabel || 'none'}`);
    process.exit(1);
  }

  // Safety safeguard against accidental mass analysis
  if (allLevels.length > 50 && !flags.force) {
    console.error(
      `❌ Safety limit: Selected scope contains ${allLevels.length} levels (max safe limit is 50).\n` +
      `   Narrow your range (e.g. --from 11 --to 20) or specify --force if intentional.`
    );
    process.exit(1);
  }

  return { levels: allLevels, scopeLabel };
}

/**
 * Stage A: Import / compile
 * Fast structural validation of authored JSON only.
 * Checks schema, grid dimensions, colors, row lengths, tunnel format,
 * charge totals, IDs, duplicate IDs.
 * NEVER invokes the solver.
 */
async function handleCompile(flags: Record<string, string | boolean>) {
  const sourceFile = flags.file ? path.resolve(process.cwd(), String(flags.file)) : undefined;
  const sourceDir = path.resolve(process.cwd(), 'content/levels');
  const targetFile = flags.target
    ? path.resolve(process.cwd(), String(flags.target))
    : path.resolve(process.cwd(), 'src/game/levels/compiledLevels.ts');

  console.log('Orbitide Level Compiler');
  console.log(`Source: ${sourceFile ? path.relative(process.cwd(), sourceFile) : path.relative(process.cwd(), sourceDir)}`);
  console.log('Mode: structural validation only (solver disabled)\n');

  const t0 = performance.now();
  const ignoreLegacyCollisions = Boolean(flags['ignore-collisions'] || flags.force);
  const result = compileLevels({ sourceDir, sourceFile, targetFile, ignoreLegacyCollisions });
  const dt = performance.now() - t0;

  if (!result.success) {
    console.error('❌ Compilation failed with errors:');
    result.errors.forEach((err) => console.error(`  • ${err}`));
    process.exit(1);
  }

  console.log(`✅ Successfully compiled ${result.count} levels in ${formatDuration(dt)} to:`);
  console.log(`   ${path.relative(process.cwd(), result.targetFile)}\n`);
}

/**
 * Stage B: Validate
 * Runs gameplay validation ONLY for the selected level range.
 */
async function handleValidate(flags: Record<string, string | boolean>) {
  const selection = resolveScope(flags);
  const skipSolvability = Boolean(flags.fast || flags['skip-solve']);
  const nodeCap = flags['node-cap'] ? parseInt(String(flags['node-cap']), 10) : 100_000;

  console.log('Orbitide Level Validator');
  console.log(`Scope: ${selection.scopeLabel}`);
  console.log(`Levels: ${selection.levels.length}`);
  console.log(`Solver: ${skipSolvability ? 'disabled (structural only)' : 'enabled'}\n`);

  let validCount = 0;
  let invalidCount = 0;
  let warningCount = 0;
  const batchStart = performance.now();

  for (const lvl of selection.levels) {
    const t0 = performance.now();
    const result = skipSolvability
      ? validateLevelStructure(lvl)
      : validateLevelPacket(lvl, { nodeCap });
    const dt = performance.now() - t0;
    const timeStr = formatDuration(dt);

    console.log(`Level ${lvl.id}: ${timeStr}`);
    if (dt > 5000) {
      console.log(`  ⚠️ Level ${lvl.id} took ${timeStr} to solve (high complexity / possible solver outlier)`);
    }

    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    const warnings = result.diagnostics.filter((d) => d.severity === 'warning');

    if (errors.length === 0) {
      validCount += 1;
      const warnSuffix = warnings.length > 0 ? ` (${warnings.length} warnings)` : '';
      console.log(`  ✓ L${String(lvl.id).padEnd(3)} "${lvl.title}" [${lvl.difficulty}]${warnSuffix}`);
      warnings.forEach((w) => console.log(`      ⚠️ [${w.code}] ${w.message}`));
      warningCount += warnings.length;
    } else {
      invalidCount += 1;
      console.log(`  ✗ L${String(lvl.id).padEnd(3)} "${lvl.title}" [${lvl.difficulty}] FAILED:`);
      errors.forEach((e) => console.log(`      ⛔ [${e.code}] ${e.message}`));
      warnings.forEach((w) => console.log(`      ⚠️ [${w.code}] ${w.message}`));
    }
  }

  const batchTotal = performance.now() - batchStart;
  console.log(`\nBatch total: ${formatDuration(batchTotal)}`);
  console.log(`Summary: ${validCount} passed, ${invalidCount} failed, ${warningCount} warnings total.\n`);

  if (invalidCount > 0) {
    process.exit(1);
  }
}

/**
 * Stage C & D: Analyze
 * Runs difficulty metrics and solver analysis ONLY for the selected level range.
 */
async function handleAnalyze(flags: Record<string, string | boolean>) {
  const selection = resolveScope(flags);
  const nodeCap = flags['node-cap'] ? parseInt(String(flags['node-cap']), 10) : 150_000;

  console.log('Orbitide Level Analyzer');
  console.log(`Scope: ${selection.scopeLabel}`);
  console.log(`Levels: ${selection.levels.length}`);
  console.log('Solver: enabled\n');

  const rows = [];
  const batchStart = performance.now();

  for (const lvl of selection.levels) {
    const t0 = performance.now();
    const report = await analyzeAuthoredLevel(lvl, { nodeCap });
    const dt = performance.now() - t0;
    const timeStr = formatDuration(dt);

    console.log(`Level ${lvl.id}: ${timeStr}`);
    if (dt > 5000) {
      console.log(`  ⚠️ Level ${lvl.id} took ${timeStr} to analyze (possible solver outlier)`);
    }

    rows.push({ report, timeStr });
  }

  const batchTotal = performance.now() - batchStart;

  // Output ASCII Table
  const headers = [
    'Lvl', 'Title', 'Grid', 'Px', 'Clr', 'Authored', 'Calc', 'Score',
    'Peak', 'MaxH', 'LossProb', 'FailPath', 'Solv', 'Anti-Spam', 'Time',
  ];

  console.log('\n| ' + headers.join(' | ') + ' |');
  console.log('| ' + headers.map(() => '---').join(' | ') + ' |');

  for (const { report: r, timeStr } of rows) {
    const mismatchMark = r.difficultyMismatch ? '*' : ' ';
    const antiSpamCol = r.antiSpam.status === 'spam-resistant'
      ? 'OK'
      : r.antiSpam.status.toUpperCase();

    const row = [
      String(r.id).padEnd(3),
      r.title.slice(0, 16).padEnd(16),
      r.gridDimensions.padEnd(5),
      String(r.pixelCount).padEnd(3),
      String(r.colorCount).padEnd(3),
      r.authoredDifficulty.padEnd(6),
      (r.calculatedDifficulty + mismatchMark).padEnd(7),
      String(r.difficultyScore).padEnd(3),
      String(r.minWinningHoldingPeak).padEnd(4),
      String(r.maxHoldingObserved).padEnd(4),
      r.lossProbability.toFixed(3).padEnd(8),
      r.failPathLength === null ? 'None'.padEnd(8) : `${r.failPathLength} moves`.padEnd(8),
      r.solvable ? 'Yes ' : 'NO  ',
      antiSpamCol.padEnd(9),
      timeStr.padEnd(6),
    ];
    console.log('| ' + row.join(' | ') + ' |');
  }

  console.log('\n* Indicates calculated difficulty differs from authored difficulty.');

  // Print Anti-Spam Warnings
  const vulnerable = rows.filter((item) => item.report.antiSpam.status === 'vulnerable');
  if (vulnerable.length > 0) {
    console.log('\n⚠️ Anti-Spam Risk Warnings:');
    for (const { report: v } of vulnerable) {
      console.log(`  • Level ${v.id} ("${v.title}") is labeled ${v.authoredDifficulty} but vulnerable to spam:`);
      console.log(`    Flags: ${v.antiSpam.riskFlags.join(', ')}`);
      v.antiSpam.recommendations.forEach((rec) => console.log(`    Recommendation: ${rec}`));
    }
  }

  console.log(`\nBatch total: ${formatDuration(batchTotal)}\n`);
}

async function main() {
  const { command, flags } = parseArgs();

  switch (command) {
    case 'compile':
    case 'import':
      await handleCompile(flags);
      break;
    case 'validate':
      await handleValidate(flags);
      break;
    case 'analyze':
    case 'report':
      await handleAnalyze(flags);
      break;
    default:
      console.log(`
Orbitide Level Pipeline CLI

Usage:
  # Stage A: Import / compile (fast structural validation only, no solver)
  npm run levels:compile [-- --file <path>]

  # Stage B: Validate (gameplay & solvability for selected scope)
  npm run levels:validate -- --level 17
  npm run levels:validate -- --from 11 --to 20
  npm run levels:validate -- --world 2
  npm run levels:validate -- --file content/levels/world-02.json

  # Stage C & D: Analyze / Single-level debug (difficulty & anti-spam metrics)
  npm run levels:analyze -- --level 17
  npm run levels:analyze -- --from 11 --to 20
  npm run levels:analyze -- --world 2
  npm run levels:analyze -- --file content/levels/world-02.json

Options:
  --level <N>         Select a single level (Stage D single-level debug)
  --from <N> --to <N> Select an explicit level range
  --world <N>         Select a specific world by index or theme slug
  --file <path>       Load directly from an authored JSON file
  --fast              Skip solver in validate (structural checks only)
  --node-cap <N>      Cap maximum solver search states (default: 100k/150k)
  --force             Allow batch sizes greater than 50 levels
`);
      break;
  }
}

main().catch((err) => {
  console.error('Fatal CLI error:', err);
  process.exit(1);
});
