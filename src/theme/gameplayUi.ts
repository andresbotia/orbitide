import type { TextStyle } from 'react-native';

import { AV, AV_FONT } from './arcadiaV2';
import { neonAlpha } from './neon';

/**
 * The gameplay screen's one visual system. Every gameplay chrome component
 * (HUD, tray, Holding, tunnels, items, overlays) reads colour, corner and type
 * from here instead of mixing raw hexes.
 *
 * M7A — retinted to the v2 blue-forward palette (`arcadiaV2.ts`): a clear
 * mid-tone blue shell, the board well as the only deep surface, glass chrome.
 * Cyan = focus / tap (transient). Gold = reward. Coral (`danger`) = refusal,
 * FULL, reject, loss. Mint = progress. Purple never appears in chrome.
 * Values fed to `gpAlpha` stay `#RRGGBB`. Pure data: type-only RN import.
 */
export const GP = {
  cyan: AV.cyan,
  cyanPale: '#C9F2FF',
  gold: AV.gold,
  goldDeep: AV.goldLip,
  magenta: AV.coral,
  danger: AV.coral,
  mint: AV.mint,

  // Surfaces, darkest → lightest.
  canvas: AV.shellBottom,
  wellDeep: AV.well,
  well: '#1A3378',
  panel: AV.shellMid,
  deck: 'transparent',

  // Lines.
  hairline: 'rgba(255,255,255,0.12)',
  hairlineStrong: 'rgba(255,255,255,0.24)',
  litEdge: 'rgba(255,255,255,0.32)',

  // Text.
  text: '#FFFFFF',
  textSecondary: AV.textSecondary,
  textMuted: 'rgba(184,203,255,0.62)',
  textFaint: 'rgba(184,203,255,0.36)',

  /** Full-screen modal scrim (loss). */
  scrim: 'rgba(10,25,70,0.72)',
} as const;

export const gpAlpha = neonAlpha;

export const GP_RADIUS = {
  chip: 8,
  control: 12,
  well: 14,
  bay: 16,
  panel: 20,
} as const;

/** Display face — loaded at the app root (`app/_layout.tsx`). v2: Rubik 900. */
export const GP_DISPLAY_FONT = AV_FONT.black;

export const GP_TYPE: Record<'label' | 'numeral' | 'body', TextStyle> = {
  /** ACTIVE / HOLDING / LV micro labels. */
  label: { fontFamily: AV_FONT.bold, fontSize: 10, letterSpacing: 1.5 },
  /** Status numerals (3/5, 1/3, %). */
  numeral: { fontFamily: AV_FONT.extraBold, fontSize: 12, fontVariant: ['tabular-nums'] },
  /** Short one-line gameplay copy (coach, status). */
  body: { fontFamily: AV_FONT.semibold, fontSize: 12, letterSpacing: 0.1 },
};
