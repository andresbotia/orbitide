import type { TextStyle } from 'react-native';

import { NEON, neonAlpha } from './neon';

/**
 * M5.8B — the gameplay screen's one visual system (see
 * `docs/M5.8B_GAMEPLAY_RELEASE_UI_SPEC.md`). Every gameplay chrome component
 * (HUD, status strip, Holding, tunnels, items, overlays) reads colour, corner
 * and type from here instead of mixing `NEON` / `material` / raw hexes.
 *
 * Surfaces are navy ink with no hue so gameplay colours stay dominant. Cyan =
 * live / yours / go. Gold = reward and non-fatal pressure. Danger = refusal,
 * FULL, reject, loss — never a large fill. No purple/violet/lavender.
 * Pure data: type-only React Native import.
 */
export const GP = {
  cyan: NEON.cyan,
  cyanPale: NEON.cyanPale,
  gold: NEON.gold,
  goldDeep: NEON.goldDeep,
  magenta: NEON.magenta,
  danger: '#FF4D6A',

  // Surfaces, darkest → lightest.
  canvas: NEON.inkDeep,
  wellDeep: '#020A15',
  well: '#051628',
  panel: '#071B2E',
  deck: neonAlpha(NEON.ink, 0.94),

  // Lines.
  hairline: neonAlpha(NEON.cyan, 0.14),
  hairlineStrong: neonAlpha(NEON.cyan, 0.32),
  litEdge: neonAlpha(NEON.cyan, 0.5),

  // Text.
  text: '#EAFBFF',
  textSecondary: neonAlpha(NEON.cyanPale, 0.72),
  textMuted: neonAlpha(NEON.cyanPale, 0.45),
  textFaint: neonAlpha(NEON.cyanPale, 0.28),

  /** Full-screen modal scrim (loss). */
  scrim: 'rgba(3,12,26,0.72)',
} as const;

export const gpAlpha = neonAlpha;

export const GP_RADIUS = {
  chip: 8,
  control: 12,
  well: 14,
  bay: 16,
  panel: 20,
} as const;

/** Display face — loaded at the app root (`app/_layout.tsx`). */
export const GP_DISPLAY_FONT = 'SpaceGrotesk_700Bold';

export const GP_TYPE: Record<'label' | 'numeral' | 'body', TextStyle> = {
  /** ACTIVE / HOLDING / LV micro labels. */
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  /** Status numerals (3/5, 1/3, %). */
  numeral: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  /** Short one-line gameplay copy (coach, status). */
  body: { fontSize: 12, fontWeight: '600', letterSpacing: 0.1 },
};
