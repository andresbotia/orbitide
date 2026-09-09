import { useMemo, useState } from 'react';

import { CAMPAIGN_MANIFEST } from '@/game/levels/campaign';
import {
  addWorld, assignLevel, removeLevel, removeWorld, renameWorld, reorderLevelInWorld,
  reorderWorld, setWorldTheme, unassignLevel,
} from '@/game/studio/campaign/manifest';
import { validateManifest } from '@/game/studio/campaign/validate';
import type { CampaignManifest } from '@/game/studio/campaign/types';

/**
 * In-memory campaign-manifest editing for the Studio CAMPAIGN tab. Seeded from
 * the committed `CAMPAIGN_MANIFEST`; edits are held here and exported as
 * deterministic data (no backend — the developer commits the result).
 */
export function useCampaignManifest(knownLevelIds: number[]) {
  const [manifest, setManifest] = useState<CampaignManifest>(CAMPAIGN_MANIFEST);
  const report = useMemo(() => validateManifest(manifest, knownLevelIds), [manifest, knownLevelIds]);
  const apply = (fn: (m: CampaignManifest) => CampaignManifest) => setManifest(fn);

  return {
    manifest,
    report,
    reset: () => setManifest(CAMPAIGN_MANIFEST),
    addWorld: (title: string) => apply((m) => addWorld(m, { title })),
    removeWorld: (worldId: string) => apply((m) => removeWorld(m, worldId)),
    renameWorld: (worldId: string, title: string) => apply((m) => renameWorld(m, worldId, title)),
    setWorldTheme: (worldId: string, themeId: string | undefined) => apply((m) => setWorldTheme(m, worldId, themeId)),
    reorderWorld: (worldId: string, direction: -1 | 1) => apply((m) => reorderWorld(m, worldId, direction)),
    assignLevel: (levelId: number, worldId: string) => apply((m) => assignLevel(m, levelId, worldId)),
    unassignLevel: (levelId: number) => apply((m) => unassignLevel(m, levelId)),
    reorderLevelInWorld: (worldId: string, levelId: number, direction: -1 | 1) =>
      apply((m) => reorderLevelInWorld(m, worldId, levelId, direction)),
    removeLevel: (levelId: number) => apply((m) => removeLevel(m, levelId)),
  };
}

export type CampaignManifestController = ReturnType<typeof useCampaignManifest>;
