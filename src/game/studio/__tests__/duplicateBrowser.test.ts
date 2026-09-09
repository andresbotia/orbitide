import { createGame } from '../../engine/createGame';
import { CAMPAIGN_MANIFEST } from '../../levels/campaign';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import { buildBrowserRows, filterRows, sortRows } from '../browser';
import { createVariation, duplicateLevel } from '../duplicate';
import { addCharge, createBlankLevel, paintCell } from '../model';
import { setModifier } from '../modifiers';
import { ensureReveal, addRevealNode } from '../reveal';
import { fromLevelDefinition, toLevelDefinition } from '../serialize';
import type { StudioLevel } from '../types';

function rich(): StudioLevel {
  let level = createBlankLevel({ id: 3, width: 5, height: 1, title: 'Base' });
  for (let x = 0; x < 4; x += 1) level = paintCell(level, x, 0, 'white');
  level = addCharge(level, 0, { color: 'white', capacity: 4 });
  level = setModifier(level, 0, 0, 'frozen');
  level = ensureReveal(level, 'THE BASE');
  level = addRevealNode(level, 0, 0);
  level = addRevealNode(level, 3, 0);
  return level;
}

describe('duplicateLevel', () => {
  test('new id + title, deep copy of artwork / tunnels / modifiers / reveal, provenance', () => {
    const dup = duplicateLevel(rich(), { id: 42, title: 'Copy' });
    expect(dup.id).toBe(42);
    expect(dup.title).toBe('Copy');
    expect(dup.source).toEqual({ kind: 'duplicate', sourceLevelId: 3 });
    expect(dup.cells).toEqual(rich().cells);
    expect(dup.modifiers).toEqual(rich().modifiers);
    expect(dup.reveal).toEqual(rich().reveal);
    // deep, not shared
    expect(dup.modifiers).not.toBe(rich().modifiers);
  });

  test('opt-outs drop the chosen parts', () => {
    const dup = duplicateLevel(rich(), { id: 42, preserveReveal: false, preserveModifiers: false, preserveTunnels: false });
    expect(dup.reveal).toBeUndefined();
    expect(dup.modifiers).toBeUndefined();
    expect(dup.tunnels).toEqual([[], [], []]);
    expect(dup.cells).toEqual(rich().cells); // artwork kept
  });

  test('provenance never reaches the exported LevelDefinition', () => {
    const dup = duplicateLevel(rich(), { id: 42 });
    expect('source' in toLevelDefinition(dup)).toBe(false);
  });
});

describe('createVariation', () => {
  test('keeps artwork + reveal, tags provenance as variation', () => {
    const v = createVariation(rich(), { id: 50, note: 'harder queues' });
    expect(v.source).toEqual({ kind: 'variation', sourceLevelId: 3, note: 'harder queues' });
    expect(v.cells).toEqual(rich().cells);
    expect(v.reveal).toEqual(rich().reveal);
  });
});

describe('level browser', () => {
  const defs = LEVEL_DEFINITIONS;

  test('one row per level, no solver required', () => {
    const rows = buildBrowserRows(defs, CAMPAIGN_MANIFEST);
    expect(rows).toHaveLength(defs.length);
    for (const r of rows) {
      expect(r.status).toBe('ok');
      expect(r.worldId).toBe('first-light');
      expect(r.pixelCount).toBe(createGame(defs[r.id - 1]!).pixels.length);
      expect(r.suggestedDifficulty).toBeNull(); // no analysis supplied
    }
  });

  test('merges an on-demand analysis slice', () => {
    const rows = buildBrowserRows(defs, CAMPAIGN_MANIFEST, new Map([
      [6, { suggestedDifficulty: 'hard' as const, solvable: true as const, warningCount: 2 }],
    ]));
    const r6 = rows.find((r) => r.id === 6)!;
    expect(r6.suggestedDifficulty).toBe('hard');
    expect(r6.difficultyMismatch).toBe(true); // authored easy
    expect(r6.warningCount).toBeGreaterThanOrEqual(2);
  });

  test('search / filter / sort are pure list transforms', () => {
    const rows = buildBrowserRows(defs, CAMPAIGN_MANIFEST);
    expect(filterRows(rows, { query: 'moon' }).map((r) => r.id)).toEqual([1]);
    expect(filterRows(rows, { difficulty: 'hard' }).map((r) => r.id)).toEqual([10]);
    expect(filterRows(rows, { status: 'error' })).toEqual([]);

    const byTitle = sortRows(rows, 'title');
    expect(byTitle[0]!.title <= byTitle[1]!.title).toBe(true);
    const byIdDesc = sortRows(rows, 'id', 'desc');
    expect(byIdDesc[0]!.id).toBe(10);
  });

  test('an invalid level shows status "error"', () => {
    const broken = toLevelDefinition({ ...fromLevelDefinition(defs[0]!), tunnels: [[], [], []] });
    const rows = buildBrowserRows([broken]);
    expect(rows[0]!.status).toBe('error');
    expect(rows[0]!.errorCount).toBeGreaterThan(0);
  });

  test('a level in no manifest is unassigned', () => {
    const rows = buildBrowserRows(defs); // no manifest
    expect(rows.every((r) => r.worldId === null && r.worldIndex === -1)).toBe(true);
    expect(filterRows(rows, { worldId: 'unassigned' })).toHaveLength(defs.length);
  });
});
