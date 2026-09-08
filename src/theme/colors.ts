import type { OrbColor } from '@/game/engine/types';

/**
 * ORBITIDE palette. Dark, near-black space ground with high-contrast luminous
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

/** Primary fill for each color (pixels and charges). */
export const orbColors: Record<OrbColor, string> = {
  blue: '#3E7BFF',
  cyan: '#3BE1F0',
  white: '#EEF3FF',
  purple: '#B07CFF',
  pink: '#FF7BC5',
  yellow: '#FFC24B',
  orange: '#FF9A3C',
  red: '#FF5C6A',
  green: '#3FDD9B',
};

/** Lighter glow/halo tint for each color. */
export const orbGlow: Record<OrbColor, string> = {
  blue: '#8FB4FF',
  cyan: '#9DF0F8',
  white: '#FFFFFF',
  purple: '#D6BEFF',
  pink: '#FFB8DE',
  yellow: '#FFE0A0',
  orange: '#FFC79A',
  red: '#FFA6AE',
  green: '#93F0CC',
};

/** Human-facing color name for the HUD / accessibility labels. */
export const orbLabel: Record<OrbColor, string> = {
  blue: 'BLUE',
  cyan: 'CYAN',
  white: 'WHITE',
  purple: 'PURPLE',
  pink: 'PINK',
  yellow: 'YELLOW',
  orange: 'ORANGE',
  red: 'RED',
  green: 'GREEN',
};
