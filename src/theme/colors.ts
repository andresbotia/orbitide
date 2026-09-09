import type { OrbColor } from '@/game/engine/types';

/**
 * Pixel Arcadia palette. Dark, near-black space ground with high-contrast luminous
 * pixel/charge colors. One source of truth for the Skia field and the RN HUD.
 */
export const palette = {
  /** Page background, darkest. */
  void: '#05060A',
  /** Slightly lifted panel background. */
  abyss: '#0B0E16',
  /** Card / tray surface. */
  surface: '#141926',
  surfaceBorder: '#232A3D',

  textPrimary: '#EEF1F8',
  textSecondary: '#9AA3B8',
  textFaint: '#5A6379',

  core: '#F4F7FF',
  coreGlow: '#8FB4FF',

  ringGuide: '#1B2233',

  success: '#5BE0B0',
  danger: '#FF5C7A',
  warning: '#FFC24B',
} as const;

/**
 * Primary fill for each of the 15 gameplay colors (pixels and charges), in
 * hue-wheel order. Color Assist marks (theme/colorAssist.ts) give every one of
 * these a unique non-color identifier.
 */
export const orbColors: Record<OrbColor, string> = {
  white: '#EEF3FF',
  yellow: '#FFD23F',
  gold: '#F2A93B',
  orange: '#FF8A3C',
  red: '#FF4D4D',
  coral: '#FF6F7D',
  pink: '#FF7BC5',
  magenta: '#E85CD8',
  purple: '#B07CFF',
  indigo: '#6E6BF0',
  blue: '#3E7BFF',
  cyan: '#3BE1F0',
  teal: '#2FD3B4',
  green: '#3FDD9B',
  lime: '#9BE84A',
};

/** Lighter glow/halo tint for each color. */
export const orbGlow: Record<OrbColor, string> = {
  white: '#FFFFFF',
  yellow: '#FFE79A',
  gold: '#FFCE8A',
  orange: '#FFC199',
  red: '#FF9E9E',
  coral: '#FFB0B8',
  pink: '#FFB8DE',
  magenta: '#F6ACEE',
  purple: '#D6BEFF',
  indigo: '#B6B4FF',
  blue: '#8FB4FF',
  cyan: '#9DF0F8',
  teal: '#9BEEDD',
  green: '#93F0CC',
  lime: '#D0F79E',
};

/** Human-facing color name for the HUD / accessibility labels. */
export const orbLabel: Record<OrbColor, string> = {
  white: 'WHITE',
  yellow: 'YELLOW',
  gold: 'GOLD',
  orange: 'ORANGE',
  red: 'RED',
  coral: 'CORAL',
  pink: 'PINK',
  magenta: 'MAGENTA',
  purple: 'PURPLE',
  indigo: 'INDIGO',
  blue: 'BLUE',
  cyan: 'CYAN',
  teal: 'TEAL',
  green: 'GREEN',
  lime: 'LIME',
};
