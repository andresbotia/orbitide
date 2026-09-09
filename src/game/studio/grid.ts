/**
 * Grid + art-legend helpers for the Level Studio. Pure. The canonical
 * art-character mapping lives here so the serializer and the round-trip tests
 * agree on exactly one encoding.
 */
import { DEFAULT_ART_LEGEND } from '@/game/engine/art';
import type { OrbColor } from '@/game/engine/types';

/**
 * Grid sizes the production renderer is tuned for. The schema itself imposes no
 * size limit (`parsePixelArt` accepts any dimensions), and Levels 1–10 include
 * 6×6, 7×7, 7×9 and 8×8 boards, so the Studio treats anything in
 * {@link GRID_RANGE} as legal and only *warns* outside {@link TUNED_GRID_SIZES}.
 */
export const TUNED_GRID_SIZES = [7, 9, 11, 13, 15] as const;
export const GRID_RANGE = { min: 4, max: 17 } as const;

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseCellKey(key: string): { x: number; y: number } {
  const [x, y] = key.split(',');
  return { x: Number(x), y: Number(y) };
}

/**
 * Canonical colour → art-character mapping. The nine colours in the shared
 * default legend keep their historical characters (so Levels 1–10 re-serialise
 * byte-for-byte); the remaining six get stable extra characters and force an
 * explicit `legend` entry on export.
 */
export const COLOR_TO_CHAR: Record<OrbColor, string> = (() => {
  const fromDefault: Partial<Record<OrbColor, string>> = {};
  for (const [ch, color] of Object.entries(DEFAULT_ART_LEGEND)) fromDefault[color] = ch;
  return {
    white: fromDefault.white ?? 'W',
    yellow: fromDefault.yellow ?? 'Y',
    gold: 'A',
    orange: fromDefault.orange ?? 'O',
    red: fromDefault.red ?? 'R',
    coral: 'D',
    pink: fromDefault.pink ?? 'K',
    magenta: 'M',
    purple: fromDefault.purple ?? 'P',
    indigo: 'N',
    blue: fromDefault.blue ?? 'B',
    cyan: fromDefault.cyan ?? 'C',
    teal: 'T',
    green: fromDefault.green ?? 'G',
    lime: 'L',
  };
})();

/** Colours that need an explicit `legend` entry (not in the shared default). */
export function isDefaultLegendColor(color: OrbColor): boolean {
  return Object.values(DEFAULT_ART_LEGEND).includes(color);
}

export const EMPTY_CELL_CHAR = '.';

/** All 15 gameplay colours, in hue-wheel order — the real palette, no invention. */
export const ORB_COLORS: OrbColor[] = [
  'white', 'yellow', 'gold', 'orange', 'red', 'coral', 'pink', 'magenta',
  'purple', 'indigo', 'blue', 'cyan', 'teal', 'green', 'lime',
];
