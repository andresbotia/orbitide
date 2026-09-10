import type { ModifierInstance, OrbColor, Pixel, PixelModifierMap } from './types';

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

/** Deep-copy a {@link ModifierInstance} (defined-key-only, deterministic order). */
export function cloneModifierInstance(m: ModifierInstance): ModifierInstance {
  const out: ModifierInstance = { kind: m.kind };
  if (m.state !== undefined) out.state = m.state;
  if (m.progress !== undefined) out.progress = m.progress;
  if (m.level !== undefined) out.level = m.level;
  if (m.seed !== undefined) out.seed = m.seed;
  if (m.group !== undefined) out.group = m.group;
  if (m.linkId !== undefined) out.linkId = m.linkId;
  if (m.linkedPixelIds !== undefined) out.linkedPixelIds = [...m.linkedPixelIds];
  if (m.linkProgress !== undefined) out.linkProgress = m.linkProgress;
  return out;
}

/**
 * Copy a {@link PixelModifierMap} onto the matching pixels by `"x,y"` cell. Pure
 * — returns a new pixel array only when something attaches. The engine calls
 * this so the renderer can read `pixel.modifier`; no rule consumes it.
 */
export function attachModifiers(pixels: Pixel[], modifiers: PixelModifierMap | undefined): Pixel[] {
  if (!modifiers || Object.keys(modifiers).length === 0) return pixels;
  const attached = pixels.map((p) => {
    const m = modifiers[`${p.x},${p.y}`];
    return m ? { ...p, modifier: cloneModifierInstance(m) } : p;
  });
  const groups = new Map<string, string[]>();
  for (const pixel of attached) {
    const modifier = pixel.modifier;
    if (modifier?.kind !== 'linked') continue;
    const group = modifier.group ?? modifier.linkId;
    if (group === undefined) continue;
    groups.set(group, [...(groups.get(group) ?? []), pixel.id]);
  }
  for (const ids of groups.values()) ids.sort((a, b) => a.localeCompare(b));
  return attached.map((pixel) => {
    const modifier = pixel.modifier;
    if (modifier?.kind !== 'linked') return pixel;
    const group = modifier.group ?? modifier.linkId;
    if (group === undefined) return pixel;
    return {
      ...pixel,
      modifier: {
        ...modifier,
        group,
        linkId: group,
        linkedPixelIds: (groups.get(group) ?? []).filter((id) => id !== pixel.id),
        linkProgress: modifier.state === 'primed' ? 1 : (modifier.linkProgress ?? 0),
      },
    };
  });
}
