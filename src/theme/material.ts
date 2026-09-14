import { palette } from './colors';
import { brandColor } from './brand';

/**
 * PIXEL ARCADIA MATERIAL SYSTEM (redesign Milestone 1).
 *
 * The new, icon-derived semantic role system for product chrome: dimensional
 * indigo/violet structure, upper-left edge lighting / darker lower bevel,
 * warm amber/gold energy, cyan informational accent.
 *
 * This is intentionally a NEW module, not a rewrite of `theme/arcade.ts`.
 * `arcade.ts` ("Cosmic Arcade") is being retired *gradually*, one consumer at
 * a time, across the milestones in the redesign roadmap — Home (Milestone
 * 2), World map (Milestone 3), Gameplay board/HUD (Milestone 4), Tunnels/
 * Holding (Milestone 5), Win/fail (Milestone 7). Nothing in this milestone
 * rewires an existing component to `material` yet; this file exists so those
 * later milestones have one real system to migrate onto instead of inventing
 * per-screen colours. See `docs/DESIGN.md` for the full "which system, where"
 * rule and the deprecation notes on `arcade.ts`.
 *
 * Values are named by ROLE, not by screen — a role is used wherever it
 * semantically applies, never re-derived per surface.
 */
export const material = {
  // Backgrounds --------------------------------------------------------
  /** App root / full-bleed background. */
  background: brandColor.background,
  /** A background one step up — sheets, secondary screens. */
  elevatedBackground: brandColor.backgroundAlt,

  // Surfaces (the dimensional "block" body of hardware/chrome) ---------
  /** Default panel/card/hardware-housing body. */
  structuralSurface: brandColor.surface,
  /** A surface that reads as physically closer/raised — pressed-in-front chrome. */
  raisedSurface: '#2C3578',
  /** A surface that reads as recessed — sockets, wells, tunnel/holding ports. */
  recessedSurface: '#141B48',

  // Bevel / edge lighting (upper-left highlight, lower-right shadow) ---
  /** Top-left edge highlight on a dimensional block. */
  bevelHighlight: '#5C63C4',
  /** Bottom-right edge shadow on a dimensional block. */
  bevelShadow: '#080B24',
  /** Hairline/divider, non-bevel outline. */
  outline: brandColor.border,

  // Energy (warm) --------------------------------------------------------
  /** The one warm "this is alive / this is the reward" colour. */
  energyWarm: brandColor.portalWarm,
  /** Radial/soft-glow tint paired with `energyWarm`. Decorative only. */
  energyGlow: brandColor.glow,

  // Informational (cool) -------------------------------------------------
  /** Cool accent for progress fills, links, non-CTA highlights. Never a tappable fill. */
  accentCyan: brandColor.cyanAccent,

  // Status ---------------------------------------------------------------
  success: palette.success,
  danger: palette.danger,
  warning: palette.warning,

  // Text -------------------------------------------------------------------
  textPrimary: brandColor.textPrimary,
  textSecondary: brandColor.textSecondary,
  /** Muted, non-interactive ink — disabled labels/glyphs. */
  disabled: '#5B5790',

  // Overlay ------------------------------------------------------------
  /** Full-screen scrim behind a modal/sheet. */
  overlay: 'rgba(9,10,30,0.86)',
} as const;

export type MaterialToken = keyof typeof material;
