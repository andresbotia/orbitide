/**
 * Lightweight, deterministic level thumbnails. Pure — builds an SVG string (and
 * an inline data URI) straight from the level data. No backend, no image
 * service, no production 3D materials: a flat grid of coloured squares that
 * reads as the pixel artwork, cheap enough to render a whole campaign at once.
 *
 * Deterministic: the same level always produces identical bytes.
 */
import type { LevelDefinition, OrbColor } from '@/game/engine/types';
import { orbColors } from '@/theme/colors';
import { DEFAULT_ART_LEGEND } from '@/game/engine/art';
import { MODIFIER_SPECS } from './modifiers';
import { toLevelDefinition } from './serialize';
import type { StudioLevel } from './types';

export interface ThumbnailCell {
  x: number;
  y: number;
  color: OrbColor;
  /** Marker glyph when the cell carries a modifier. */
  marker?: string;
}

export interface ThumbnailModel {
  width: number;
  height: number;
  cells: ThumbnailCell[];
  /** Distinct colours used, row-major first-seen. */
  colors: OrbColor[];
}

export interface ThumbnailOptions {
  /** Pixel size of one cell. Default 8. */
  cell?: number;
  /** Draw modifier markers. Default false. */
  markers?: boolean;
  /** Background fill. Default '#0B0E16'. */
  background?: string;
}

function asDefinition(level: StudioLevel | LevelDefinition): LevelDefinition {
  return 'cells' in level ? toLevelDefinition(level) : level;
}

/** Structured thumbnail data — the source for any renderer (SVG, canvas, RN). */
export function thumbnailModel(level: StudioLevel | LevelDefinition): ThumbnailModel {
  const def = asDefinition(level);
  const legend = { ...DEFAULT_ART_LEGEND, ...(def.legend ?? {}) };
  const width = def.pixelArt.reduce((m, r) => Math.max(m, r.length), 0);
  const height = def.pixelArt.length;
  const cells: ThumbnailCell[] = [];
  const seen = new Set<OrbColor>();
  const colors: OrbColor[] = [];

  def.pixelArt.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const ch = row[x] ?? '.';
      if (ch === '.' || ch === ' ') continue;
      const color = legend[ch];
      if (!color) continue;
      const mod = def.modifiers?.[`${x},${y}`];
      cells.push({ x, y, color, ...(mod ? { marker: MODIFIER_SPECS[mod.kind].marker } : {}) });
      if (!seen.has(color)) { seen.add(color); colors.push(color); }
    }
  });

  return { width, height, cells, colors };
}

/** Deterministic SVG string. Safe to embed or cache by level id + revision. */
export function thumbnailSVG(level: StudioLevel | LevelDefinition, opts: ThumbnailOptions = {}): string {
  const cell = opts.cell ?? 8;
  const bg = opts.background ?? '#0B0E16';
  const model = thumbnailModel(level);
  const w = Math.max(1, model.width) * cell;
  const h = Math.max(1, model.height) * cell;

  const rects = model.cells.map((c) => {
    const base = `<rect x="${c.x * cell}" y="${c.y * cell}" width="${cell}" height="${cell}" fill="${orbColors[c.color]}"/>`;
    if (opts.markers && c.marker) {
      const cx = c.x * cell + cell / 2;
      const cy = c.y * cell + cell / 2;
      return base + `<circle cx="${cx}" cy="${cy}" r="${(cell / 2 - 1).toFixed(2)}" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="1"/>`;
    }
    return base;
  }).join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">`,
    `<rect width="${w}" height="${h}" fill="${bg}"/>`,
    rects,
    '</svg>',
  ].join('');
}

/** `data:` URI form for an `<img>` / `Image` source. Deterministic. */
export function thumbnailDataUri(level: StudioLevel | LevelDefinition, opts?: ThumbnailOptions): string {
  const svg = thumbnailSVG(level, opts);
  // Percent-encode without base64 so output stays diff-friendly and deterministic.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
