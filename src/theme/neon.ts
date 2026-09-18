/**
 * NEON tokens — Pixel Arcadia's shared product-chrome palette.
 *
 * Originated as the Home-only rebuild palette; the Gameplay redesign pass
 * (board/HUD/control-deck) adopted it as-is instead of inventing a second
 * "gameplay" palette, so Home and Gameplay are now both `NEON` consumers.
 * Neon only reads as neon when the surfaces around it stay dark and
 * desaturated, so every bright element is cyan, magenta, or gold and
 * everything else is deep navy. There is no purple or violet in this system,
 * deliberately — lavender lighting is what made an earlier render read as
 * generic (see `homeV2.ts`, now superseded).
 *
 * Do not copy these into `brand.ts` / `material.ts` / `arcade.ts` — Worlds
 * still keeps its own token system until its own milestone. `material.ts`'s
 * violet/indigo hardware system was drafted as gameplay's originally-planned
 * target and was superseded by this palette before any component adopted it;
 * `material.ts`'s hue-neutral status roles (`success`/`danger`/`warning`,
 * `textPrimary`/`textSecondary`, `overlay`) are unaffected and still used by
 * both Home and Gameplay chrome.
 */

export const NEON = {
  cyan: '#22E6FF',
  cyanPale: '#8CF7FF',
  magenta: '#FF2E88',
  gold: '#FFC94D',
  goldDeep: '#E8A93C',
  ink: '#04121F',
  inkDeep: '#030C1A',
  surface: 'rgba(4,18,31,0.72)',
} as const;

export type NeonToken = keyof typeof NEON;

/** `#RRGGBB` → `rgba(...)`. Mirrors `homeAlpha` so call sites read the same. */
export function neonAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
