/**
 * Campaign-wide batch validation. Pure and deterministic — it composes the ONE
 * level validator ({@link validateStudioLevel}) and the ONE manifest validator
 * ({@link validateManifest}) across many levels and adds only the checks that
 * need the whole set (duplicate ids, manifest cross-references, optional
 * solver-backed findings when an analysis slice is supplied).
 *
 * It never runs the solver itself — pass `analyses` when you want
 * unsolvable / difficulty-mismatch findings.
 */
import type { LevelDefinition, LevelDifficulty } from '@/game/engine/types';
import { validateManifest } from './campaign/validate';
import { worldOfLevel } from './campaign/manifest';
import type { CampaignManifest, ManifestIssue } from './campaign/types';
import { fromLevelDefinition } from './serialize';
import type { ValidationIssue } from './types';
import { validateStudioLevel } from './validate';
import { checkLinkedDefinition } from './validateModifiers';

export interface BatchLevelAnalysisSlice {
  solvable?: boolean | 'unknown';
  suggestedDifficulty?: LevelDifficulty;
  difficultyMismatchTiers?: number;
}

export interface BatchLevelResult {
  levelId: number;
  title: string;
  worldId: string | null;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** Extra findings from an analysis slice (unsolvable, difficulty). */
  analysisFindings: { code: string; severity: 'error' | 'warning'; message: string }[];
  ok: boolean;
}

export interface BatchValidationResult {
  levels: BatchLevelResult[];
  manifestIssues: ManifestIssue[];
  campaignIssues: { code: string; severity: 'error' | 'warning'; message: string }[];
  summary: {
    total: number;
    invalid: number;
    withWarnings: number;
    unsolvable: number;
    difficultyMismatches: number;
    errorCount: number;
    warningCount: number;
  };
  ok: boolean;
}

export interface BatchValidateInput {
  defs: LevelDefinition[];
  manifest?: CampaignManifest;
  analyses?: Map<number, BatchLevelAnalysisSlice>;
  /** Restrict to these level ids (selected-levels / selected-world scope). */
  scopeLevelIds?: number[];
}

export function batchValidate(input: BatchValidateInput): BatchValidationResult {
  const { manifest, analyses } = input;
  const inScope = input.scopeLevelIds ? new Set(input.scopeLevelIds) : null;
  const defs = [...input.defs]
    .filter((d) => !inScope || inScope.has(d.id))
    .sort((a, b) => a.id - b.id);

  // Campaign-wide: duplicate ids.
  const campaignIssues: BatchValidationResult['campaignIssues'] = [];
  const idCounts = new Map<number, number>();
  for (const d of input.defs) idCounts.set(d.id, (idCounts.get(d.id) ?? 0) + 1);
  for (const [id, n] of [...idCounts].sort((a, b) => a[0] - b[0])) {
    if (n > 1) campaignIssues.push({ code: 'batch/dup-level-id', severity: 'error', message: `Level id ${id} is defined ${n} times.` });
  }

  const manifestReport = manifest
    ? validateManifest(manifest, input.defs.map((d) => d.id))
    : { errors: [] as ManifestIssue[], warnings: [] as ManifestIssue[], ok: true };
  const manifestIssues = [...manifestReport.errors, ...manifestReport.warnings];

  let unsolvable = 0;
  let difficultyMismatches = 0;
  let errorCount = 0;
  let warningCount = 0;

  const levels: BatchLevelResult[] = defs.map((def) => {
    let report: ReturnType<typeof validateStudioLevel>;
    try {
      report = validateStudioLevel(fromLevelDefinition(def));
      const relationshipIssues = checkLinkedDefinition(def);
      report = {
        ...report,
        errors: [...report.errors, ...relationshipIssues.filter((issue) => issue.severity === 'error')],
        warnings: [...report.warnings, ...relationshipIssues.filter((issue) => issue.severity === 'warning')],
        ok: report.ok && relationshipIssues.every((issue) => issue.severity !== 'error'),
        exportable: report.exportable && relationshipIssues.every((issue) => issue.severity !== 'error'),
      };
    } catch (e) {
      report = {
        errors: [{ code: 'batch/unreadable', severity: 'error', message: `Level ${def.id} could not be read: ${(e as Error).message}` }],
        warnings: [],
        ok: false,
        exportable: false,
      };
    }

    const analysisFindings: BatchLevelResult['analysisFindings'] = [];
    const slice = analyses?.get(def.id);
    if (slice) {
      if (slice.solvable === false) {
        analysisFindings.push({ code: 'batch/unsolvable', severity: 'error', message: `Level ${def.id} "${def.title}" has no solution.` });
        unsolvable += 1;
      }
      if (slice.difficultyMismatchTiers !== undefined && Math.abs(slice.difficultyMismatchTiers) >= 2) {
        analysisFindings.push({
          code: 'batch/difficulty-mismatch',
          severity: 'warning',
          message: `Level ${def.id}: authored ${def.difficulty}, suggested ${slice.suggestedDifficulty ?? '?'} (${Math.abs(slice.difficultyMismatchTiers)} tiers).`,
        });
        difficultyMismatches += 1;
      }
    }

    const ok = report.errors.length === 0 && analysisFindings.every((f) => f.severity !== 'error');
    errorCount += report.errors.length + analysisFindings.filter((f) => f.severity === 'error').length;
    warningCount += report.warnings.length + analysisFindings.filter((f) => f.severity === 'warning').length;

    return {
      levelId: def.id,
      title: def.title,
      worldId: manifest ? (worldOfLevel(manifest, def.id)?.id ?? null) : null,
      errors: report.errors,
      warnings: report.warnings,
      analysisFindings,
      ok,
    };
  });

  errorCount += campaignIssues.filter((i) => i.severity === 'error').length + manifestReport.errors.length;
  warningCount += campaignIssues.filter((i) => i.severity === 'warning').length + manifestReport.warnings.length;

  const invalid = levels.filter((l) => !l.ok).length;
  const withWarnings = levels.filter((l) => l.warnings.length > 0 || l.analysisFindings.some((f) => f.severity === 'warning')).length;

  return {
    levels,
    manifestIssues,
    campaignIssues,
    summary: {
      total: levels.length,
      invalid,
      withWarnings,
      unsolvable,
      difficultyMismatches,
      errorCount,
      warningCount,
    },
    ok: invalid === 0 && campaignIssues.every((i) => i.severity !== 'error') && manifestReport.errors.length === 0,
  };
}
