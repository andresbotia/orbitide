import type { OrbColor, Pixel } from './types';

/**
 * Shared pixel-art character legend. A `LevelDefinition` may override entries
 * via its own `legend`, but every M1 level uses this mapping.
 *
 *   . or space -> empty
 *   B blue   C cyan    W white
 *   P purple K pink    Y yellow
 *   O orange R red     G green
 */
export const DEFAULT_ART_LEGEND: Record<string, OrbColor> = {
  B: 'blue',
  C: 'cyan',
  W: 'white',
  P: 'purple',
  K: 'pink',
  Y: 'yellow',
  O: 'orange',
  R: 'red',
  G: 'green',
};

const EMPTY_CHARS = new Set(['.', ' ', '']);

export interface ParsedArt {
  width: number;
  height: number;
  pixels: Pixel[];
}

/**
 * Parse `pixelArt` rows into positioned pixels. Deterministic ids:
 * `L{levelId}-p{x}-{y}`. Rows may be ragged; width is the longest row.
 */
export function parsePixelArt(
  levelId: number,
  rows: string[],
  legend: Record<string, OrbColor>,
): ParsedArt {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const height = rows.length;
  const pixels: Pixel[] = [];

  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const ch = row[x] ?? '.';
      if (EMPTY_CHARS.has(ch)) continue;
      const color = legend[ch];
      if (!color) {
        throw new Error(
          `Level ${levelId}: pixel-art char "${ch}" at (${x},${y}) is not in the legend`,
        );
      }
      pixels.push({ id: `L${levelId}-p${x}-${y}`, x, y, color, cleared: false });
    }
  });

  return { width, height, pixels };
}
