import type { OrbColor } from '@/game/engine/types';

/**
 * ORBITIDE palette. Dark, near-black space ground with high-contrast luminous
 * orb colors. Kept in one place so the Skia board and the RN HUD stay in sync.
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
} as const;

/** Primary fill for each orb color. */
export const orbColors: Record<OrbColor, string> = {
  blue: '#3E7BFF',
  yellow: '#FFC24B',
  red: '#FF5C7A',
  green: '#3FDD9B',
  purple: '#B07CFF',
};

/** Lighter glow/halo tint for each orb color. */
export const orbGlow: Record<OrbColor, string> = {
  blue: '#8FB4FF',
  yellow: '#FFE0A0',
  red: '#FF9DB1',
  green: '#93F0CC',
  purple: '#D6BEFF',
};

/** Human-facing color name for the HUD. */
export const orbLabel: Record<OrbColor, string> = {
  blue: 'BLUE',
  yellow: 'YELLOW',
  red: 'RED',
  green: 'GREEN',
  purple: 'PURPLE',
};
