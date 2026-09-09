import { CAMPAIGN_MANIFEST } from '../../levels/campaign';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import { CAMPAIGN_SCHEMA_VERSION } from '../constants';
import {
  addWorld, assignLevel, createManifest, moveLevelBetweenWorlds, normalizeManifest,
  removeLevel, removeWorld, renameWorld, reorderLevelInWorld, reorderWorld,
  unassignedLevelIds, worldOfLevel,
} from '../campaign/manifest';
import { serializeManifestJSON, serializeManifestTS } from '../campaign/serialize';
import { validateManifest } from '../campaign/validate';
import type { CampaignManifest } from '../campaign/types';

const KNOWN = LEVEL_DEFINITIONS.map((l) => l.id);

describe('the shipped campaign manifest', () => {
  test('is valid against Levels 1–10', () => {
    const r = validateManifest(CAMPAIGN_MANIFEST, KNOWN);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  test('orders every level exactly once', () => {
    expect([...CAMPAIGN_MANIFEST.orderedLevelIds].sort((a, b) => a - b)).toEqual(KNOWN);
  });

  test('is already normalised', () => {
    expect(normalizeManifest(CAMPAIGN_MANIFEST)).toEqual(CAMPAIGN_MANIFEST);
  });
});

describe('pure manifest operations', () => {
  let m: CampaignManifest;
  beforeEach(() => { m = createManifest({ worldTitle: 'Alpha', levelIds: [1, 2, 3] }); });

  test('createManifest seeds one world + the global order', () => {
    expect(m.worlds).toHaveLength(1);
    expect(m.worlds[0]!.levelIds).toEqual([1, 2, 3]);
    expect(m.orderedLevelIds).toEqual([1, 2, 3]);
    expect(m.campaignVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
  });

  test('addWorld / assignLevel moves a level and keeps it in one world', () => {
    m = addWorld(m, { title: 'Beta' });
    const beta = m.worlds[1]!.id;
    m = assignLevel(m, 2, beta);
    expect(m.worlds[0]!.levelIds).toEqual([1, 3]);
    expect(m.worlds[1]!.levelIds).toEqual([2]);
    expect(worldOfLevel(m, 2)!.id).toBe(beta);
    // orderedLevelIds follows world order
    expect(m.orderedLevelIds).toEqual([1, 3, 2]);
  });

  test('moveLevelBetweenWorlds honours an explicit index', () => {
    m = addWorld(m, { title: 'Beta' });
    m = assignLevel(m, 5, m.worlds[1]!.id); // 5 is unknown but manifest still tracks it
    m = assignLevel(m, 6, m.worlds[1]!.id);
    m = moveLevelBetweenWorlds(m, 6, m.worlds[1]!.id, 0);
    expect(m.worlds[1]!.levelIds).toEqual([6, 5]);
  });

  test('reorderWorld swaps campaign positions and rebuilds order', () => {
    m = addWorld(m, { title: 'Beta' });
    m = assignLevel(m, 2, m.worlds[1]!.id);
    m = reorderWorld(m, m.worlds[1]!.id, -1);
    expect(m.worlds.map((w) => w.title)).toEqual(['Beta', 'Alpha']);
    expect(m.orderedLevelIds).toEqual([2, 1, 3]);
  });

  test('reorderLevelInWorld is bounds-checked', () => {
    m = reorderLevelInWorld(m, m.worlds[0]!.id, 3, -1);
    expect(m.worlds[0]!.levelIds).toEqual([1, 3, 2]);
    expect(reorderLevelInWorld(m, m.worlds[0]!.id, 1, -1)).toBe(m); // already first
  });

  test('removeWorld unassigns its levels; removeLevel drops it everywhere', () => {
    m = addWorld(m, { title: 'Beta' });
    m = assignLevel(m, 3, m.worlds[1]!.id);
    m = removeWorld(m, m.worlds[1]!.id);
    expect(m.worlds).toHaveLength(1);
    expect(unassignedLevelIds(m)).toEqual([3]);

    m = removeLevel(m, 3);
    expect(m.orderedLevelIds).toEqual([1, 2]);
  });

  test('renameWorld', () => {
    m = renameWorld(m, m.worlds[0]!.id, 'Renamed');
    expect(m.worlds[0]!.title).toBe('Renamed');
  });
});

describe('validation', () => {
  const codes = (m: CampaignManifest) => {
    const r = validateManifest(m, KNOWN);
    return { e: r.errors.map((i) => i.code), w: r.warnings.map((i) => i.code) };
  };

  test('duplicate level across worlds is an error', () => {
    let m = createManifest({ levelIds: [1, 2] });
    m = addWorld(m, { title: 'B' });
    // force an invalid manifest (both worlds hold level 1)
    m = { ...m, worlds: [m.worlds[0]!, { ...m.worlds[1]!, levelIds: [1] }] };
    expect(codes(m).e).toContain('manifest/dup-level');
  });

  test('a world referencing a non-existent level is an error', () => {
    const m = createManifest({ levelIds: [1, 999] });
    expect(codes(m).e).toContain('manifest/missing-level');
  });

  test('a known level in no world is a warning', () => {
    const m = createManifest({ levelIds: [1, 2] });
    expect(codes(m).w).toContain('manifest/unassigned-level');
  });

  test('an empty world warns', () => {
    let m = createManifest({ levelIds: KNOWN });
    m = addWorld(m, { title: 'Empty' });
    expect(codes(m).w).toContain('manifest/empty-world');
  });
});

describe('deterministic serialisation', () => {
  test('JSON / TS are stable and timestamp-free', () => {
    const m = createManifest({ worldTitle: 'First Light', levelIds: KNOWN });
    const json = serializeManifestJSON(m);
    expect(json).toBe(serializeManifestJSON(m));
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(serializeManifestTS(m)).toContain('campaignVersion: 1,');
    expect(serializeManifestTS(m)).toContain('levelIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]');
  });

  test('logically equal manifests serialise identically regardless of world array order', () => {
    let a = createManifest({ levelIds: [] });
    a = addWorld(a, { id: 'w1', title: 'One' });
    a = addWorld(a, { id: 'w2', title: 'Two' });
    const b: CampaignManifest = { ...a, worlds: [a.worlds[1]!, a.worlds[0]!] };
    expect(serializeManifestJSON(a)).toBe(serializeManifestJSON(b));
  });
});
