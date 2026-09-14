/**
 * HOME-SCOPED V2 visual tokens (locked Home redesign).
 *
 * Do not copy these into `brand.ts` / `material.ts` / `arcade.ts`. Worlds and
 * Gameplay keep their existing token systems until their own milestones.
 */

export const homeV2 = {
  navy: '#002662',
  cyan: '#01D8FD',
  purple: '#5C44D7',
  red: '#F24B5D',
  yellow: '#FDD54B',
  white: '#FDFDFD',
  deepNavy: '#001742',
  playSkirt: '#C79A18',
} as const;

export type HomeV2Token = keyof typeof homeV2;

/** Presentation-only placeholders — no economy / heart-loss logic. */
export const HOME_HEARTS_PLACEHOLDER = 5;
export const HOME_COINS_PLACEHOLDER = 0;

export function homeAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
