/**
 * Level duplication / variation. Pure. Produces a new {@link StudioLevel} with a
 * fresh id and Studio-only provenance (`source`) — provenance is never written
 * into a production {@link import('@/game/engine/types').LevelDefinition}
 * (`toLevelDefinition` builds a fresh object and drops it).
 */
import { cloneReveal } from './reveal';
import type { LevelProvenance, StudioLevel } from './types';

export interface DuplicateOptions {
  id: number;
  title?: string;
  /** Keep the painted artwork (default true). */
  preserveArtwork?: boolean;
  /** Keep the three tunnel queues (default true). */
  preserveTunnels?: boolean;
  /** Keep the authored discovery reveal (default true). */
  preserveReveal?: boolean;
  /** Keep the special-pixel modifiers (default true). */
  preserveModifiers?: boolean;
  note?: string;
}

function baseCopy(level: StudioLevel, id: number, provenance: LevelProvenance, opts: DuplicateOptions): StudioLevel {
  const keepArt = opts.preserveArtwork ?? true;
  const keepTunnels = opts.preserveTunnels ?? true;
  const keepReveal = opts.preserveReveal ?? true;
  const keepMods = opts.preserveModifiers ?? true;

  const out: StudioLevel = {
    id,
    title: opts.title ?? `${level.title} (copy)`,
    themeId: level.themeId,
    difficulty: level.difficulty,
    holdingCapacity: level.holdingCapacity,
    width: level.width,
    height: level.height,
    cells: keepArt ? { ...level.cells } : {},
    tunnels: keepTunnels
      ? level.tunnels.map((q) => q.map((s) => ({ ...s })))
      : [[], [], []],
    source: provenance,
  };
  if (level.legend) out.legend = { ...level.legend };
  if (keepArt && keepMods && level.modifiers) {
    out.modifiers = Object.fromEntries(
      Object.entries(level.modifiers).map(([k, m]) => [k, { kind: m.kind, config: { ...m.config } }]),
    );
  }
  if (keepReveal && level.reveal) out.reveal = cloneReveal(level.reveal);
  if (level.ruleset) out.ruleset = level.ruleset;
  if (level.activeCapacity !== undefined) out.activeCapacity = level.activeCapacity;
  return out;
}

/** A straight duplicate — same everything, new id + title, provenance recorded. */
export function duplicateLevel(level: StudioLevel, opts: DuplicateOptions): StudioLevel {
  return baseCopy(level, opts.id, {
    kind: 'duplicate',
    sourceLevelId: level.id,
    ...(opts.note ? { note: opts.note } : {}),
  }, opts);
}

/**
 * A variation: same artwork + theme + reveal by default, but the author is
 * expected to change queues / capacities next. Tagged so batch tooling can show
 * the family. Reveal is preserved because the picture is the same.
 */
export function createVariation(level: StudioLevel, opts: DuplicateOptions): StudioLevel {
  return baseCopy(level, opts.id, {
    kind: 'variation',
    sourceLevelId: level.id,
    ...(opts.note ? { note: opts.note } : {}),
  }, {
    ...opts,
    title: opts.title ?? `${level.title} (variation)`,
  });
}
