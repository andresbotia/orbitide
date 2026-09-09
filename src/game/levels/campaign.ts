import { CAMPAIGN_SCHEMA_VERSION } from '@/game/studio/constants';
import type { CampaignManifest } from '@/game/studio/campaign/types';
import { LEVEL_DEFINITIONS } from './levelDefinitions';

/**
 * The M1 campaign manifest: the ten handcrafted levels as one themed set.
 * This is authoring / campaign-organisation data — it is NOT read by the engine
 * and carries no solver output. Larger campaigns add worlds here (or author them
 * in Level Studio and export a replacement).
 */
export const CAMPAIGN_MANIFEST: CampaignManifest = {
  campaignVersion: CAMPAIGN_SCHEMA_VERSION,
  worlds: [
    {
      id: 'first-light',
      title: 'First Light',
      order: 0,
      themeId: 'first-light',
      levelIds: LEVEL_DEFINITIONS.map((l) => l.id),
    },
  ],
  orderedLevelIds: LEVEL_DEFINITIONS.map((l) => l.id),
};
