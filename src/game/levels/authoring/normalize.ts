import { defaultHoldingCapacity, emptyTunnelQueues } from '@/game/engine/ruleset';
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
  defaultReplacesLegacy?: boolean,
): LevelDefinition {
  const themeId = authored.themeId ?? authored.theme ?? defaultThemeId ?? 'first-light';
  const ruleset = authored.ruleset === 'coreV2' || authored.ruleset === 'legacyV1'
    ? authored.ruleset
    : undefined;
  const holdingCapacity = authored.holdingCapacity ?? authored.holding ?? defaultHoldingCapacity(ruleset);
  const pixelArt = authored.pixelArt ?? authored.grid ?? [];

  const def: LevelDefinition = {
    id: authored.id,
    title: authored.title ?? `Level ${authored.id}`,
    themeId,
    difficulty: authored.difficulty,
    holdingCapacity,
    pixelArt,
    tunnels: authored.tunnels ?? emptyTunnelQueues(ruleset),
  };

  const replacesLegacy = authored.replacesLegacy ?? defaultReplacesLegacy;
  if (replacesLegacy !== undefined) {
    def.replacesLegacy = replacesLegacy;
  }

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

  if (ruleset) {
    def.ruleset = ruleset;
  }

  if (typeof authored.activeCapacity === 'number' && Number.isInteger(authored.activeCapacity) && authored.activeCapacity > 0) {
    def.activeCapacity = authored.activeCapacity;
  }

  if (authored.winningWitness && authored.winningWitness.length > 0) {
    def.winningWitness = [...authored.winningWitness];
  }

  return def;
}
