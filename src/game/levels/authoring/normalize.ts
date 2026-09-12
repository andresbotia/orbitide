import type { LevelDefinition } from '@/game/engine/types';
import type { AuthoredLevel } from './types';

/**
 * Normalizes an externally authored level object into a strict LevelDefinition.
 * Resolves aliases (grid -> pixelArt, holding -> holdingCapacity, theme -> themeId),
 * applies sensible defaults, and prunes undefined presentation hooks.
 */
export function normalizeAuthoredLevel(
  authored: AuthoredLevel,
  defaultThemeId?: string,
): LevelDefinition {
  const themeId = authored.themeId ?? authored.theme ?? defaultThemeId ?? 'first-light';
  const holdingCapacity = authored.holdingCapacity ?? authored.holding ?? 3;
  const pixelArt = authored.pixelArt ?? authored.grid ?? [];

  const def: LevelDefinition = {
    id: authored.id,
    title: authored.title ?? `Level ${authored.id}`,
    themeId,
    difficulty: authored.difficulty,
    holdingCapacity,
    pixelArt,
    tunnels: authored.tunnels ?? [[], [], []],
  };

  if (authored.legend && Object.keys(authored.legend).length > 0) {
    def.legend = { ...authored.legend };
  }

  if (authored.modifiers && Object.keys(authored.modifiers).length > 0) {
    def.modifiers = { ...authored.modifiers };
  }

  if (authored.reveal) {
    def.reveal = authored.reveal;
  }

  if (authored.tutorial) {
    def.tutorial = authored.tutorial;
  }

  return def;
}
