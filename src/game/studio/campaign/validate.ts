/**
 * Campaign-manifest validation. Pure. Errors mean the manifest cannot ship as
 * authored; warnings are design signals.
 */
import { CAMPAIGN_SCHEMA_VERSION } from '../constants';
import { normalizeManifest, unassignedLevelIds } from './manifest';
import type { CampaignManifest, ManifestIssue, ManifestReport } from './types';

export function validateManifest(manifest: CampaignManifest, knownLevelIds: number[]): ManifestReport {
  const errors: ManifestIssue[] = [];
  const warnings: ManifestIssue[] = [];
  const err = (i: Omit<ManifestIssue, 'severity'>) => errors.push({ ...i, severity: 'error' });
  const warn = (i: Omit<ManifestIssue, 'severity'>) => warnings.push({ ...i, severity: 'warning' });
  const known = new Set(knownLevelIds);

  if (!Number.isInteger(manifest.campaignVersion) || manifest.campaignVersion < 1) {
    err({ code: 'manifest/version', message: `campaignVersion must be a positive integer (got ${String(manifest.campaignVersion)}).`, where: { kind: 'manifest' } });
  } else if (manifest.campaignVersion > CAMPAIGN_SCHEMA_VERSION) {
    warn({ code: 'manifest/version-ahead', message: `Manifest campaignVersion ${manifest.campaignVersion} is newer than this Studio (${CAMPAIGN_SCHEMA_VERSION}).`, where: { kind: 'manifest' } });
  }

  // World ids.
  const worldIds = new Set<string>();
  for (const w of manifest.worlds) {
    if (worldIds.has(w.id)) err({ code: 'manifest/dup-world-id', message: `Duplicate world id "${w.id}".`, where: { kind: 'world', worldId: w.id } });
    worldIds.add(w.id);
    if (w.title.trim() === '') warn({ code: 'manifest/world-title', message: `World "${w.id}" has no title.`, where: { kind: 'world', worldId: w.id } });
    if (w.levelIds.length === 0) warn({ code: 'manifest/empty-world', message: `World "${w.title || w.id}" has no levels.`, where: { kind: 'world', worldId: w.id } });
  }

  // Level ids: duplicates across worlds, unknown ids, unassigned known ids.
  const placement = new Map<number, string[]>();
  for (const w of manifest.worlds) {
    for (const id of w.levelIds) {
      placement.set(id, [...(placement.get(id) ?? []), w.id]);
      if (!known.has(id)) {
        err({ code: 'manifest/missing-level', message: `World "${w.title || w.id}" references level ${id}, which does not exist.`, where: { kind: 'level', levelId: id } });
      }
    }
  }
  for (const [id, worlds] of placement) {
    if (worlds.length > 1) {
      err({ code: 'manifest/dup-level', message: `Level ${id} is assigned to ${worlds.length} worlds (${worlds.join(', ')}).`, where: { kind: 'level', levelId: id } });
    }
  }
  for (const id of knownLevelIds) {
    if (!placement.has(id)) {
      warn({ code: 'manifest/unassigned-level', message: `Level ${id} is not assigned to any world.`, where: { kind: 'level', levelId: id } });
    }
  }

  // orderedLevelIds integrity (against a normalised copy).
  const normalized = normalizeManifest(manifest);
  if (JSON.stringify(normalized.orderedLevelIds) !== JSON.stringify(manifest.orderedLevelIds)) {
    warn({ code: 'manifest/order-stale', message: 'orderedLevelIds is out of sync with the worlds; it will be recomputed on save.', where: { kind: 'manifest' } });
  }
  const orderSet = new Set(manifest.orderedLevelIds);
  if (orderSet.size !== manifest.orderedLevelIds.length) {
    err({ code: 'manifest/order-dup', message: 'orderedLevelIds contains a duplicate id.', where: { kind: 'manifest' } });
  }
  for (const id of unassignedLevelIds(manifest)) {
    if (!known.has(id)) {
      err({ code: 'manifest/order-unknown', message: `orderedLevelIds lists level ${id}, which does not exist.`, where: { kind: 'level', levelId: id } });
    }
  }

  return { errors, warnings, ok: errors.length === 0 };
}
