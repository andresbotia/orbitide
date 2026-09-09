/**
 * Level-browser model. Pure. Builds one lightweight row per level for a
 * campaign-scale browser (designed for hundreds / thousands of levels) WITHOUT
 * running the solver — expensive analysis is merged in on demand when the caller
 * has it. Search / sort / filter are pure list transforms.
 */
import type { LevelDefinition, LevelDifficulty } from '@/game/engine/types';
import { LEVEL_DIFFICULTIES } from './constants';
import { fromLevelDefinition } from './serialize';
import { validateStudioLevel } from './validate';
import type { CampaignManifest } from './campaign/types';
import { worldOfLevel } from './campaign/manifest';

export interface BrowserAnalysisSlice {
  suggestedDifficulty?: LevelDifficulty;
  solvable?: boolean | 'unknown';
  warningCount?: number;
}

export interface BrowserRow {
  id: number;
  title: string;
  themeId: string;
  authoredDifficulty: LevelDifficulty;
  worldId: string | null;
  worldTitle: string | null;
  /** World `order` for sorting; a large sentinel when unassigned. */
  worldOrder: number;
  /** 0-based position within the world, or -1 when unassigned. */
  worldIndex: number;
  pixelCount: number;
  specialCount: number;
  hasReveal: boolean;
  /** Studio validation of the level definition alone (no solver). */
  status: 'ok' | 'error';
  errorCount: number;
  warningCount: number;
  /** Merged from an on-demand analysis, when the caller supplies one. */
  suggestedDifficulty: LevelDifficulty | null;
  solvable: boolean | 'unknown' | null;
  difficultyMismatch: boolean;
}

export function buildBrowserRows(
  defs: LevelDefinition[],
  manifest?: CampaignManifest,
  analyses?: Map<number, BrowserAnalysisSlice>,
): BrowserRow[] {
  return defs.map((def) => {
    const studioLevel = fromLevelDefinition(def);
    const report = validateStudioLevel(studioLevel);
    const world = manifest ? worldOfLevel(manifest, def.id) : undefined;
    const analysis = analyses?.get(def.id);
    const suggested = analysis?.suggestedDifficulty ?? null;
    return {
      id: def.id,
      title: def.title,
      themeId: def.themeId,
      authoredDifficulty: def.difficulty,
      worldId: world?.id ?? null,
      worldTitle: world?.title ?? null,
      worldOrder: world ? world.order : Number.MAX_SAFE_INTEGER,
      worldIndex: world ? world.levelIds.indexOf(def.id) : -1,
      pixelCount: Object.keys(studioLevel.cells).length,
      specialCount: studioLevel.modifiers ? Object.keys(studioLevel.modifiers).length : 0,
      hasReveal: !!def.reveal,
      status: report.exportable ? 'ok' : 'error',
      errorCount: report.errors.length,
      warningCount: (analysis?.warningCount ?? 0) + report.warnings.length,
      suggestedDifficulty: suggested,
      solvable: analysis?.solvable ?? null,
      difficultyMismatch: suggested !== null && suggested !== def.difficulty,
    };
  });
}

export interface BrowserFilter {
  query?: string;
  difficulty?: LevelDifficulty | 'all';
  worldId?: string | 'all' | 'unassigned';
  status?: 'all' | 'ok' | 'error' | 'warnings' | 'mismatch';
}

export function filterRows(rows: BrowserRow[], f: BrowserFilter): BrowserRow[] {
  const q = f.query?.trim().toLowerCase() ?? '';
  return rows.filter((r) => {
    if (q) {
      const hay = `${r.id} ${r.title} ${r.themeId} ${r.worldTitle ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.difficulty && f.difficulty !== 'all' && r.authoredDifficulty !== f.difficulty) return false;
    if (f.worldId === 'unassigned' && r.worldId !== null) return false;
    if (f.worldId && f.worldId !== 'all' && f.worldId !== 'unassigned' && r.worldId !== f.worldId) return false;
    switch (f.status) {
      case 'ok': return r.status === 'ok';
      case 'error': return r.status === 'error';
      case 'warnings': return r.warningCount > 0;
      case 'mismatch': return r.difficultyMismatch;
      default: return true;
    }
  });
}

export type BrowserSortKey = 'id' | 'title' | 'difficulty' | 'world' | 'pixels' | 'warnings' | 'status';

export function sortRows(rows: BrowserRow[], key: BrowserSortKey, dir: 'asc' | 'desc' = 'asc'): BrowserRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  const diffRank = (d: LevelDifficulty) => LEVEL_DIFFICULTIES.indexOf(d);
  const worldKey = (r: BrowserRow) => r.worldOrder * 100_000 + (r.worldIndex < 0 ? 99_999 : r.worldIndex);
  const cmp = (a: BrowserRow, b: BrowserRow): number => {
    switch (key) {
      case 'title': return a.title.localeCompare(b.title) || a.id - b.id;
      case 'difficulty': return (diffRank(a.authoredDifficulty) - diffRank(b.authoredDifficulty)) || a.id - b.id;
      case 'world': return (worldKey(a) - worldKey(b)) || a.id - b.id;
      case 'pixels': return (a.pixelCount - b.pixelCount) || a.id - b.id;
      case 'warnings': return (a.warningCount - b.warningCount) || a.id - b.id;
      case 'status': return (Number(a.status === 'error') - Number(b.status === 'error')) || a.id - b.id;
      default: return a.id - b.id;
    }
  };
  return [...rows].sort((a, b) => sign * cmp(a, b));
}
