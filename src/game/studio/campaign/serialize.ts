/**
 * Deterministic campaign-manifest serialisation. Fixed field order, worlds by
 * `order`, level-id lists as authored, no timestamps — the same logical
 * manifest always produces the same bytes.
 */
import { normalizeManifest } from './manifest';
import type { CampaignManifest, CampaignWorld } from './types';

function orderWorld(w: CampaignWorld): CampaignWorld {
  const out: CampaignWorld = { id: w.id, title: w.title, order: w.order, levelIds: [...w.levelIds] };
  if (w.themeId) out.themeId = w.themeId;
  if (w.display && (w.display.subtitle || w.display.accent)) {
    out.display = {};
    if (w.display.subtitle) out.display.subtitle = w.display.subtitle;
    if (w.display.accent) out.display.accent = w.display.accent;
  }
  return out;
}

/** Canonical manifest object with a fixed key order. */
export function canonicalManifest(manifest: CampaignManifest): CampaignManifest {
  const m = normalizeManifest(manifest);
  return {
    campaignVersion: m.campaignVersion,
    worlds: m.worlds.map(orderWorld),
    orderedLevelIds: [...m.orderedLevelIds],
  };
}

export function serializeManifestJSON(manifest: CampaignManifest): string {
  return JSON.stringify(canonicalManifest(manifest), null, 2) + '\n';
}

/** A paste-ready TS literal in the style of `src/game/levels/campaign.ts`. */
export function serializeManifestTS(manifest: CampaignManifest): string {
  const m = canonicalManifest(manifest);
  const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const lines: string[] = [];
  lines.push('{');
  lines.push(`  campaignVersion: ${m.campaignVersion},`);
  lines.push('  worlds: [');
  for (const w of m.worlds) {
    const parts = [`id: ${q(w.id)}`, `title: ${q(w.title)}`, `order: ${w.order}`];
    if (w.themeId) parts.push(`themeId: ${q(w.themeId)}`);
    lines.push(`    { ${parts.join(', ')},`);
    lines.push(`      levelIds: [${w.levelIds.join(', ')}] },`);
  }
  lines.push('  ],');
  lines.push(`  orderedLevelIds: [${m.orderedLevelIds.join(', ')}],`);
  lines.push('}');
  return lines.join('\n') + '\n';
}
