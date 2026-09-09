/**
 * The ONE canonical path between Studio state and the production
 * {@link LevelDefinition}. There is no second level format: `toLevelDefinition`
 * produces exactly what `LEVEL_DEFINITIONS` holds, and `fromLevelDefinition`
 * reuses the engine's own `parsePixelArt` to read one back.
 *
 * Output is deterministic and stable: the same logical level always serialises
 * to the same bytes (fixed field order, row-major cells, no timestamps).
 */
import { DEFAULT_ART_LEGEND, parsePixelArt } from '@/game/engine/art';
import type { LevelDefinition, OrbColor } from '@/game/engine/types';
import {
  COLOR_TO_CHAR,
  EMPTY_CELL_CHAR,
  cellKey,
  isDefaultLegendColor,
} from './grid';
import type { StudioLevel } from './types';

/** Distinct colours used on the board, in row-major first-seen order. */
export function usedColors(level: StudioLevel): OrbColor[] {
  const seen = new Set<OrbColor>();
  const out: OrbColor[] = [];
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const color = level.cells[cellKey(x, y)];
      if (color && !seen.has(color)) {
        seen.add(color);
        out.push(color);
      }
    }
  }
  return out;
}

/** Colours used by any tunnel charge, in tunnel/queue order. */
export function chargeColors(level: StudioLevel): OrbColor[] {
  const seen = new Set<OrbColor>();
  const out: OrbColor[] = [];
  for (const queue of level.tunnels) {
    for (const spec of queue) {
      if (!seen.has(spec.color)) {
        seen.add(spec.color);
        out.push(spec.color);
      }
    }
  }
  return out;
}

/**
 * The `legend` a serialised level needs: every colour it uses (on the board or
 * in a queue) that is NOT in the shared default legend, plus any override the
 * source level carried. `undefined` when the default legend fully covers it —
 * which keeps Levels 1–10 legend-free exactly as authored.
 */
export function requiredLegend(level: StudioLevel): Record<string, OrbColor> | undefined {
  const entries: Record<string, OrbColor> = {};
  const colors = new Set<OrbColor>([...usedColors(level), ...chargeColors(level)]);
  for (const color of colors) {
    if (!isDefaultLegendColor(color)) entries[COLOR_TO_CHAR[color]] = color;
  }
  // Preserve source-level overrides that still make sense (their char is not a
  // default-legend char being repurposed for a different colour).
  for (const [ch, color] of Object.entries(level.legend ?? {})) {
    if (DEFAULT_ART_LEGEND[ch] === color) continue; // redundant with the default
    entries[ch] = color;
  }
  const keys = Object.keys(entries).sort();
  if (keys.length === 0) return undefined;
  const ordered: Record<string, OrbColor> = {};
  for (const k of keys) ordered[k] = entries[k]!;
  return ordered;
}

/** Board → `pixelArt` rows. Full-width rows, `.` for empty, row-major. */
export function toPixelArt(level: StudioLevel): string[] {
  const charOf = buildCharLookup(level);
  const rows: string[] = [];
  for (let y = 0; y < level.height; y += 1) {
    let row = '';
    for (let x = 0; x < level.width; x += 1) {
      const color = level.cells[cellKey(x, y)];
      row += color ? charOf(color) : EMPTY_CELL_CHAR;
    }
    rows.push(row);
  }
  return rows;
}

/** Colour → char, honouring a source-level override before the canonical map. */
function buildCharLookup(level: StudioLevel): (color: OrbColor) => string {
  const override = new Map<OrbColor, string>();
  for (const [ch, color] of Object.entries(level.legend ?? {})) {
    if (!override.has(color)) override.set(color, ch);
  }
  return (color) => override.get(color) ?? COLOR_TO_CHAR[color];
}

/** Studio document → canonical production {@link LevelDefinition}. */
export function toLevelDefinition(level: StudioLevel): LevelDefinition {
  const def: LevelDefinition = {
    id: level.id,
    title: level.title,
    themeId: level.themeId,
    difficulty: level.difficulty,
    holdingCapacity: level.holdingCapacity,
    pixelArt: toPixelArt(level),
    tunnels: level.tunnels.map((queue) => queue.map((spec) => ({ ...spec }))),
  };
  const legend = requiredLegend(level);
  if (legend) def.legend = legend;
  if (level.reveal) def.reveal = cloneReveal(level.reveal);
  return def;
}

/** Production {@link LevelDefinition} → Studio document (via the engine parser). */
export function fromLevelDefinition(def: LevelDefinition): StudioLevel {
  const legend = { ...DEFAULT_ART_LEGEND, ...(def.legend ?? {}) };
  const { width, height, pixels } = parsePixelArt(def.id, def.pixelArt, legend);
  const cells: Record<string, OrbColor> = {};
  for (const p of pixels) cells[cellKey(p.x, p.y)] = p.color;
  return {
    id: def.id,
    title: def.title,
    themeId: def.themeId,
    difficulty: def.difficulty,
    holdingCapacity: def.holdingCapacity,
    width,
    height,
    cells,
    tunnels: def.tunnels.map((queue) => queue.map((spec) => ({ ...spec }))),
    ...(def.legend ? { legend: { ...def.legend } } : {}),
    ...(def.reveal ? { reveal: cloneReveal(def.reveal) } : {}),
  };
}

function cloneReveal(reveal: NonNullable<LevelDefinition['reveal']>): NonNullable<LevelDefinition['reveal']> {
  return {
    name: reveal.name,
    nodes: reveal.nodes.map((n) => ({ x: n.x, y: n.y })),
    lines: reveal.lines.map((l) => [l[0], l[1]] as [number, number]),
    ...(reveal.accentNodes ? { accentNodes: [...reveal.accentNodes] } : {}),
    ...(reveal.collectionId ? { collectionId: reveal.collectionId } : {}),
  };
}

// ── serialised text output ──────────────────────────────────────────────────

/** Canonical pretty JSON of the production level definition. */
export function serializeToJSON(level: StudioLevel): string {
  return JSON.stringify(toLevelDefinition(level), null, 2) + '\n';
}

/**
 * A paste-ready TypeScript object literal in the exact shape and style of
 * `src/game/levels/levelDefinitions.ts`, so a designer can drop it straight into
 * `LEVEL_DEFINITIONS` and commit it like any other level.
 */
export function serializeToTS(level: StudioLevel): string {
  const def = toLevelDefinition(level);
  const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const lines: string[] = [];
  lines.push('{');
  lines.push(`  id: ${def.id}, title: ${q(def.title)}, themeId: ${q(def.themeId)},`);
  lines.push(`  difficulty: ${q(def.difficulty)}, holdingCapacity: ${def.holdingCapacity},`);
  lines.push('  pixelArt: [');
  for (const row of def.pixelArt) lines.push(`    ${q(row)},`);
  lines.push('  ],');
  if (def.legend) {
    const entries = Object.entries(def.legend).map(([k, v]) => `${q(k)}: ${q(v)}`);
    lines.push(`  legend: { ${entries.join(', ')} },`);
  }
  lines.push('  tunnels: [');
  for (const queue of def.tunnels) {
    const specs = queue.map((s) => `{ color: ${q(s.color)}, capacity: ${s.capacity} }`);
    lines.push(`    [${specs.join(', ')}],`);
  }
  lines.push('  ],');
  if (def.reveal) {
    lines.push(`  reveal: ${JSON.stringify(def.reveal)},`);
  }
  lines.push('}');
  return lines.join('\n') + '\n';
}
