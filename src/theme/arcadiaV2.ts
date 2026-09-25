import type { TextStyle, ViewStyle } from 'react-native';

import type { LevelDifficulty } from '@/game/engine/types';

/**
 * M7A — Pixel Arcadia v2 "blue-forward" UI tokens.
 *
 * Source of truth: `design-reference/Pixel Arcadia UI Direction v2.dc.html`.
 * Each hue has one job:
 *   blue   = world (shell, sky, track, framing, nav, HUD glass)
 *   gold   = reward (Play CTA, coins, chests, item counts, launch gate)
 *   cyan   = focus (tap state, selection ring) — transient only
 *   mint   = progress (fill, cleared nodes, "+" buy, win)
 *   coral  = danger (bomb, full slots, rejection, Hard badge, loss)
 *   purple = content only (Pals, pixel art, Super Hard crown) — never chrome
 *
 * Pure data: type-only React Native imports, so unit tests can import it.
 */
export const AV = {
  // Gameplay shell
  shellTop: '#3159C9',
  shellMid: '#2A4AAE',
  shellBottom: '#203B8F',
  trackTop: '#7598FF',
  track: '#5F86FF',
  well: '#10245B',
  textSecondary: '#B8CBFF',

  // Home sky
  skyTop: '#3F6FF2',
  skyMid: '#6F94FF',
  horizon: '#9FC7FF',
  floorGlow: '#C9F2FF',
  ink: '#17306E',
  inkSoft: '#4A62A8',
  inkMuted: '#7F93C4',

  // Surfaces
  plate: '#FFFFFF',
  plateLow: '#EEF3FF',
  plateLip: '#AFC5F5',
  glass: 'rgba(255,255,255,0.12)',
  glassBorder: 'rgba(255,255,255,0.14)',
  glassSoft: 'rgba(255,255,255,0.08)',
  glassDark: 'rgba(15,35,85,0.24)',
  glassDeep: 'rgba(15,35,85,0.30)',
  recess: 'rgba(12,30,80,0.45)',

  // Badge (level) blue
  badgeTop: '#5C8CFF',
  badgeMid: '#2F63E8',
  badgeBottom: '#2450CC',
  badgeLip: '#17368F',
  navTileTop: '#4C7DFF',

  // Accents (earned)
  gold: '#FFC53D',
  goldLight: '#FFE27A',
  goldDeep: '#FFB21E',
  goldLip: '#D98500',
  goldInk: '#5A2A00',
  goldGlint: '#FFF3C4',
  chestInk: '#8A4A00',
  mint: '#3FD99A',
  mintLip: '#1FAE74',
  coral: '#FF5A7A',
  coralDeep: '#D63A63',
  heartTop: '#FF7AA8',
  heartBottom: '#FF4F8B',
  heartLip: '#D62D68',
  cyan: '#4FE3FF',
  purple: '#8C6BFF',
  purpleDeep: '#5B3FD0',

  // Icons
  icon: '#2A4FC0',
  iconSoft: '#3A66E0',

  white: '#FFFFFF',
} as const;

export type AVToken = keyof typeof AV;

/** `#RRGGBB` → `rgba(...)`. Plain JS — precompute outside worklets. */
export function avAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * Fonts, loaded at the app root (`app/_layout.tsx`). Rubik for all UI and
 * numbers; Pixelify Sans only for tiny brand captions (LEVEL, section tags),
 * never body copy. Each weight is its own family on native, so styles pick the
 * family rather than relying on `fontWeight`.
 */
export const AV_FONT = {
  regular: 'Rubik_400Regular',
  medium: 'Rubik_500Medium',
  semibold: 'Rubik_600SemiBold',
  bold: 'Rubik_700Bold',
  extraBold: 'Rubik_800ExtraBold',
  black: 'Rubik_900Black',
  pixel: 'PixelifySans_600SemiBold',
} as const;

export const AV_TYPE: Record<
  'badgeNumber' | 'plateNumber' | 'title' | 'counter' | 'label' | 'value' | 'pixelCaption' | 'cta',
  TextStyle
