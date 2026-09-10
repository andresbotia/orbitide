/**
 * Multi-level / campaign import & export. Pure and deterministic.
 *
 * Export produces canonical TS or JSON for: one level, a selected set, a world,
 * or the whole campaign bundle (manifest + levels). Import accepts ONLY
 * Studio-exported JSON — never executable TS — and validates every level against
 * the real engine + validator before returning it.
 */
import { createGame } from '@/game/engine/createGame';
import type { LevelDefinition } from '@/game/engine/types';
import { CAMPAIGN_SCHEMA_VERSION, STUDIO_SCHEMA_VERSION } from './constants';
import { canonicalManifest } from './campaign/serialize';
import type { CampaignManifest } from './campaign/types';
import { fromLevelDefinition, serializeToTS, toLevelDefinition } from './serialize';
import type { StudioLevel } from './types';
import { validateStudioLevel } from './validate';
import { checkLinkedDefinition } from './validateModifiers';

export interface CampaignBundle {
  studioVersion: number;
  campaignVersion: number;
  manifest: CampaignManifest;
  levels: LevelDefinition[];
}

// ── export ─────────────────────────────────────────────────────────────────

function canonicalLevel(def: LevelDefinition): LevelDefinition {
  // Round-trip through the ONE serializer so key order / legend / modifiers are
  // canonical and deterministic.
  return toLevelDefinition(fromLevelDefinition(def));
}

/** Deterministic JSON array of canonical level definitions. */
export function exportLevelsJSON(defs: LevelDefinition[]): string {
  const ordered = [...defs].sort((a, b) => a.id - b.id).map(canonicalLevel);
  return JSON.stringify(ordered, null, 2) + '\n';
}

/** Paste-ready TS array literal in the style of `levelDefinitions.ts`. */
export function exportLevelsTS(defs: LevelDefinition[]): string {
  const ordered = [...defs].sort((a, b) => a.id - b.id);
  const body = ordered.map((d) => serializeToTS(fromLevelDefinition(d)).trimEnd()).join(',\n');
  return `[\n${body},\n]\n`;
}

/** The full campaign as one deterministic bundle (manifest + every level). */
export function exportCampaignBundle(manifest: CampaignManifest, defs: LevelDefinition[]): string {
  const bundle: CampaignBundle = {
    studioVersion: STUDIO_SCHEMA_VERSION,
    campaignVersion: CAMPAIGN_SCHEMA_VERSION,
    manifest: canonicalManifest(manifest),
    levels: [...defs].sort((a, b) => a.id - b.id).map(canonicalLevel),
  };
  return JSON.stringify(bundle, null, 2) + '\n';
}

// ── import ─────────────────────────────────────────────────────────────────

export interface ImportResult {
  ok: boolean;
  levels: LevelDefinition[];
  studioLevels: StudioLevel[];
  manifest: CampaignManifest | null;
  errors: string[];
  warnings: string[];
}

const fail = (msg: string): ImportResult => ({
  ok: false, levels: [], studioLevels: [], manifest: null, errors: [msg], warnings: [],
});

/**
 * Parse Studio-exported JSON. Accepts a single level object, an array of levels,
 * or a campaign bundle `{ studioVersion, campaignVersion, manifest, levels }`.
 * Every level must pass `createGame` + `validateStudioLevel` (no hard errors).
 */
export function importStudioJSON(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return fail(`Not valid JSON: ${(e as Error).message}`);
  }

  let rawLevels: unknown[];
  let manifest: CampaignManifest | null = null;
  const warnings: string[] = [];

  if (Array.isArray(parsed)) {
    rawLevels = parsed;
  } else if (parsed && typeof parsed === 'object' && 'levels' in parsed && Array.isArray((parsed as CampaignBundle).levels)) {
    const bundle = parsed as CampaignBundle;
    rawLevels = bundle.levels;
    manifest = bundle.manifest ?? null;
    if (typeof bundle.studioVersion === 'number' && bundle.studioVersion > STUDIO_SCHEMA_VERSION) {
      warnings.push(`Bundle studioVersion ${bundle.studioVersion} is newer than this Studio (${STUDIO_SCHEMA_VERSION}).`);
    }
    if (typeof bundle.campaignVersion === 'number' && bundle.campaignVersion > CAMPAIGN_SCHEMA_VERSION) {
      warnings.push(`Bundle campaignVersion ${bundle.campaignVersion} is newer than this Studio (${CAMPAIGN_SCHEMA_VERSION}).`);
    }
  } else if (parsed && typeof parsed === 'object') {
    rawLevels = [parsed];
  } else {
    return fail('Expected a level object, an array of levels, or a campaign bundle.');
  }

  const errors: string[] = [];
  const levels: LevelDefinition[] = [];
  const studioLevels: StudioLevel[] = [];

  rawLevels.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') {
      errors.push(`Entry ${i} is not an object.`);
      return;
    }
    const def = raw as LevelDefinition;
    if (typeof def.id !== 'number' || !Array.isArray(def.pixelArt) || !Array.isArray(def.tunnels)) {
      errors.push(`Entry ${i} is missing required fields (id / pixelArt / tunnels).`);
      return;
    }
    const linkedIssues = checkLinkedDefinition(def);
    if (linkedIssues.some((issue) => issue.severity === 'error')) {
      errors.push(`Level ${def.id}: ${linkedIssues.map((issue) => issue.code).join(', ')}`);
      return;
    }
    try {
      createGame(def);
    } catch (e) {
      errors.push(`Level ${def.id}: engine rejected it — ${(e as Error).message}`);
      return;
    }
    const studio = fromLevelDefinition(def);
    const report = validateStudioLevel(studio);
    if (!report.exportable) {
      errors.push(`Level ${def.id}: ${report.errors.map((x) => x.code).join(', ')}`);
      return;
    }
    for (const w of report.warnings) warnings.push(`Level ${def.id}: ${w.message}`);
    levels.push(toLevelDefinition(studio));
    studioLevels.push(studio);
  });

  const seen = new Set<number>();
  for (const l of levels) {
    if (seen.has(l.id)) errors.push(`Duplicate level id ${l.id} in the import.`);
    seen.add(l.id);
  }

  return {
    ok: errors.length === 0 && levels.length > 0,
    levels,
    studioLevels,
    manifest,
    errors,
    warnings,
  };
}
