/**
 * Pure campaign-manifest operations. Every function returns a new, NORMALISED
 * {@link CampaignManifest} (never mutates): worlds sorted by `order` and
 * re-indexed 0..n-1, a level id assigned to at most one world (first wins),
 * `orderedLevelIds` recomputed. Deterministic — the same logical manifest always
 * serialises identically.
 */
import { CAMPAIGN_SCHEMA_VERSION } from '../constants';
import type { CampaignManifest, CampaignWorld } from './types';

/** Sort worlds by order, re-index, dedupe level ids, rebuild `orderedLevelIds`. */
export function normalizeManifest(m: CampaignManifest): CampaignManifest {
  const worlds = [...m.worlds]
    .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1))
    .map((w, i) => ({ ...w, order: i, levelIds: [...w.levelIds] }));

  const seen = new Set<number>();
  for (const w of worlds) {
    w.levelIds = w.levelIds.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  const assigned = worlds.flatMap((w) => w.levelIds);
  const extra = m.orderedLevelIds.filter((id) => !seen.has(id));
  const orderedLevelIds = [...assigned, ...extra];

  return { campaignVersion: m.campaignVersion, worlds, orderedLevelIds };
}

/** A fresh manifest, optionally seeding a first world with the given level ids. */
export function createManifest(opts: { worldTitle?: string; levelIds?: number[] } = {}): CampaignManifest {
  const base: CampaignManifest = {
    campaignVersion: CAMPAIGN_SCHEMA_VERSION,
    worlds: opts.levelIds && opts.levelIds.length > 0
      ? [{ id: 'world-1', title: opts.worldTitle ?? 'World 1', order: 0, levelIds: [...opts.levelIds] }]
      : [],
    orderedLevelIds: [...(opts.levelIds ?? [])],
  };
  return normalizeManifest(base);
}

const freeWorldId = (m: CampaignManifest): string => {
  const used = new Set(m.worlds.map((w) => w.id));
  for (let n = 1; ; n += 1) {
    const id = `world-${n}`;
    if (!used.has(id)) return id;
  }
};

// ── worlds ─────────────────────────────────────────────────────────────────

export function addWorld(m: CampaignManifest, opts: { id?: string; title?: string; themeId?: string } = {}): CampaignManifest {
  const id = opts.id ?? freeWorldId(m);
  if (m.worlds.some((w) => w.id === id)) return m;
  const world: CampaignWorld = {
    id,
    title: opts.title ?? `World ${m.worlds.length + 1}`,
    order: m.worlds.length,
    levelIds: [],
    ...(opts.themeId ? { themeId: opts.themeId } : {}),
  };
  return normalizeManifest({ ...m, worlds: [...m.worlds, world] });
}

export function renameWorld(m: CampaignManifest, worldId: string, title: string): CampaignManifest {
  return normalizeManifest({
    ...m,
    worlds: m.worlds.map((w) => (w.id === worldId ? { ...w, title } : w)),
  });
}

export function setWorldTheme(m: CampaignManifest, worldId: string, themeId: string | undefined): CampaignManifest {
  return normalizeManifest({
    ...m,
    worlds: m.worlds.map((w) => {
      if (w.id !== worldId) return w;
      const next = { ...w };
      if (themeId && themeId.trim() !== '') next.themeId = themeId;
      else delete next.themeId;
      return next;
    }),
  });
}

/** Move a world one slot earlier / later in the campaign. */
export function reorderWorld(m: CampaignManifest, worldId: string, direction: -1 | 1): CampaignManifest {
  const sorted = [...m.worlds].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((w) => w.id === worldId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= sorted.length) return m;
  [sorted[i]!.order, sorted[j]!.order] = [sorted[j]!.order, sorted[i]!.order];
  return normalizeManifest({ ...m, worlds: sorted });
}

/** Remove a world; its levels become unassigned (still in `orderedLevelIds`). */
export function removeWorld(m: CampaignManifest, worldId: string): CampaignManifest {
  const world = m.worlds.find((w) => w.id === worldId);
  if (!world) return m;
  return normalizeManifest({
    ...m,
    worlds: m.worlds.filter((w) => w.id !== worldId),
    orderedLevelIds: [...m.orderedLevelIds, ...world.levelIds.filter((id) => !m.orderedLevelIds.includes(id))],
  });
}

// ── level ↔ world ──────────────────────────────────────────────────────────

/** Assign a level to a world (removing it from any other), appended by default. */
export function assignLevel(m: CampaignManifest, levelId: number, worldId: string, index?: number): CampaignManifest {
  if (!m.worlds.some((w) => w.id === worldId)) return m;
  const worlds = m.worlds.map((w) => {
    const without = w.levelIds.filter((id) => id !== levelId);
    if (w.id !== worldId) return { ...w, levelIds: without };
    const at = index === undefined ? without.length : Math.max(0, Math.min(without.length, index));
    return { ...w, levelIds: [...without.slice(0, at), levelId, ...without.slice(at)] };
  });
  const orderedLevelIds = m.orderedLevelIds.includes(levelId) ? m.orderedLevelIds : [...m.orderedLevelIds, levelId];
  return normalizeManifest({ ...m, worlds, orderedLevelIds });
}

export function unassignLevel(m: CampaignManifest, levelId: number): CampaignManifest {
  return normalizeManifest({
    ...m,
    worlds: m.worlds.map((w) => ({ ...w, levelIds: w.levelIds.filter((id) => id !== levelId) })),
  });
}

/** Remove a level from the manifest entirely (worlds + global order). */
export function removeLevel(m: CampaignManifest, levelId: number): CampaignManifest {
  return normalizeManifest({
    ...m,
    worlds: m.worlds.map((w) => ({ ...w, levelIds: w.levelIds.filter((id) => id !== levelId) })),
    orderedLevelIds: m.orderedLevelIds.filter((id) => id !== levelId),
  });
}

export const moveLevelBetweenWorlds = assignLevel;

/** Reorder a level within its world. */
export function reorderLevelInWorld(m: CampaignManifest, worldId: string, levelId: number, direction: -1 | 1): CampaignManifest {
  const world = m.worlds.find((w) => w.id === worldId);
  if (!world) return m;
  const ids = [...world.levelIds];
  const i = ids.indexOf(levelId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= ids.length) return m;
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  return normalizeManifest({
    ...m,
    worlds: m.worlds.map((w) => (w.id === worldId ? { ...w, levelIds: ids } : w)),
  });
}

// ── queries ────────────────────────────────────────────────────────────────

export function worldOfLevel(m: CampaignManifest, levelId: number): CampaignWorld | undefined {
  return m.worlds.find((w) => w.levelIds.includes(levelId));
}

/** Level ids the manifest knows about but has not placed in a world. */
export function unassignedLevelIds(m: CampaignManifest): number[] {
  const assigned = new Set(m.worlds.flatMap((w) => w.levelIds));
  return m.orderedLevelIds.filter((id) => !assigned.has(id));
}
