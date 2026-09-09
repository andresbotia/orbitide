import { DEFAULT_ART_LEGEND, parsePixelArt } from '@/game/engine/art';
import type { LevelDefinition, LevelReveal } from '@/game/engine/types';

/**
 * Pure model for the Win / Discovery reveal. No React / RN / Skia.
 *
 * A reveal is a small constellation laid over the solved picture: authored
 * `level.reveal` when present, otherwise a deterministic silhouette fallback
 * derived from the cleared pixel positions. Never random.
 */

export type RevealSource = 'authored' | 'fallback';

export interface RevealNode {
  x: number;
  y: number;
}

export interface ResolvedReveal {
  source: RevealSource;
  name: string;
  /** Node positions in pixel-grid cell coordinates. */
  nodes: RevealNode[];
  /** Index pairs into `nodes`. */
  lines: [number, number][];
  accentNodes: number[];
  collectionId?: string;
  /** Grid the node coordinates are expressed in. */
  cols: number;
  rows: number;
}

function validAuthored(reveal: LevelReveal): boolean {
  if (!reveal.name || reveal.nodes.length < 2) return false;
  return reveal.lines.every(
    ([a, b]) =>
      Number.isInteger(a) && Number.isInteger(b) &&
      a >= 0 && b >= 0 && a < reveal.nodes.length && b < reveal.nodes.length && a !== b,
  );
}

const DIRECTIONS: readonly [number, number][] = [
  [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
];

/**
 * Deterministic fallback: pick the pixel furthest along each of eight compass
 * directions (the silhouette's extreme points), de-duplicate, order them by
 * angle around the centroid into a non-self-intersecting outline, and connect
 * consecutive nodes into a closed loop. Ties break on lowest (y, x) then id.
 */
function fallbackReveal(level: LevelDefinition, cols: number, rows: number, cells: { x: number; y: number }[]): ResolvedReveal {
  const name = level.title.toUpperCase();

  if (cells.length === 0) {
    // Minimal generic reveal — a small centred triad. Still deterministic.
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    return {
      source: 'fallback', name, cols, rows,
      nodes: [{ x: cx, y: cy - 1 }, { x: cx - 1, y: cy + 1 }, { x: cx + 1, y: cy + 1 }],
      lines: [[0, 1], [1, 2], [2, 0]],
      accentNodes: [0],
    };
  }

  const picked: RevealNode[] = [];
  for (const [dx, dy] of DIRECTIONS) {
    let best = cells[0]!;
    let bestScore = best.x * dx + best.y * dy;
    for (const c of cells) {
      const score = c.x * dx + c.y * dy;
      if (
        score > bestScore + 1e-9 ||
        (Math.abs(score - bestScore) <= 1e-9 && (c.y < best.y || (c.y === best.y && c.x < best.x)))
      ) {
        best = c;
        bestScore = score;
      }
    }
    if (!picked.some((p) => p.x === best.x && p.y === best.y)) picked.push({ x: best.x, y: best.y });
  }

  const centroid = picked.reduce((a, p) => ({ x: a.x + p.x / picked.length, y: a.y + p.y / picked.length }), { x: 0, y: 0 });
  const ordered = [...picked].sort(
    (a, b) => Math.atan2(a.y - centroid.y, a.x - centroid.x) - Math.atan2(b.y - centroid.y, b.x - centroid.x),
  );

  const lines: [number, number][] = ordered.map((_, i) => [i, (i + 1) % ordered.length] as [number, number]);
  const topIndex = ordered.reduce((best, p, i) => (p.y < ordered[best]!.y ? i : best), 0);

  return { source: 'fallback', name, cols, rows, nodes: ordered, lines, accentNodes: [topIndex] };
}

export function resolveReveal(level: LevelDefinition): ResolvedReveal {
  const legend = { ...DEFAULT_ART_LEGEND, ...(level.legend ?? {}) };
  const { width: cols, height: rows, pixels } = parsePixelArt(level.id, level.pixelArt, legend);
  const cells = pixels.map((p) => ({ x: p.x, y: p.y }));

  if (level.reveal && validAuthored(level.reveal)) {
    const r = level.reveal;
    return {
      source: 'authored',
      name: r.name,
      nodes: r.nodes.map((n) => ({ x: n.x, y: n.y })),
      lines: r.lines.map(([a, b]) => [a, b] as [number, number]),
      accentNodes: (r.accentNodes ?? []).filter((i) => i >= 0 && i < r.nodes.length),
      collectionId: r.collectionId,
      cols,
      rows,
    };
  }

  return fallbackReveal(level, cols, rows, cells);
}

// ---------------------------------------------------------------------------
// Reveal timeline (all TUNABLE). Milliseconds from the moment the final pixel
// clear finishes and the win overlay mounts.
// ---------------------------------------------------------------------------

export interface RevealTimeline {
  /** Micro-pause / board settle before the transformation. */
  settleMs: number;
  nodesStartMs: number;
  nodesEndMs: number;
  linesStartMs: number;
  linesEndMs: number;
  /** Discovery title starts fading in. */
  titleMs: number;
  titleEndMs: number;
  /** NEXT becomes visible. */
  nextVisibleMs: number;
  /** NEXT becomes pressable (decorative beats may still run behind it). */
  nextInteractiveMs: number;
  /** End of the full decorative tail — the master progress duration. */
  tailMs: number;
}

const FULL: RevealTimeline = {
  settleMs: 150,
  nodesStartMs: 220,
  nodesEndMs: 720,
  linesStartMs: 480,
  linesEndMs: 1000,
  titleMs: 780,
  titleEndMs: 1080,
  nextVisibleMs: 1000,
  nextInteractiveMs: 1320,
  tailMs: 3200,
};

const REDUCED: RevealTimeline = {
  settleMs: 60,
  nodesStartMs: 80,
  nodesEndMs: 240,
  linesStartMs: 180,
  linesEndMs: 360,
  titleMs: 300,
  titleEndMs: 520,
  nextVisibleMs: 360,
  nextInteractiveMs: 560,
  tailMs: 900,
};

export function revealTimeline(reducedMotion: boolean): RevealTimeline {
  return reducedMotion ? REDUCED : FULL;
}
