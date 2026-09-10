import { CAMPAIGN_SCHEMA_VERSION } from '@/game/studio/constants';
import { normalizeManifest } from '@/game/studio/campaign/manifest';
import type { CampaignManifest, CampaignWorld } from '@/game/studio/campaign/types';
import { LEVEL_DEFINITIONS } from './levelDefinitions';

/**
 * The Pixel Arcadia campaign manifest: three themed worlds of ten levels each.
 * Authoring / campaign-organisation data only — it is NOT read by the engine and
 * carries no solver output. Each world's `levelIds` is filtered to the levels
 * that actually exist, so the manifest stays valid while a world is still being
 * authored.
 */
const WORLD_BLUEPRINT: Omit<CampaignWorld, 'order' | 'levelIds'>[] = [
  { id: 'first-light', title: 'First Light', themeId: 'first-light', display: { subtitle: 'Learn the light' } },
  { id: 'wild-garden', title: 'Wild Garden', themeId: 'wild-garden', display: { subtitle: 'The garden wakes' } },
  { id: 'deep-frost', title: 'Deep Frost', themeId: 'deep-frost', display: { subtitle: 'Break the ice' } },
  { id: 'curio-cabinet', title: 'Curio Cabinet', themeId: 'curio-cabinet', display: { subtitle: 'Treasures under glass' } },
  { id: 'prism-works', title: 'Prism Works', themeId: 'prism-works', display: { subtitle: 'Bend the light' } },
  { id: 'frostglass-forge', title: 'Frostglass Forge', themeId: 'frostglass-forge', display: { subtitle: 'Master ice and energy' } },
  { id: 'skybound', title: 'Skybound', themeId: 'skybound', display: { subtitle: 'Ride the upper winds' } },
  { id: 'tidal-depths', title: 'Tidal Depths', themeId: 'tidal-depths', display: { subtitle: 'Awaken the deep' } },
  { id: 'arcane-relics', title: 'Arcane Relics', themeId: 'arcane-relics', display: { subtitle: 'Bind the old magic' } },
];

const known = new Set(LEVEL_DEFINITIONS.map((l) => l.id));

export const CAMPAIGN_MANIFEST: CampaignManifest = normalizeManifest({
  campaignVersion: CAMPAIGN_SCHEMA_VERSION,
  worlds: WORLD_BLUEPRINT.map((w, order) => ({
    ...w,
    order,
    levelIds: LEVEL_DEFINITIONS.filter((l) => l.themeId === w.themeId && known.has(l.id)).map((l) => l.id),
  })).filter((w) => w.levelIds.length > 0),
  orderedLevelIds: LEVEL_DEFINITIONS.map((l) => l.id),
});
