import type { OrbColor } from '@/game/engine/types';
import { orbColors } from './colors';

/**
 * Full 15-color Color Assist system: one unique, machine-language mark per
 * gameplay colour, plus a contrast strategy so the mark stays readable over any
 * base colour. Pure — the RN renderer (components/ColorAssistMark) consumes this.
 *
 * The SAME mark represents a COLOUR everywhere it appears: board pixel, active
 * orbit charge, tunnel front charge, Holding charge.
 */

/** Hue-wheel order — the canonical gameplay palette. */
export const GAMEPLAY_COLORS: OrbColor[] = [
  'white', 'yellow', 'gold', 'orange', 'red', 'coral', 'pink', 'magenta',
  'purple', 'indigo', 'blue', 'cyan', 'teal', 'green', 'lime',
];

/**
 * A mark is composed from a tiny primitive vocabulary so the set reads as one
 * family and every primitive renders cheaply as RN views (no SVG/Skia needed):
 *   dot   – filled centre disc
 *   ring  – stroked circle
 *   bar   – rectangle at an angle (0 = horizontal)
 *   tri   – triangle, up or down, filled or outline
 *   sq    – square at an angle, filled or outline (45° = diamond)
 *   arc   – half-ring, opening up or down
 */
export type MarkPart =
  | { p: 'dot'; scale?: number }
  | { p: 'ring'; scale?: number }
  | { p: 'bar'; angle: number; len?: number; offset?: [number, number] }
  | { p: 'tri'; dir: 'up' | 'down'; fill: boolean }
  | { p: 'sq'; angle: number; fill: boolean }
  | { p: 'arc'; dir: 'up' | 'down' };

export interface ColorMark {
  color: OrbColor;
  /** Stable family name. */
  name: string;
  parts: MarkPart[];
}

/**
 * 15 marks. Related within families (three ring-based, two triangle-based, three
 * bar-based) but each topologically unique. Only one pure rotation pair
 * (orange↔red), and the triangle pair also differs by fill.
 */
const MARKS: Record<OrbColor, Omit<ColorMark, 'color'>> = {
  white: { name: 'dot', parts: [{ p: 'dot' }] },
  yellow: { name: 'ring', parts: [{ p: 'ring' }] },
  gold: { name: 'target', parts: [{ p: 'ring' }, { p: 'dot', scale: 0.5 }] },
  orange: { name: 'bar-h', parts: [{ p: 'bar', angle: 0 }] },
  red: { name: 'bar-v', parts: [{ p: 'bar', angle: 90 }] },
  coral: { name: 'plus', parts: [{ p: 'bar', angle: 0 }, { p: 'bar', angle: 90 }] },
  pink: { name: 'cross', parts: [{ p: 'bar', angle: 45 }, { p: 'bar', angle: -45 }] },
  magenta: { name: 'double-slash', parts: [
    { p: 'bar', angle: 45, len: 0.5, offset: [-0.13, 0.13] },
    { p: 'bar', angle: 45, len: 0.5, offset: [0.13, -0.13] },
  ] },
  purple: { name: 'triangle-up', parts: [{ p: 'tri', dir: 'up', fill: true }] },
  indigo: { name: 'triangle-down', parts: [{ p: 'tri', dir: 'down', fill: false }] },
  blue: { name: 'diamond', parts: [{ p: 'sq', angle: 45, fill: false }] },
  cyan: { name: 'chevron', parts: [
    { p: 'bar', angle: 55, len: 0.5, offset: [-0.16, 0] },
    { p: 'bar', angle: -55, len: 0.5, offset: [0.16, 0] },
  ] },
  teal: { name: 'arc', parts: [{ p: 'arc', dir: 'up' }] },
  green: { name: 'split-ring', parts: [{ p: 'ring' }, { p: 'bar', angle: 90, len: 0.56 }] },
  lime: { name: 'stack', parts: [
    { p: 'bar', angle: 0, offset: [0, -0.18] },
    { p: 'bar', angle: 0, offset: [0, 0.18] },
  ] },
};

export const COLOR_MARKS: Record<OrbColor, ColorMark> = Object.fromEntries(
  GAMEPLAY_COLORS.map((c) => [c, { color: c, ...MARKS[c] }]),
) as Record<OrbColor, ColorMark>;

export function colorMark(color: OrbColor): ColorMark {
  return COLOR_MARKS[color] ?? COLOR_MARKS.white;
}

// ---------------------------------------------------------------------------
// Contrast strategy — the mark adapts fill (and gains a halo) by base luminance.
// ---------------------------------------------------------------------------

export type ContrastStrategy = 'darkOnLight' | 'lightOnDark' | 'lightHaloed';

export interface MarkContrast {
  strategy: ContrastStrategy;
  fill: string;
  /** Outline/halo colour, or null when none is needed. */
  halo: string | null;
}

const DARK = '#0A0D16';
const LIGHT = '#F3F6FF';

/** Relative luminance (0..1) of a #RRGGBB colour. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function markContrast(color: OrbColor): MarkContrast {
  const l = luminance(orbColors[color] ?? '#FFFFFF');
  if (l >= 0.5) return { strategy: 'darkOnLight', fill: DARK, halo: null };
  if (l <= 0.24) return { strategy: 'lightOnDark', fill: LIGHT, halo: null };
  // Mid-luminance bodies are the ambiguous zone — light mark + dark halo.
  return { strategy: 'lightHaloed', fill: LIGHT, halo: DARK };
}

// ---------------------------------------------------------------------------
// Density fallback — simplify the mark without losing its identity.
// ---------------------------------------------------------------------------

export type MarkDetail = 'full' | 'compact' | 'minimal';

/** Board densities: <=9 full, 10-13 compact, >=14 minimal. */
export function markDetail(density: number): MarkDetail {
  if (density <= 9) return 'full';
  if (density <= 13) return 'compact';
  return 'minimal';
}

/**
 * At high density, drop the secondary part of composed marks (keep the ring,
 * drop the inner dot / divider) and raise the minimum relative stroke width so
 * the mark never disappears.
 */
export function simplifiedMark(color: OrbColor, detail: MarkDetail): { parts: MarkPart[]; minStroke: number } {
  const mark = colorMark(color);
  if (detail === 'full') return { parts: mark.parts, minStroke: 0.08 };
  if (detail === 'compact') return { parts: mark.parts, minStroke: 0.12 };
  // minimal: single dominant part, heavier stroke.
  return { parts: [mark.parts[0]!], minStroke: 0.18 };
}

/**
 * Product hint only — surfaces a "recommended" flag on colour-dense levels. It
 * never forces the preference on.
 */
export function recommendColorAssist(distinctColorCount: number): boolean {
  return distinctColorCount >= 6;
}
