import fs from 'fs';
import path from 'path';
import type { LevelDefinition } from '@/game/engine/types';
import { normalizeAuthoredLevel } from './normalize';
import type { AuthoredLevel, AuthoredWorldPacket } from './types';

export interface LoadResult {
  levels: LevelDefinition[];
  errors: string[];
  fileSources: Map<number, string>;
}

/**
 * Parses raw JSON string into an array of normalized LevelDefinitions.
 */
export function parseAuthoredJSON(
  content: string,
  sourceName = 'anonymous.json',
): { levels: LevelDefinition[]; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    return {
      levels: [],
      errors: [`${sourceName}: Failed to parse JSON — ${(e as Error).message}`],
    };
  }

  const rawLevels: AuthoredLevel[] = [];
  const errors: string[] = [];
  let defaultThemeId: string | undefined;

  if (Array.isArray(parsed)) {
    rawLevels.push(...(parsed as AuthoredLevel[]));
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.levels)) {
      const packet = parsed as AuthoredWorldPacket;
      defaultThemeId = packet.themeId ?? packet.theme;
      rawLevels.push(...packet.levels);
    } else if (typeof obj.id === 'number') {
      rawLevels.push(parsed as AuthoredLevel);
    } else {
      errors.push(`${sourceName}: JSON object must be a level (has 'id') or a world packet (has 'levels' array)`);
    }
  } else {
    errors.push(`${sourceName}: Expected JSON object or array`);
  }

  const levels: LevelDefinition[] = [];
  for (let i = 0; i < rawLevels.length; i += 1) {
    const raw = rawLevels[i];
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'number') {
      errors.push(`${sourceName} (item ${i}): Missing required 'id' number`);
      continue;
    }
    levels.push(normalizeAuthoredLevel(raw, defaultThemeId));
  }

  return { levels, errors };
}

/**
 * Reads and parses a single JSON level or world file from disk.
 */
export function loadAuthoredFile(filePath: string): LoadResult {
  const fileSources = new Map<number, string>();
  if (!fs.existsSync(filePath)) {
    return { levels: [], errors: [`File not found: ${filePath}`], fileSources };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const { levels, errors } = parseAuthoredJSON(content, path.basename(filePath));

  for (const lvl of levels) {
    fileSources.set(lvl.id, filePath);
  }

  return { levels, errors, fileSources };
}

/**
 * Scans a directory for all .json level packets and returns normalized LevelDefinitions.
 * Ignores filenames starting with '.' or template files (e.g. 'template.json').
 */
export function loadAuthoredDirectory(dirPath: string): LoadResult {
  const levels: LevelDefinition[] = [];
  const errors: string[] = [];
  const fileSources = new Map<number, string>();

  if (!fs.existsSync(dirPath)) {
    return { levels: [], errors: [`Directory not found: ${dirPath}`], fileSources };
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const sub = loadAuthoredDirectory(fullPath);
      levels.push(...sub.levels);
      errors.push(...sub.errors);
      for (const [id, src] of sub.fileSources.entries()) {
        fileSources.set(id, src);
      }
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.json') &&
      !entry.name.startsWith('.') &&
      !entry.name.includes('template') &&
      !entry.name.includes('example') &&
      !entry.name.includes('fixture')
    ) {
      const res = loadAuthoredFile(fullPath);
      levels.push(...res.levels);
      errors.push(...res.errors);
      for (const [id, src] of res.fileSources.entries()) {
        fileSources.set(id, src);
      }
    }
  }

  // Check for duplicate level IDs
  const seen = new Map<number, string>();
  const duplicates: number[] = [];
  for (const lvl of levels) {
    const src = fileSources.get(lvl.id) ?? 'unknown';
    if (seen.has(lvl.id)) {
      duplicates.push(lvl.id);
      errors.push(
        `Duplicate level id ${lvl.id} found in: ${seen.get(lvl.id)} and ${src}`,
      );
    } else {
      seen.set(lvl.id, src);
    }
  }

  // Sort deterministically by level ID
  levels.sort((a, b) => a.id - b.id);

  return { levels, errors, fileSources };
}
