/**
 * Mass-authoring transforms. Pure — every function returns a new
 * {@link StudioLevel} (or a plain clip object) and never mutates.
 *
 * Modifiers always move with their pixel (same "x,y" remap). Reveal geometry is
 * a rigid transform for mirror / rotate, so it moves too; a transform that
 * cannot safely carry the reveal returns `{ level, revealWarning }` and leaves
 * the reveal untouched for the author to reset.
 */
import type { ChargeSpec, OrbColor } from '@/game/engine/types';
import { cellKey, parseCellKey } from './grid';
import { cloneReveal } from './reveal';
import type { StudioLevel, StudioModifier } from './types';

export interface TransformResult {
  level: StudioLevel;
  /** Set when the reveal could not be transformed and was left as-is. */
  revealWarning?: string;
}

type CellMap = (x: number, y: number) => { x: number; y: number };

function remap(level: StudioLevel, width: number, height: number, map: CellMap, revealMap?: (x: number, y: number) => { x: number; y: number }): TransformResult {
  const cells: Record<string, OrbColor> = {};
  for (const [key, color] of Object.entries(level.cells)) {
    const { x, y } = parseCellKey(key);
    const p = map(x, y);
    cells[cellKey(p.x, p.y)] = color;
  }
  const next: StudioLevel = { ...level, width, height, cells };

  if (level.modifiers) {
    const modifiers: Record<string, StudioModifier> = {};
    for (const [key, mod] of Object.entries(level.modifiers)) {
      const { x, y } = parseCellKey(key);
      const p = map(x, y);
      modifiers[cellKey(p.x, p.y)] = { kind: mod.kind, config: { ...mod.config } };
    }
    next.modifiers = modifiers;
  }

  if (level.reveal) {
    if (revealMap) {
      const r = cloneReveal(level.reveal);
      next.reveal = { ...r, nodes: r.nodes.map((n) => revealMap(n.x, n.y)) };
    } else {
      return { level: next, revealWarning: 'Reveal geometry was left unchanged — reset it if the transform moved the picture.' };
    }
  }
  return { level: next };
}

/** Flip the board left↔right. Reveal nodes mirror too. */
export function mirrorHorizontal(level: StudioLevel): TransformResult {
  const w = level.width;
  return remap(level, w, level.height, (x, y) => ({ x: w - 1 - x, y }), (x, y) => ({ x: w - 1 - x, y }));
}

/** Flip the board top↔bottom. */
export function mirrorVertical(level: StudioLevel): TransformResult {
  const h = level.height;
  return remap(level, level.width, h, (x, y) => ({ x, y: h - 1 - y }), (x, y) => ({ x, y: h - 1 - y }));
}

/**
 * Rotate the board 90° clockwise. Square grids only (the renderer is tuned for
 * square boards and a non-square rotate changes the aspect); otherwise a no-op
 * with a warning.
 */
export function rotate90(level: StudioLevel): TransformResult {
  if (level.width !== level.height) {
    return { level, revealWarning: `Rotate needs a square grid (this is ${level.width}×${level.height}).` };
  }
  const n = level.width;
  const map: CellMap = (x, y) => ({ x: n - 1 - y, y: x });
  return remap(level, n, n, map, (x, y) => ({ x: n - 1 - y, y: x }));
}

/**
 * Replace every `from` pixel with `to`. Tunnel charges of that colour are
 * remapped too by default so the level stays budget-consistent.
 */
export function replaceColor(
  level: StudioLevel,
  from: OrbColor,
  to: OrbColor,
  opts: { tunnels?: boolean } = {},
): StudioLevel {
  if (from === to) return level;
  const cells: Record<string, OrbColor> = {};
  for (const [key, color] of Object.entries(level.cells)) cells[key] = color === from ? to : color;
  const next: StudioLevel = { ...level, cells };
  if (opts.tunnels ?? true) {
    next.tunnels = level.tunnels.map((q) => q.map((s) => (s.color === from ? { ...s, color: to } : { ...s })));
  }
  return next;
}

// ── clipboard-style helpers ────────────────────────────────────────────────

export interface ArtworkClip {
  width: number;
  height: number;
  cells: Record<string, OrbColor>;
  modifiers?: Record<string, StudioModifier>;
}

export function copyArtwork(level: StudioLevel): ArtworkClip {
  return {
    width: level.width,
    height: level.height,
    cells: { ...level.cells },
    ...(level.modifiers ? { modifiers: structuredCloneModifiers(level.modifiers) } : {}),
  };
}

/** Paste artwork over a level, adopting the clip's grid size. Tunnels/reveal kept. */
export function pasteArtwork(level: StudioLevel, clip: ArtworkClip): StudioLevel {
  const next: StudioLevel = {
    ...level,
    width: clip.width,
    height: clip.height,
    cells: { ...clip.cells },
  };
  if (clip.modifiers && Object.keys(clip.modifiers).length > 0) next.modifiers = structuredCloneModifiers(clip.modifiers);
  else delete next.modifiers;
  return next;
}

export function copyTunnelQueue(level: StudioLevel, tunnel: number): ChargeSpec[] {
  return (level.tunnels[tunnel] ?? []).map((s) => ({ ...s }));
}

export function pasteTunnelQueue(level: StudioLevel, tunnel: number, specs: ChargeSpec[]): StudioLevel {
  if (!level.tunnels[tunnel]) return level;
  return { ...level, tunnels: level.tunnels.map((q, i) => (i === tunnel ? specs.map((s) => ({ ...s })) : q)) };
}

// ── renumbering ────────────────────────────────────────────────────────────

export function withId(level: StudioLevel, id: number): StudioLevel {
  return { ...level, id };
}

/** Give a list of levels sequential ids starting at `startId`, in list order. */
export function renumber(levels: StudioLevel[], startId: number): StudioLevel[] {
  return levels.map((level, i) => ({ ...level, id: startId + i }));
}

function structuredCloneModifiers(src: Record<string, StudioModifier>): Record<string, StudioModifier> {
  const out: Record<string, StudioModifier> = {};
  for (const [k, m] of Object.entries(src)) out[k] = { kind: m.kind, config: { ...m.config } };
  return out;
}
