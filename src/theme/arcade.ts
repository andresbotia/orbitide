import type { OrbColor } from '@/game/engine/types';
import { orbColors, orbGlow } from './colors';

/**
 * Cosmic Arcade production surface language: dark navy / indigo environment,
 * painted dark metal, restrained metallic highlights, translucent energy glass,
 * controlled emissive accents. Deliberately not neon, not a dashboard, not
 * generic sci-fi. One source of truth for both the Skia field and the RN chrome.
 *
 * MIGRATION STATUS (redesign Milestone 1): this module is the pre-Pixel-
 * Arcadia "Cosmic Arcade" material layer. It is being retired GRADUALLY, one
 * consumer at a time, across the redesign roadmap (Home, World map, Gameplay
 * board/HUD, Tunnels/Holding, Win/fail — see `docs/DESIGN.md`) in favour of
 * `theme/material.ts`. It is intentionally NOT rewritten wholesale here: every
 * current consumer (`OrbitBoard`, `TunnelBar`, `HoldingTray`, `Hud`,
 * `WorldCard`, `LevelNode`, ...) keeps its exact current appearance until its
 * own milestone migrates it. Do not add new consumers of this module — use
 * `theme/material.ts` for anything new.
 *
 * The cosmic-specific env/nebula/star tokens below are `@deprecated`: they
 * describe the old "deep space" identity, not the Pixel Arcadia icon's warm-
 * portal/arcade-block language, and must not be repurposed to mean something
 * else (e.g. do not silently redefine `starFar` as a generic "small dot"
 * token to dodge a migration — add a real `material.ts` role instead). The
 * generic hardware-material tokens (`metal*`, `socket*`, `glass*`, `rail*`,
 * `accent`/`warn`/`danger`) are NOT deprecated in the same sense — they are a
 * still-useful compatibility layer for the physical-hardware "look" until
 * each consumer's own milestone reskins it onto `material.ts`.
 */
export const arcade = {
  /** Environment gradient (top -> bottom). Generic dark-ground role — see migration status above; not itself cosmic-specific, but a candidate to move to `material.background`-family tokens once a consumer's milestone touches it. */
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

  /**
   * @deprecated Cosmic Arcade — deep-space nebula haze. This is the Orbitide-
   * era Home/board backdrop identity the redesign is replacing (redesign
   * audit finding B.1/B.2), not a generic "background glow" role. Kept only
   * because `StarfieldBackdrop`/`OrbitBoard`'s `Starfield` still consume it
   * unchanged until their own milestones (Home = Milestone 2, board =
   * Milestone 4). Do not repurpose this name for a different effect — if a
   * new surface needs a soft glow, add a role to `theme/material.ts` instead.
   * Note: `cosmic-frontier` is planned to keep a starfield as ONE world's
   * deliberate environmental skin (`theme/worldSkins.ts`) — that is a
   * per-world choice made through the skin system, not a reason to un-
   * deprecate these global tokens.
   */
  nebulaCore: '#1A2350',
  /** @deprecated See `nebulaCore`. */
  nebulaEdge: '#0A0E22',
  /** @deprecated See `nebulaCore`. */
  starFar: '#8CA6DE',
  /** @deprecated See `nebulaCore`. */
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
