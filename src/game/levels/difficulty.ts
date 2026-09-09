import type { LevelDifficulty } from '../engine/types';

/**
 * The one authoritative difficulty model. Home, the gameplay HUD, the
 * level-intro Gate and a future level-select all read this — no second system.
 *
 * The Difficulty Gate is a physical machined frame whose GEOMETRY changes by
 * tier (frame shape, mounting-block count, segmentation, outer guard, fracture).
 * Colour is a secondary accent only; the tiers stay distinguishable in
 * grayscale and at ~18px.
 */

export type GateLabel = 'NORMAL' | 'MEDIUM' | 'HARD' | 'SUPER HARD' | 'EXTREME';
export type GateAccent = 'accent' | 'warn' | 'danger';

export interface GateGeometry {
  key: LevelDifficulty;
  label: GateLabel;
  /** 1..5. */
  tier: number;
  /** NORMAL/MEDIUM are round; HARD+ are angular. */
  frame: 'ring' | 'hex';
  /** Physical mounting blocks — equals the tier (1..5). The reliable counter. */
  blocks: number;
  /** Guard segments cut into the frame. 0 = clean ring (NORMAL only). */
  segments: number;
  /** Secondary concentric guard frame (SUPER HARD, EXTREME). */
  outerGuard: boolean;
  /** Asymmetric energy fracture across the frame (EXTREME only). */
  fracture: boolean;
  /** Line-weight multiplier — heavier as tension rises. */
  strokeScale: number;
  accent: GateAccent;
}

const GATES: Record<LevelDifficulty, GateGeometry> = {
  easy: { key: 'easy', label: 'NORMAL', tier: 1, frame: 'ring', blocks: 1, segments: 0, outerGuard: false, fracture: false, strokeScale: 1.0, accent: 'accent' },
  medium: { key: 'medium', label: 'MEDIUM', tier: 2, frame: 'ring', blocks: 2, segments: 4, outerGuard: false, fracture: false, strokeScale: 1.18, accent: 'accent' },
  hard: { key: 'hard', label: 'HARD', tier: 3, frame: 'hex', blocks: 3, segments: 6, outerGuard: false, fracture: false, strokeScale: 1.34, accent: 'warn' },
  'super-hard': { key: 'super-hard', label: 'SUPER HARD', tier: 4, frame: 'hex', blocks: 4, segments: 6, outerGuard: true, fracture: false, strokeScale: 1.5, accent: 'danger' },
  extreme: { key: 'extreme', label: 'EXTREME', tier: 5, frame: 'hex', blocks: 5, segments: 8, outerGuard: true, fracture: true, strokeScale: 1.7, accent: 'danger' },
};

export function gateGeometry(difficulty: LevelDifficulty): GateGeometry {
  return GATES[difficulty] ?? GATES.easy;
}

export const MAX_DIFFICULTY_TIER = 5;

/** Human sentence for accessibility labels: "Difficulty: Super Hard". */
export function difficultyA11yLabel(difficulty: LevelDifficulty): string {
  const label = gateGeometry(difficulty).label;
  return `Difficulty: ${label.charAt(0)}${label.slice(1).toLowerCase()}`;
}

/**
 * Legacy accessor kept so callers that only need a name/tier/accent do not have
 * to know about Gate geometry. Derived from the same table — not a second copy.
 */
export interface DifficultyMeta {
  key: LevelDifficulty;
  label: string;
  tier: number;
  accent: GateAccent;
}

export function difficultyMeta(difficulty: LevelDifficulty): DifficultyMeta {
  const g = gateGeometry(difficulty);
  return { key: g.key, label: g.label, tier: g.tier, accent: g.accent };
}

// ---------------------------------------------------------------------------
// Gate primitives — pure geometry a Skia/SVG renderer can draw directly.
// ---------------------------------------------------------------------------

export interface GateBlock {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rotation in radians, tangent to the frame. */
  rot: number;
}

export interface GatePrimitives {
  size: number;
  center: { x: number; y: number };
  r: number;
  frame: { kind: 'ring' | 'hex'; path: string };
  outerGuard: { kind: 'ring' | 'hex'; path: string } | null;
  segmentTicks: string[];
  blocks: GateBlock[];
  fracture: string | null;
  strokeWidth: number;
}

function ringPath(cx: number, cy: number, r: number): string {
  return `M ${(cx - r).toFixed(2)} ${cy.toFixed(2)} `
    + `A ${r.toFixed(2)} ${r.toFixed(2)} 0 1 1 ${(cx + r).toFixed(2)} ${cy.toFixed(2)} `
    + `A ${r.toFixed(2)} ${r.toFixed(2)} 0 1 1 ${(cx - r).toFixed(2)} ${cy.toFixed(2)} Z`;
}

