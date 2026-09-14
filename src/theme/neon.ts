/**
 * HOME-SCOPED NEON tokens (Pixel Arcadia arcade-scene rebuild).
 *
 * The locked palette for the Home screen: neon only reads as neon when the
 * surfaces around it stay dark and desaturated, so every bright element is
 * cyan, magenta, or gold and everything else is deep navy. There is no purple
 * or violet in this system, deliberately — lavender lighting is what made the
 * previous render read as generic.
 *
 * Home-scoped like `homeV2.ts` before it. Do not copy these into `brand.ts` /
 * `material.ts` / `arcade.ts`; Worlds and Gameplay keep their existing token
 * systems until their own milestones.
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
