import { CAMPAIGN_MANIFEST } from '../../levels/campaign';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import { CAMPAIGN_SCHEMA_VERSION, STUDIO_SCHEMA_VERSION } from '../constants';
import { batchValidate } from '../batchValidate';
import { addWorld, createManifest } from '../campaign/manifest';
import {
  exportCampaignBundle, exportLevelsJSON, exportLevelsTS, importStudioJSON,
} from '../io';

describe('batchValidate', () => {
  test('the shipped campaign + manifest is clean', () => {
    const r = batchValidate({ defs: LEVEL_DEFINITIONS, manifest: CAMPAIGN_MANIFEST });
    expect(r.levels.filter((level) => !level.ok).map((level) => ({
      id: level.levelId, codes: level.errors.map((issue) => issue.code),
    }))).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.summary.invalid).toBe(0);
    expect(r.campaignIssues).toEqual([]);
    expect(r.manifestIssues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  test('detects duplicate level ids', () => {
    const r = batchValidate({ defs: [...LEVEL_DEFINITIONS, { ...LEVEL_DEFINITIONS[0]! }] });
    expect(r.campaignIssues.map((i) => i.code)).toContain('batch/dup-level-id');
    expect(r.ok).toBe(false);
  });

  test('flags levels missing from the manifest and unassigned levels', () => {
    const manifest = createManifest({ levelIds: [1, 2, 3] });
    const r = batchValidate({ defs: LEVEL_DEFINITIONS, manifest });
    const codes = r.manifestIssues.map((i) => i.code);
    expect(codes).toContain('manifest/unassigned-level');
  });

  test('merges an analysis slice for unsolvable + difficulty mismatch', () => {
    const r = batchValidate({
      defs: LEVEL_DEFINITIONS,
      analyses: new Map([
        [3, { solvable: false as const }],
        [6, { difficultyMismatchTiers: 2, suggestedDifficulty: 'hard' as const }],
      ]),
    });
    expect(r.summary.unsolvable).toBe(1);
    expect(r.summary.difficultyMismatches).toBe(1);
    expect(r.levels.find((l) => l.levelId === 3)!.ok).toBe(false);
  });

  test('scopeLevelIds restricts the run deterministically', () => {
    const r = batchValidate({ defs: LEVEL_DEFINITIONS, scopeLevelIds: [10, 2, 5] });
    expect(r.levels.map((l) => l.levelId)).toEqual([2, 5, 10]);
  });

  test('catches duplicate and mismatched raw Linked member references', () => {
    const base = LEVEL_DEFINITIONS[0]!;
    const malformed = {
      ...base,
      modifiers: {
        '0,0': { kind: 'linked' as const, group: 'pair-a', linkId: 'pair-a',
          linkedPixelIds: [`L${base.id}-p1-0`, `L${base.id}-p1-0`] },
        '1,0': { kind: 'linked' as const, group: 'pair-a', linkId: 'pair-a' },
      },
    };
    const result = batchValidate({ defs: [malformed] });
    expect(result.levels[0]!.errors.map((issue) => issue.code)).toContain('modifier/linked-duplicate-reference');
    expect(importStudioJSON(JSON.stringify(malformed)).ok).toBe(false);
  });
});

describe('export', () => {
  test('exportLevelsJSON is canonical, ordered and deterministic', () => {
    const shuffled = [LEVEL_DEFINITIONS[3]!, LEVEL_DEFINITIONS[0]!, LEVEL_DEFINITIONS[9]!];
    const json = exportLevelsJSON(shuffled);
    expect(json).toBe(exportLevelsJSON([...shuffled].reverse()));
    expect(JSON.parse(json).map((l: { id: number }) => l.id)).toEqual([1, 4, 10]);
  });

  test('exportLevelsTS emits an array literal', () => {
    const ts = exportLevelsTS([LEVEL_DEFINITIONS[0]!, LEVEL_DEFINITIONS[1]!]);
    expect(ts.trim().startsWith('[')).toBe(true);
    expect(ts.trim().endsWith(']')).toBe(true);
    expect(ts).toContain(`title: '${LEVEL_DEFINITIONS[0]!.title}'`);
  });

  test('exportCampaignBundle carries both schema versions and is deterministic', () => {
    const bundle = exportCampaignBundle(CAMPAIGN_MANIFEST, LEVEL_DEFINITIONS);
    const parsed = JSON.parse(bundle);
    expect(parsed.studioVersion).toBe(STUDIO_SCHEMA_VERSION);
    expect(parsed.campaignVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    expect(parsed.levels).toHaveLength(LEVEL_DEFINITIONS.length);
    expect(bundle).toBe(exportCampaignBundle(CAMPAIGN_MANIFEST, LEVEL_DEFINITIONS));
    expect(bundle).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('import', () => {
  test('round-trips an exported bundle', () => {
    const bundle = exportCampaignBundle(CAMPAIGN_MANIFEST, LEVEL_DEFINITIONS);
    const result = importStudioJSON(bundle);
    expect(result.ok).toBe(true);
    expect(result.levels.map((l) => l.id)).toEqual(LEVEL_DEFINITIONS.map((l) => l.id));
    expect(result.manifest?.worlds[0]?.id).toBe('first-light');
  });

  test('accepts a single level object and an array', () => {
    const one = importStudioJSON(JSON.stringify(LEVEL_DEFINITIONS[0]));
    expect(one.ok).toBe(true);
    expect(one.levels).toHaveLength(1);
    const many = importStudioJSON(exportLevelsJSON(LEVEL_DEFINITIONS.slice(0, 3)));
    expect(many.levels).toHaveLength(3);
  });

  test('rejects non-JSON and bad shapes without throwing', () => {
    expect(importStudioJSON('export const X = 1').ok).toBe(false);
    expect(importStudioJSON('{"nope": true}').ok).toBe(false);
    expect(importStudioJSON('[{"id": 1}]').ok).toBe(false); // missing pixelArt/tunnels
  });

  test('rejects a level the engine will not accept', () => {
    const bad = { ...LEVEL_DEFINITIONS[0]!, tunnels: [[]] };
    const r = importStudioJSON(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/rejected|tunnels/i);
  });

  test('warns but still imports when the bundle version is ahead', () => {
    const m = addWorld(createManifest({ levelIds: [1] }), { title: 'x' });
    const ahead = JSON.stringify({
      studioVersion: STUDIO_SCHEMA_VERSION + 5,
      campaignVersion: CAMPAIGN_SCHEMA_VERSION,
      manifest: m,
      levels: [LEVEL_DEFINITIONS[0]],
    });
    const r = importStudioJSON(ahead);
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => /newer than this Studio/.test(w))).toBe(true);
  });
});
