import { resolveReveal, revealTimeline } from '../revealGeometry';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import { requireLevel } from '../../levels/levels';
import type { LevelDefinition } from '../../engine/types';

const AUTHORED_IDS = LEVEL_DEFINITIONS.filter((l) => l.reveal).map((l) => l.id);

test('at least a few levels ship an authored reveal, and it is parsed verbatim', () => {
  expect(AUTHORED_IDS.length).toBeGreaterThanOrEqual(3);
  for (const id of AUTHORED_IDS) {
    const level = requireLevel(id);
    const authored = level.reveal!;
    const r = resolveReveal(level);
    expect(r.source).toBe('authored');
    expect(r.name).toBe(authored.name);
    expect(r.nodes).toEqual(authored.nodes.map((n) => ({ x: n.x, y: n.y })));
    expect(r.lines).toEqual(authored.lines);
    expect(r.accentNodes).toEqual(authored.accentNodes ?? []);
    // Every line references a real node.
    for (const [a, b] of r.lines) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(r.nodes.length);
      expect(a).not.toBe(b);
    }
  }
});

test('invalid authored data falls back instead of rendering broken geometry', () => {
  const broken: LevelDefinition = {
    ...requireLevel(1),
    reveal: { name: 'BROKEN', nodes: [{ x: 0, y: 0 }, { x: 1, y: 1 }], lines: [[0, 5]] },
  };
  expect(resolveReveal(broken).source).toBe('fallback');

  const tooFew: LevelDefinition = {
    ...requireLevel(1),
    reveal: { name: 'BROKEN', nodes: [{ x: 0, y: 0 }], lines: [] },
  };
  expect(resolveReveal(tooFew).source).toBe('fallback');
});

test('the silhouette fallback is fully deterministic and never random', () => {
  for (const level of LEVEL_DEFINITIONS) {
    if (level.reveal) continue;
    const a = resolveReveal(level);
    const b = resolveReveal(level);
    expect(a).toEqual(b);
    expect(a.source).toBe('fallback');
    expect(a.name).toBe(level.title.toUpperCase());
    expect(a.nodes.length).toBeGreaterThanOrEqual(3);
    expect(a.nodes.length).toBeLessThanOrEqual(8);
    // Closed outline: one line per node.
    expect(a.lines).toHaveLength(a.nodes.length);
    for (const [i, j] of a.lines) {
      expect(Number.isInteger(i) && Number.isInteger(j)).toBe(true);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(j).toBeLessThan(a.nodes.length);
    }
    for (const n of a.nodes) {
      expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true);
    }
    expect(a.accentNodes).toHaveLength(1);
  }
});

test('empty artwork still yields a minimal deterministic reveal, not a crash', () => {
  const blank: LevelDefinition = {
    id: 999, title: 'Void', themeId: 't', difficulty: 'easy', holdingCapacity: 3,
    pixelArt: ['...', '...', '...'],
    tunnels: [[{ color: 'white', capacity: 1 }], [], []],
  };
  const r = resolveReveal(blank);
  expect(r.source).toBe('fallback');
  expect(r.nodes).toHaveLength(3);
  expect(r.lines).toHaveLength(3);
  expect(resolveReveal(blank)).toEqual(r);
});

test('reveal timeline keeps its beats ordered and NEXT usable before the tail ends', () => {
  const full = revealTimeline(false);
  expect(full.settleMs).toBeLessThanOrEqual(full.nodesStartMs);
  expect(full.nodesStartMs).toBeLessThan(full.nodesEndMs);
  expect(full.linesStartMs).toBeLessThan(full.linesEndMs);
  expect(full.titleMs).toBeLessThan(full.titleEndMs);
  expect(full.nextVisibleMs).toBeLessThanOrEqual(full.nextInteractiveMs);
  expect(full.nextInteractiveMs).toBeLessThan(full.tailMs);
  // Within the approved windows.
  expect(full.titleMs).toBeGreaterThanOrEqual(700);
  expect(full.titleMs).toBeLessThanOrEqual(1100);
  expect(full.nextInteractiveMs).toBeGreaterThanOrEqual(1200);
  expect(full.nextInteractiveMs).toBeLessThanOrEqual(1400);
  expect(full.tailMs).toBeGreaterThanOrEqual(3000);
  expect(full.tailMs).toBeLessThanOrEqual(3400);
});

test('reduced-motion timeline is short: fast NEXT, lines fade rather than draw', () => {
  const r = revealTimeline(true);
  const f = revealTimeline(false);
  expect(r.tailMs).toBeLessThan(f.tailMs / 2);
  expect(r.nextInteractiveMs).toBeLessThan(700);
  // Lines "appear" quickly instead of a long draw.
  expect(r.linesEndMs - r.linesStartMs).toBeLessThan(f.linesEndMs - f.linesStartMs);
  expect(r.titleMs).toBeLessThan(f.titleMs);
});
