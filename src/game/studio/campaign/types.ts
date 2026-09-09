/**
 * Campaign-manifest schema. Pure data — no React / RN. One deterministic
 * structure that groups authored levels into worlds / themed sets and pins the
 * global play order. It is NOT a gameplay {@link import('@/game/engine/types').LevelDefinition}
 * and never carries solver output. Designed to scale to thousands of levels
 * without a structural rewrite (flat id lists, no per-level duplication).
 */

export interface WorldDisplay {
  subtitle?: string;
  /** Free-form accent token for a future world-select screen. */
  accent?: string;
}

/** A themed set / world: an ordered list of level ids plus display metadata. */
export interface CampaignWorld {
  id: string;
  title: string;
  /** 0-based position in the campaign. Normalised to be contiguous + unique. */
  order: number;
  /** Level ids in this world, in play order. */
  levelIds: number[];
  /** Optional shared artwork/theme token (e.g. "first-light"). */
  themeId?: string;
  display?: WorldDisplay;
}

export interface CampaignManifest {
  /** {@link import('../constants').CAMPAIGN_SCHEMA_VERSION} at authoring time. */
  campaignVersion: number;
  worlds: CampaignWorld[];
  /**
   * Explicit global level order: every level the manifest knows about, worlds
   * in `order`, `levelIds` within each, then any manifest-known unassigned
   * level. Always derivable from `worlds` — kept materialised for consumers.
   */
  orderedLevelIds: number[];
}

export type ManifestIssueSeverity = 'error' | 'warning';

export interface ManifestIssue {
  code: string;
  severity: ManifestIssueSeverity;
  message: string;
  where?:
    | { kind: 'world'; worldId: string }
    | { kind: 'level'; levelId: number }
    | { kind: 'manifest' };
}

export interface ManifestReport {
  errors: ManifestIssue[];
  warnings: ManifestIssue[];
  ok: boolean;
}
