import type { OrbColor } from '@/game/engine/types';
import { orbColors, orbGlow } from './colors';

/**
 * Cosmic Arcade production surface language: dark navy / indigo environment,
 * painted dark metal, restrained metallic highlights, translucent energy glass,
 * controlled emissive accents. Deliberately not neon, not a dashboard, not
 * generic sci-fi. One source of truth for both the Skia field and the RN chrome.
 */
export const arcade = {
  /** Environment gradient (top -> bottom). */
  envTop: '#0C1226',
  envMid: '#080C1A',
  envBottom: '#04060E',

  /** Painted dark metal housings. */
  metal: '#151B2E',
  metalRaised: '#1C2440',
  metalHi: '#333E63',
  metalLo: '#090D18',
  metalEdge: '#3A4770',
  metalSeam: 'rgba(4,6,14,0.9)',

  /** Recessed socket interior. */
  socket: '#0A0E1A',
  socketRim: '#232C48',

  /** Translucent energy glass. */
  glassFill: 'rgba(126,166,255,0.10)',
  glassHi: 'rgba(190,214,255,0.5)',
  glassEdge: 'rgba(150,180,255,0.35)',

  /** Controlled emissive accent. */
  accent: '#7FA6FF',
  accentSoft: 'rgba(127,166,255,0.22)',
  accentDim: '#3C4C7A',

  /** Orbit rail. */
  railBase: '#1B2338',
  railGroove: '#080B15',
  railHighlight: '#43507B',
  railShadow: 'rgba(3,5,12,0.85)',

  warn: '#FFC24B',
  danger: '#FF5C7A',

  /** Home backdrop — deep-space nebula haze (very low opacity in use). */
  nebulaCore: '#1A2350',
  nebulaEdge: '#0A0E22',
  starFar: '#8CA6DE',
  starNear: '#D6E2FF',
} as const;

/** Resolve a difficulty accent token name to its colour. */
export const accentColor = {
  accent: arcade.accent,
  warn: arcade.warn,
  danger: arcade.danger,
} as const;

/**
 * Per-color material stops for a dimensional pixel: base body, a lighter top
 * highlight and a darker lower shadow, plus the emissive rim tint. Directional
 * lighting is consistent (top-left highlight, bottom-right shadow).
 */
export interface PixelMaterial {
  base: string;
  top: string;
  bottom: string;
  rim: string;
}

function mix(hex: string, withHex: string, amount: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(withHex.slice(1), 16);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * amount);
  const g = Math.round(ag + (bg - ag) * amount);
  const bl = Math.round(ab + (bb - ab) * amount);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

const materialCache = new Map<OrbColor, PixelMaterial>();

export function pixelMaterial(color: OrbColor): PixelMaterial {
  const cached = materialCache.get(color);
  if (cached) return cached;
  const base = orbColors[color];
  const material: PixelMaterial = {
    base,
    top: mix(base, '#FFFFFF', 0.32),
    bottom: mix(base, '#05070E', 0.34),
    rim: orbGlow[color],
  };
  materialCache.set(color, material);
  return material;
}

/**
 * The full 15-mark Color Assist system now lives in `theme/colorAssist.ts`
 * (pure model) + `components/ColorAssistMark.tsx` (renderer).
 */