> = {
  /** Level number on the Home badge — Rubik 900 · 40. */
  badgeNumber: { fontFamily: AV_FONT.black, fontSize: 40, lineHeight: 42 },
  /** Level number on the gameplay plate — Rubik 900 · 24. */
  plateNumber: { fontFamily: AV_FONT.black, fontSize: 24, lineHeight: 26 },
  /** Level title — 800 · 22–24. */
  title: { fontFamily: AV_FONT.extraBold, fontSize: 24, letterSpacing: -0.3 },
  /** Counters — 800 · 14–16, tabular. */
  counter: { fontFamily: AV_FONT.extraBold, fontSize: 16, fontVariant: ['tabular-nums'] },
  /** ACTIVE / HOLDING micro labels — 700 · 10 · +1.5. */
  label: { fontFamily: AV_FONT.bold, fontSize: 10, letterSpacing: 1.5 },
  /** Small value next to a micro label — 800 · 12. */
  value: { fontFamily: AV_FONT.extraBold, fontSize: 12, fontVariant: ['tabular-nums'] },
  /** "LEVEL" caption — Pixelify Sans 600. */
  pixelCaption: { fontFamily: AV_FONT.pixel, fontSize: 11, letterSpacing: 2 },
  /** Gold CTA label — Rubik 900 · 28 · tracking 3. */
  cta: { fontFamily: AV_FONT.black, fontSize: 28, letterSpacing: 3 },
};

/**
 * Depth. Lips are drawn as a solid block offset under the face (RN shadows
 * blur, the design's lips do not); lifts are soft iOS shadows + Android
 * elevation. Glow is reserved for hits and wins — none on chrome.
 */
export const AV_DEPTH = {
  plateLip: 4,
  ctaLip: 6,
  badgeLip: 6,
  lift: {
    shadowColor: '#0F2355',
    shadowOpacity: 0.25,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  softLift: {
    shadowColor: '#234BBE',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
} as const satisfies Record<string, number | ViewStyle>;

/** Implementation-note metrics (pt), 390×844 reference. */
export const AV_SIZE = {
  sideMargin: 16,
  hudTopGap: 7,
  hudRow: 50,
  hudButton: 40,
  levelPlateW: 176,
  levelPlateH: 48,
  progressTabW: 148,
  progressTabH: 18,
  hudToBoard: 28,
  boardToTray: 14,
  trayToTunnels: 14,
  tunnelsToItems: 16,
  itemsToHomeBar: 16,

  tray: 58,
  holdingSlot: 40,
  holdingPal: 32,
  holdingTap: 48,
  activePipW: 16,
  activePipH: 8,

  tunnelCol: 96,
  tunnelGap: 12,
  tunnelH: 170,
  palReady: 56,
  palNext: 38,
  palNextPlus: 30,

  item: 56,
  itemTap: 64,
  itemBadge: 22,
  itemGap: 20,

  cta: { width: 260, height: 66 },
  nav: 70,
  levelBadge: { width: 96, height: 94 },
} as const;

/** Small phones (≤667pt tall) step Pals and items down. */
export const AV_SIZE_COMPACT = {
  palReady: 50,
  palNext: 34,
  palNextPlus: 28,
  item: 48,
} as const;

export const AV_COMPACT_HEIGHT = 667;

export const DIFFICULTY_LABEL: Record<LevelDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  'super-hard': 'Super Hard',
  extreme: 'Extreme',
};

/** Filled pips (of 4) for the difficulty meter. The label carries the name too. */
export const DIFFICULTY_PIPS: Record<LevelDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
  'super-hard': 4,
  extreme: 4,
};

/** Pip colour: gold for Easy/Medium, coral for Hard, violet (content) for Super Hard+. */
export const DIFFICULTY_PIP_COLOR: Record<LevelDifficulty, string> = {
  easy: AV.goldDeep,
  medium: AV.goldDeep,
  hard: AV.coral,
  'super-hard': AV.purple,
  extreme: AV.purple,
};

/**
 * Pixel-stepped outline (6% steps) as a list of `[x, y]` fractions — the
 * signature shape of the level badge and progression nodes. Shared so the
 * Skia drawing and any hit-testing agree.
 */
export const PIXEL_STEP_POLYGON: readonly (readonly [number, number])[] = [
  [0.12, 0], [0.88, 0], [0.88, 0.06], [0.94, 0.06], [0.94, 0.12], [1, 0.12],
  [1, 0.88], [0.94, 0.88], [0.94, 0.94], [0.88, 0.94], [0.88, 1], [0.12, 1],
  [0.12, 0.94], [0.06, 0.94], [0.06, 0.88], [0, 0.88], [0, 0.12], [0.06, 0.12],
  [0.06, 0.06], [0.12, 0.06],
];

/** `1350` → `"1,350"`. Plain string work — no Intl dependency. */
export function formatCount(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
