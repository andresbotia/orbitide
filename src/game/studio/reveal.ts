/**
 * Discovery-reveal AUTHORING model for the Level Studio. Pure — no React / RN.
 *
 * Edits the ONE existing reveal schema ({@link LevelReveal} on the engine): a
 * small constellation of `nodes` (cell coordinates, may be fractional), `lines`
 * (index pairs), optional `accentNodes` and a `collectionId`. There is no second
 * reveal model — `revealGeometry.ts` `resolveReveal()` consumes exactly this.
 *
 * Every operation is pure and keeps line / accent references consistent when
 * nodes are deleted or reordered.
 */
import type { LevelReveal } from '@/game/engine/types';
import type { StudioLevel } from './types';

const EMPTY: LevelReveal = { name: '', nodes: [], lines: [] };

/**
 * `true` when a reveal carries no constellation worth serialising — a bare
 * scaffold (name only, no geometry). The renderer needs ≥ 2 nodes anyway, so a
 * node-less reveal is dropped on export and the deterministic fallback is used.
 */
export function isRevealEmpty(reveal: LevelReveal | undefined): boolean {
  return !reveal || (reveal.nodes.length === 0 && reveal.lines.length === 0);
}

/** Deterministic deep copy, defined keys only (matches `serialize.cloneReveal`). */
export function cloneReveal(r: LevelReveal): LevelReveal {
  return {
    name: r.name,
    nodes: r.nodes.map((n) => ({ x: n.x, y: n.y })),
    lines: r.lines.map((l) => [l[0], l[1]] as [number, number]),
    ...(r.accentNodes && r.accentNodes.length > 0 ? { accentNodes: [...r.accentNodes].sort((a, b) => a - b) } : {}),
    ...(r.collectionId ? { collectionId: r.collectionId } : {}),
  };
}

const withReveal = (level: StudioLevel, reveal: LevelReveal): StudioLevel => {
  if (isRevealEmpty(reveal)) {
    if (!level.reveal) return level;
    const { reveal: _drop, ...rest } = level;
    return rest;
  }
  return { ...level, reveal: cloneReveal(reveal) };
};

const current = (level: StudioLevel): LevelReveal => level.reveal ?? EMPTY;

/** Start authoring a reveal (a named, empty constellation). */
export function ensureReveal(level: StudioLevel, name = level.title.toUpperCase()): StudioLevel {
  if (level.reveal) return level;
  return { ...level, reveal: { name, nodes: [], lines: [] } };
}

/** Stop authoring a reveal (drops it entirely — the renderer falls back). */
export function clearReveal(level: StudioLevel): StudioLevel {
  if (!level.reveal) return level;
  const { reveal: _drop, ...rest } = level;
  return rest;
}

export function setRevealName(level: StudioLevel, name: string): StudioLevel {
  return withReveal(level, { ...current(level), name });
}

export function setRevealCollectionId(level: StudioLevel, collectionId: string | undefined): StudioLevel {
  const r = { ...current(level) };
  if (collectionId && collectionId.trim() !== '') r.collectionId = collectionId;
  else delete r.collectionId;
  return withReveal(level, r);
}

// ── nodes ──────────────────────────────────────────────────────────────────

export function addRevealNode(level: StudioLevel, x: number, y: number): StudioLevel {
  const r = current(level);
  return withReveal(level, { ...r, nodes: [...r.nodes, { x, y }] });
}

export function moveRevealNode(level: StudioLevel, index: number, x: number, y: number): StudioLevel {
  const r = current(level);
  if (!r.nodes[index]) return level;
  return withReveal(level, { ...r, nodes: r.nodes.map((n, i) => (i === index ? { x, y } : n)) });
}

/** Delete a node; drop lines that touch it and re-index every remaining ref. */
export function deleteRevealNode(level: StudioLevel, index: number): StudioLevel {
  const r = current(level);
  if (!r.nodes[index]) return level;
  const remap = (i: number) => (i > index ? i - 1 : i);
  const nodes = r.nodes.filter((_, i) => i !== index);
  const lines = r.lines
    .filter(([a, b]) => a !== index && b !== index)
    .map(([a, b]) => [remap(a), remap(b)] as [number, number]);
  const accentNodes = (r.accentNodes ?? []).filter((i) => i !== index).map(remap);
  return withReveal(level, {
    ...r,
    nodes,
    lines,
    ...(accentNodes.length > 0 ? { accentNodes } : { accentNodes: [] }),
  });
}

/** Swap a node with its neighbour; keep line / accent references pointing at it. */
export function reorderRevealNode(level: StudioLevel, index: number, direction: -1 | 1): StudioLevel {
  const r = current(level);
  const target = index + direction;
  if (!r.nodes[index] || !r.nodes[target]) return level;
  const swap = (i: number) => (i === index ? target : i === target ? index : i);
  const nodes = [...r.nodes];
  [nodes[index], nodes[target]] = [nodes[target]!, nodes[index]!];
  const lines = r.lines.map(([a, b]) => [swap(a), swap(b)] as [number, number]);
  const accentNodes = (r.accentNodes ?? []).map(swap).sort((a, b) => a - b);
  return withReveal(level, { ...r, nodes, lines, ...(accentNodes.length > 0 ? { accentNodes } : {}) });
}

// ── lines ──────────────────────────────────────────────────────────────────

const samePair = (l: [number, number], a: number, b: number) =>
  (l[0] === a && l[1] === b) || (l[0] === b && l[1] === a);

/** Add a line between two distinct existing nodes. No-op on a bad ref or a dup. */
export function addRevealLine(level: StudioLevel, a: number, b: number): StudioLevel {
  const r = current(level);
  if (a === b || !r.nodes[a] || !r.nodes[b]) return level;
  if (r.lines.some((l) => samePair(l, a, b))) return level;
  return withReveal(level, { ...r, lines: [...r.lines, [a, b] as [number, number]] });
}

/** Add a line, or remove it if the exact (unordered) pair already exists. */
export function toggleRevealLine(level: StudioLevel, a: number, b: number): StudioLevel {
  const r = current(level);
  if (a === b || !r.nodes[a] || !r.nodes[b]) return level;
  const existing = r.lines.findIndex((l) => samePair(l, a, b));
  const lines = existing >= 0
    ? r.lines.filter((_, i) => i !== existing)
    : [...r.lines, [a, b] as [number, number]];
  return withReveal(level, { ...r, lines });
}

export function deleteRevealLine(level: StudioLevel, index: number): StudioLevel {
  const r = current(level);
  if (!r.lines[index]) return level;
  return withReveal(level, { ...r, lines: r.lines.filter((_, i) => i !== index) });
}

// ── accents ────────────────────────────────────────────────────────────────

export function toggleAccentNode(level: StudioLevel, index: number): StudioLevel {
  const r = current(level);
  if (!r.nodes[index]) return level;
  const set = new Set(r.accentNodes ?? []);
  if (set.has(index)) set.delete(index);
  else set.add(index);
  const accentNodes = [...set].sort((a, b) => a - b);
  return withReveal(level, { ...r, ...(accentNodes.length > 0 ? { accentNodes } : { accentNodes: [] }) });
}