function hexPoints(cx: number, cy: number, r: number): { x: number; y: number }[] {
  return Array.from({ length: 6 }, (_, k) => {
    const a = (-90 + k * 60) * (Math.PI / 180);
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

function polyPath(points: { x: number; y: number }[], close = true): string {
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  return close ? `${d} Z` : d;
}

/**
 * Build the Gate geometry for a `size x size` box. Pure — no RN/Skia — so the
 * non-colour identifiers (frame kind, block count, tick count, guard, fracture)
 * are testable straight from the output.
 */
export function gatePrimitives(difficulty: LevelDifficulty, size: number): GatePrimitives {
  const g = gateGeometry(difficulty);
  const center = { x: size / 2, y: size / 2 };
  const pad = size * (g.outerGuard ? 0.2 : 0.14);
  const r = size / 2 - pad;
  const strokeWidth = Math.max(1, size * 0.055 * g.strokeScale);

  const frame = g.frame === 'ring'
    ? { kind: 'ring' as const, path: ringPath(center.x, center.y, r) }
    : { kind: 'hex' as const, path: polyPath(hexPoints(center.x, center.y, r)) };

  const outerGuard = g.outerGuard
    ? (g.frame === 'ring'
      ? { kind: 'ring' as const, path: ringPath(center.x, center.y, r + size * 0.12) }
      : { kind: 'hex' as const, path: polyPath(hexPoints(center.x, center.y, r + size * 0.12)) })
    : null;

  const segmentTicks: string[] = [];
  for (let i = 0; i < g.segments; i += 1) {
    const a = (-90 + (i + 0.5) * (360 / g.segments)) * (Math.PI / 180);
    const inner = r - size * 0.09;
    const outer = r + size * 0.05;
    segmentTicks.push(
      `M ${(center.x + Math.cos(a) * inner).toFixed(2)} ${(center.y + Math.sin(a) * inner).toFixed(2)} `
      + `L ${(center.x + Math.cos(a) * outer).toFixed(2)} ${(center.y + Math.sin(a) * outer).toFixed(2)}`,
    );
  }

  const blockR = r + size * 0.02;
  const blockSize = size * 0.16;
  const blocks: GateBlock[] = Array.from({ length: g.blocks }, (_, k) => {
    const a = (90 + k * (360 / g.blocks)) * (Math.PI / 180);
    return {
      x: center.x + Math.cos(a) * blockR,
      y: center.y + Math.sin(a) * blockR,
      w: blockSize,
      h: blockSize * 0.62,
      rot: a + Math.PI / 2,
    };
  });

  // Asymmetric energy fracture: upper-left to lower-right, kinked off-centre.
  const fracture = g.fracture
    ? polyPath([
      { x: center.x - r * 0.95, y: center.y - r * 0.55 },
      { x: center.x - r * 0.15, y: center.y - r * 0.1 },
      { x: center.x + r * 0.12, y: center.y + r * 0.34 },
      { x: center.x + r * 0.5, y: center.y + r * 0.2 },
      { x: center.x + r * 0.98, y: center.y + r * 0.66 },
    ], false)
    : null;

  return { size, center, r, frame, outerGuard, segmentTicks, blocks, fracture, strokeWidth };
}

// ---------------------------------------------------------------------------
// Difficulty-intro hooks (architecture only; the current render is a settle).
// ---------------------------------------------------------------------------

export interface GateIntroTimeline {
  /** Total settle duration, ms. */
  duration: number;
  /** Beat fractions (0..1 of duration) at which each structure locks in. */
  phases: { frame: number; segments: number; blocks: number; guard: number; fracture: number };
  /** Semantic haptic hook name, or null. */
  haptic: string | null;
  /** Semantic sound hook name, or null. */
  sound: string | null;
}

export function gateIntroTimeline(difficulty: LevelDifficulty): GateIntroTimeline {
  const g = gateGeometry(difficulty);
  const duration = 220 + g.tier * 90; // NORMAL 310ms .. EXTREME 670ms
  return {
    duration,
    phases: {
      frame: 0.35,
      segments: g.segments > 0 ? 0.55 : 0,
      blocks: 0.7,
      guard: g.outerGuard ? 0.82 : 0,
      fracture: g.fracture ? 0.95 : 0,
    },
    haptic: g.tier >= 3 ? 'gateLock' : g.tier === 2 ? 'select' : null,
    sound: `gate_${g.key}`,
  };
}
