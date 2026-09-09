import { DEFAULT_ART_LEGEND, parsePixelArt } from '@/game/engine/art';
import type { LevelDefinition, OrbColor } from '@/game/engine/types';
import { CAMPAIGN_COLORS } from '@/game/levels/levels';

/**
 * Pure geometry + data helpers for the production Home screen ("living orbital
 * arcade machine"). No React / RN / Skia — unit-testable, shared by the
 * centerpiece, the level preview and the ambient-charge system.
 */

export interface Point {
  x: number;
  y: number;
}

export interface HomeInput {
  /** Usable content width (inside horizontal padding). */
  width: number;
  /** Usable content height (inside safe-area insets + top/bottom chrome). */
  height: number;
  reducedMotion?: boolean;
}

export interface HomeLayout {
  width: number;
  height: number;
  /** Centre of the orbital machine. */
  center: Point;
  /** Outer reach of the machine (rail + a little structural margin). */
  machineRadius: number;
  /** The physical orbit rail radius — ambient charges ride this. */
  orbitRadius: number;
  /** Square bounding box of the level-preview artwork, in screen coords. */
  preview: { x: number; y: number; size: number };
  /** How many ambient charges to render (0..3). */
  ambientChargeCount: number;
  /** Background depth budget. */
  starCountFar: number;
  starCountNear: number;
  showNebula: boolean;
  /** Foreground fragment layer — first thing dropped when space is tight. */
  showForeground: boolean;
  /** Machine side-extensions (struts / modules) — dropped before readability. */
  showExtensions: boolean;
}

/** Below this usable height we start shedding decorative layers. */
const COMPACT_HEIGHT = 720;
const TIGHT_HEIGHT = 620;

export function computeHomeLayout({ width, height, reducedMotion = false }: HomeInput): HomeLayout {
  const compact = height < COMPACT_HEIGHT;
  const tight = height < TIGHT_HEIGHT;

  // Centerpiece target: it should dominate its band (~55-60% of the hero
  // height, which is itself ~45-50% of the usable screen), but never wider than
  // the column and never so small it stops reading.
  const byHeight = height * (compact ? 0.54 : 0.6);
  const byWidth = width * 0.94;
  const diameter = Math.max(190, Math.min(byHeight, byWidth, 360));
  const machineRadius = diameter / 2;

  // The machine sits a touch above the vertical middle of its band.
  const center: Point = { x: width / 2, y: height * (compact ? 0.44 : 0.46) };

  const orbitRadius = machineRadius * 0.82;
  const previewSize = Math.round(orbitRadius * 1.24);
  const preview = {
    x: center.x - previewSize / 2,
    y: center.y - previewSize / 2,
    size: previewSize,
  };

  return {
    width,
    height,
    center,
    machineRadius,
    orbitRadius,
    preview,
    ambientChargeCount: reducedMotion ? 1 : tight ? 2 : 3,
    starCountFar: reducedMotion ? 14 : tight ? 20 : compact ? 30 : 42,
    starCountNear: reducedMotion ? 0 : tight ? 6 : compact ? 10 : 16,
    showNebula: !tight,
    showForeground: !compact && !reducedMotion,
    showExtensions: !tight,
  };
}

export interface PreviewCell {
  x: number;
  y: number;
  color: OrbColor;
}

export interface LevelPreview {
  levelId: number;
  cols: number;
  rows: number;
  density: number;
  cells: PreviewCell[];
  colors: OrbColor[];
  /** true once the grid is dense enough to warrant flatter preview material. */
  simplify: boolean;
}

/**
 * A simplified, non-interactive preview of a level's picture, straight from the
 * authored board data. No solver state, no queues, no Holding — just the
 * silhouette and colour relationships of "what I'm about to solve".
 */
export function homeLevelPreview(level: LevelDefinition): LevelPreview {
  const legend = { ...DEFAULT_ART_LEGEND, ...(level.legend ?? {}) };
  const { width, height, pixels } = parsePixelArt(level.id, level.pixelArt, legend);
  const seen: OrbColor[] = [];
  for (const p of pixels) if (!seen.includes(p.color)) seen.push(p.color);
  const density = Math.max(width, height);
  return {
    levelId: level.id,
    cols: width,
    rows: height,
    density,
    cells: pixels.map((p) => ({ x: p.x, y: p.y, color: p.color })),
    colors: seen,
    simplify: density >= 13,
  };
}

/** Layout of the preview grid inside its box (cell size + origin). */
export function previewGrid(preview: LevelPreview, box: { size: number }): { cell: number; originX: number; originY: number } {
  const cell = Math.max(2, Math.floor((box.size * 0.86) / Math.max(preview.cols, preview.rows)));
  const gridW = cell * preview.cols;
  const gridH = cell * preview.rows;
  return {
    cell,
    originX: (box.size - gridW) / 2,
    originY: (box.size - gridH) / 2,
  };
}

export interface AmbientChargeSpec {
  /** Presentation colour. */
  color: OrbColor;
  /** Starting angular offset, turns (0..1). */
  phase: number;
  /** Full-orbit period in ms. Deliberately non-commensurate between charges. */
  periodMs: number;
  /** +1 clockwise, matches gameplay canonical direction. */
  direction: 1;
  /** 0..1 trail intensity. */
  trail: number;
}

/** Tiny deterministic PRNG (mulberry32) so Home motion is stable per level. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 1..3 decorative charges for the Home centerpiece. PRESENTATION ONLY — no
 * capacity, no shooting, not connected to engine state. Colours are drawn from
 * the level's own charges so Home visually matches the level you're about to
 * play; periods are spread so the motion never reads as one synced loop.
 */
export function ambientChargeSpecs(level: LevelDefinition, count: number): AmbientChargeSpec[] {
  const next = rng(level.id * 2654435761);
  const levelColors: OrbColor[] = [];
  for (const tunnel of level.tunnels) {
    for (const spec of tunnel) if (!levelColors.includes(spec.color)) levelColors.push(spec.color);
  }
  const palette = levelColors.length > 0 ? levelColors : CAMPAIGN_COLORS;

  const specs: AmbientChargeSpec[] = [];
  for (let i = 0; i < Math.max(0, Math.min(3, count)); i += 1) {
    specs.push({
      color: palette[i % palette.length]!,
      phase: (i / Math.max(1, count) + next() * 0.18) % 1,
      // 8.5s..18s, jittered, never a round multiple of another.
      periodMs: Math.round(8500 + i * 3100 + next() * 1700),
      direction: 1,
      trail: 0.16 + next() * 0.12,
    });
  }
  return specs;
}
