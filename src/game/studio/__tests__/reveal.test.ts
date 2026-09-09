import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import { addCharge, createBlankLevel, paintCell } from '../model';
import {
  addRevealLine, addRevealNode, clearReveal, deleteRevealLine, deleteRevealNode,
  ensureReveal, isRevealEmpty, moveRevealNode, reorderRevealNode, setRevealCollectionId,
  setRevealName, toggleAccentNode, toggleRevealLine,
} from '../reveal';
import { fromLevelDefinition, serializeToJSON, toLevelDefinition } from '../serialize';
import { validateStudioLevel } from '../validate';
import type { StudioLevel } from '../types';

function tiny(): StudioLevel {
  let level = createBlankLevel({ width: 7, height: 7 });
  level = paintCell(level, 3, 3, 'white');
  level = addCharge(level, 0, { color: 'white', capacity: 1 });
  return level;
}

describe('authoring a reveal from scratch', () => {
  test('ensure → name → nodes → lines → accent', () => {
    let level = ensureReveal(tiny(), 'THE KITE');
    expect(level.reveal).toEqual({ name: 'THE KITE', nodes: [], lines: [] });

    level = addRevealNode(level, 3, 0);
    level = addRevealNode(level, 5, 3);
    level = addRevealNode(level, 3, 6);
    level = addRevealNode(level, 1, 3);
    level = addRevealLine(level, 0, 1);
    level = toggleRevealLine(level, 1, 2);
    level = toggleRevealLine(level, 2, 3);
    level = toggleRevealLine(level, 3, 0);
    expect(level.reveal!.lines).toEqual([[0, 1], [1, 2], [2, 3], [3, 0]]);

    level = toggleAccentNode(level, 0);
    expect(level.reveal!.accentNodes).toEqual([0]);

    const r = validateStudioLevel(level);
    expect(r.errors).toEqual([]);
    expect(r.exportable).toBe(true);
  });

  test('toggleRevealLine removes an existing pair and ignores self / bad refs', () => {
    let level = ensureReveal(tiny());
    level = addRevealNode(level, 0, 0);
    level = addRevealNode(level, 1, 1);
    level = toggleRevealLine(level, 0, 1);
    level = toggleRevealLine(level, 1, 0); // same unordered pair → removes it
    expect(level.reveal!.lines).toEqual([]);
    expect(toggleRevealLine(level, 0, 0)).toBe(level); // self-line ignored
    expect(toggleRevealLine(level, 0, 9)).toBe(level); // missing node ignored
  });
});

describe('deleting / reordering nodes keeps references consistent', () => {
  function graph(): StudioLevel {
    let level = ensureReveal(tiny(), 'G');
    level = addRevealNode(level, 0, 0); // 0
    level = addRevealNode(level, 1, 0); // 1
    level = addRevealNode(level, 2, 0); // 2
    level = addRevealNode(level, 3, 0); // 3
    level = addRevealLine(level, 0, 1);
    level = addRevealLine(level, 1, 2);
    level = addRevealLine(level, 2, 3);
    level = toggleAccentNode(level, 2);
    return level;
  }

  test('deleteRevealNode drops touching lines and re-indexes the rest', () => {
    const level = deleteRevealNode(graph(), 1);
    expect(level.reveal!.nodes).toHaveLength(3);
    // lines [0,1] and [1,2] touched node 1 → gone; [2,3] re-indexed to [1,2]
    expect(level.reveal!.lines).toEqual([[1, 2]]);
    // accent was node 2 → now node 1
    expect(level.reveal!.accentNodes).toEqual([1]);
  });

  test('reorderRevealNode swaps and follows references', () => {
    const level = reorderRevealNode(graph(), 0, 1); // swap nodes 0 and 1
    expect(level.reveal!.nodes[0]).toEqual({ x: 1, y: 0 });
    expect(level.reveal!.lines).toEqual([[1, 0], [0, 2], [2, 3]]);
    expect(level.reveal!.accentNodes).toEqual([2]);
  });

  test('deleteRevealLine by index', () => {
    const level = deleteRevealLine(graph(), 1);
    expect(level.reveal!.lines).toEqual([[0, 1], [2, 3]]);
  });

  test('moveRevealNode repositions in place', () => {
    const level = moveRevealNode(graph(), 0, 6, 6);
    expect(level.reveal!.nodes[0]).toEqual({ x: 6, y: 6 });
  });
});

describe('validation', () => {
  const codes = (l: StudioLevel) => validateStudioLevel(l).errors.map((i) => i.code);
  const warns = (l: StudioLevel) => validateStudioLevel(l).warnings.map((i) => i.code);

  test('line to a missing node / self-line / duplicate line are errors', () => {
    let level = ensureReveal(tiny(), 'X');
    level = addRevealNode(level, 0, 0);
    level = addRevealNode(level, 1, 1);
    level = { ...level, reveal: { ...level.reveal!, lines: [[0, 1], [1, 0], [0, 5], [1, 1]] } };
    const c = codes(level);
    expect(c).toContain('reveal/dup-line');
    expect(c).toContain('reveal/line-ref');
    expect(c).toContain('reveal/self-line');
  });

  test('accent pointing at a missing node is an error', () => {
    let level = ensureReveal(tiny(), 'X');
    level = addRevealNode(level, 0, 0);
    level = { ...level, reveal: { ...level.reveal!, accentNodes: [5] } };
    expect(codes(level)).toContain('reveal/accent-ref');
  });

  test('no name / duplicate node position are warnings only', () => {
    let level = ensureReveal(tiny(), '');
    level = addRevealNode(level, 2, 2);
    level = addRevealNode(level, 2, 2);
    const w = warns(level);
    expect(w).toContain('reveal/name');
    expect(w).toContain('reveal/dup-node');
    expect(validateStudioLevel(level).exportable).toBe(true);
  });
});

describe('serialisation compatibility', () => {
  test('clearReveal removes it entirely; an empty reveal never serialises', () => {
    let level = ensureReveal(tiny());
    expect(isRevealEmpty(level.reveal)).toBe(true);
    expect(toLevelDefinition(level).reveal).toBeUndefined();
    level = clearReveal(level);
    expect(level.reveal).toBeUndefined();
  });

  test('setRevealCollectionId adds / clears the field', () => {
    let level = ensureReveal(tiny(), 'X');
    level = addRevealNode(level, 0, 0);
    level = addRevealNode(level, 1, 1);
    level = setRevealName(level, 'THE X');
    level = setRevealCollectionId(level, 'first-light');
    expect(toLevelDefinition(level).reveal!.collectionId).toBe('first-light');
    level = setRevealCollectionId(level, undefined);
    expect(toLevelDefinition(level).reveal!.collectionId).toBeUndefined();
  });

  test('Levels 1–10 with authored reveals still serialise byte-for-byte', () => {
    for (const def of LEVEL_DEFINITIONS) {
      const back = toLevelDefinition(fromLevelDefinition(def));
      expect(back.reveal).toEqual(def.reveal);
      expect(serializeToJSON(fromLevelDefinition(back))).toBe(serializeToJSON(fromLevelDefinition(def)));
    }
  });
});
