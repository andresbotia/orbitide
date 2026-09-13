/**
 * Authored board / palette metrics. Derived from the serializable level
 * definition (pixel-art + legend) — no solver, no runtime.
 */
import { DEFAULT_ART_LEGEND } from '@/game/engine/art';
import type { LevelDefinition, OrbColor } from '@/game/engine/types';
import type { BoardMetrics, PaletteSnapshot } from './types';

/** Stable palette order matching `OrbColor` in `engine/types.ts`. */
export const ORB_COLOR_ORDER: readonly OrbColor[] = [
  'white', 'yellow', 'gold', 'orange', 'red', 'coral', 'pink', 'magenta',
  'purple', 'indigo', 'blue', 'cyan', 'teal', 'green', 'lime',
];

const EMPTY_CHARS = new Set(['.', ' ', '']);

export function colorHistogramOf(def: LevelDefinition): Partial<Record<OrbColor, number>> {
  const legend = { ...DEFAULT_ART_LEGEND, ...(def.legend ?? {}) };
  const histogram: Partial<Record<OrbColor, number>> = {};
  for (const row of def.pixelArt) {
    for (const ch of row) {
      if (EMPTY_CHARS.has(ch)) continue;
      const color = legend[ch];
      if (!color) continue;
      histogram[color] = (histogram[color] ?? 0) + 1;
    }
  }
  return histogram;
}

export function uniqueColorsOf(histogram: Partial<Record<OrbColor, number>>): OrbColor[] {
  return ORB_COLOR_ORDER.filter((c) => (histogram[c] ?? 0) > 0);
}

/** Every colour tied for the highest count, in palette order. Empty board → []. */
export function dominantColorsOf(histogram: Partial<Record<OrbColor, number>>): OrbColor[] {
  let max = 0;
  for (const c of ORB_COLOR_ORDER) max = Math.max(max, histogram[c] ?? 0);
  if (max <= 0) return [];
  return ORB_COLOR_ORDER.filter((c) => (histogram[c] ?? 0) === max);
}

export function paletteSnapshot(def: LevelDefinition): PaletteSnapshot {
  const colorHistogram = colorHistogramOf(def);
  return {
    uniqueColors: uniqueColorsOf(colorHistogram),
    dominantColors: dominantColorsOf(colorHistogram),
    colorHistogram,
  };
}

export function boardMetrics(def: LevelDefinition): BoardMetrics {
  const rows = def.pixelArt.length;
  const cols = def.pixelArt.reduce((m, row) => Math.max(m, row.length), 0);
  const totalCells = rows * cols;
  const histogram = colorHistogramOf(def);
  let occupiedCells = 0;
  for (const c of ORB_COLOR_ORDER) occupiedCells += histogram[c] ?? 0;
  const unique = uniqueColorsOf(histogram);
  return {
    rows,
    cols,
    totalCells,
    occupiedCells,
    density: totalCells > 0 ? occupiedCells / totalCells : 0,
    uniqueColors: unique.length,
    colorHistogram: histogram,
    dominantColors: dominantColorsOf(histogram),
  };
}
