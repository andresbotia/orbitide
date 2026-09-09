/**
 * Special-pixel AUTHORING model for the Level Studio. Pure — no React / RN.
 *
 * This layer authors *metadata and visual/config state* for the eight modifier
 * kinds already declared on the engine ({@link ModifierKind}). It does NOT
 * implement any mechanic: the engine still ignores `pixel.modifier` entirely.
 * When a real gameplay rule is decided, it consumes the same fields — nothing
 * here has to change. See docs/M3C_PRODUCTION_AUTHORING.md.
 *
 * A special pixel keeps its base colour identity: the modifier is a sidecar on
 * the cell, never a replacement for the painted colour.
 *
 *   Studio shape            engine shape ({@link ModifierInstance})
 *   ─────────────────────   ───────────────────────────────────────
 *   { kind, config:{        { kind,
 *       layers,               level:  layers,
 *       group,                group / linkId:  group,
 *       timer,                level:  timer   (bomb only),
 *       seed } }              seed:   seed }
 */
import type { ModifierInstance, ModifierKind } from '@/game/engine/types';
import { cellKey, parseCellKey } from './grid';
import type { StudioLevel, StudioModifier } from './types';

/** The eight modifier kinds the Studio can author (the full engine vocabulary). */
export const MODIFIER_KINDS: ModifierKind[] = [
  'frozen', 'shielded', 'armored', 'locked', 'hidden', 'bomb', 'wild', 'linked',
];

export type ModifierConfigField = 'layers' | 'group' | 'timer';

export interface ModifierKindSpec {
  kind: ModifierKind;
  label: string;
  /** Short marker glyph for the Studio canvas overlay (not production art). */
  marker: string;
  /** One-line authoring description. */
  hint: string;
  /** Which config fields this kind authors. */
  fields: ModifierConfigField[];
  /** Inclusive bounds for the `layers` field, when the kind has one. */
  layers?: { min: number; max: number; default: number; label: string };
  /** `true` when a `group` id is required (Linked). */
  groupRequired?: boolean;
  /**
   * `true` when this kind has NO decided gameplay rule yet, so its config is a
   * neutral placeholder the engine never consumes.
   */
  placeholder?: boolean;
}

/**
 * Per-kind authoring spec. `layers` bounds match the renderer state machines in
 * `src/game/rendering/specialPixels.ts` where those already exist (armored
 * clamps plate count to 1..4, etc.). Where a gameplay rule is undecided the
 * smallest neutral representation is used.
 */
export const MODIFIER_SPECS: Record<ModifierKind, ModifierKindSpec> = {
  frozen: {
    kind: 'frozen', label: 'Frozen', marker: '❄', fields: ['layers'],
    hint: 'Ice shell over the base pixel. `layers` = crack-stage / durability count.',
    layers: { min: 1, max: 4, default: 1, label: 'crack stages' },
  },
  shielded: {
    kind: 'shielded', label: 'Shielded', marker: '◌', fields: ['layers'],
    hint: 'Energy shield around the base pixel. `layers` = shield strength.',
    layers: { min: 1, max: 3, default: 1, label: 'shield layers' },
  },
  armored: {
    kind: 'armored', label: 'Armored', marker: '▣', fields: ['layers'],
    hint: 'Bolted plates over the base pixel. `layers` = plate count / durability.',
    layers: { min: 1, max: 4, default: 2, label: 'plate count' },
  },
  locked: {
    kind: 'locked', label: 'Locked', marker: '⊟', fields: ['group'],
    hint: 'Clamped until released. Optional `group` ties it to a lock/key set.',
  },
  hidden: {
    kind: 'hidden', label: 'Hidden', marker: '⬗', fields: ['layers'],
    hint: 'Concealed until revealed. `layers` = concealment stages. No reveal-condition rule is defined yet.',
    layers: { min: 1, max: 3, default: 1, label: 'concealment stages' },
    placeholder: true,
  },
  bomb: {
    kind: 'bomb', label: 'Bomb', marker: '◈', fields: ['timer'],
    hint: 'Placeholder only — no countdown rule is decided. Optional `timer` is inert authoring metadata.',
    placeholder: true,
  },
  wild: {
    kind: 'wild', label: 'Wild', marker: '◇', fields: [],
    hint: 'Matches any colour (rule undecided). No config.',
    placeholder: true,
  },
  linked: {
    kind: 'linked', label: 'Linked', marker: '⋈', fields: ['group'],
    hint: 'Clears with its link group. `group` id is required; a group needs ≥ 2 members.',
    groupRequired: true,
  },
};

/** A fresh, in-bounds config for a newly-applied modifier of `kind`. */
export function defaultConfig(kind: ModifierKind): StudioModifier['config'] {
  const spec = MODIFIER_SPECS[kind];
  const config: StudioModifier['config'] = {};
  if (spec.layers) config.layers = spec.layers.default;
  return config;
}

export function makeModifier(kind: ModifierKind, config: Partial<StudioModifier['config']> = {}): StudioModifier {
  return { kind, config: { ...defaultConfig(kind), ...pruneConfig(config) } };
}

function pruneConfig(config: Partial<StudioModifier['config']>): StudioModifier['config'] {
  const out: StudioModifier['config'] = {};
  if (config.layers !== undefined) out.layers = config.layers;
  if (config.group !== undefined && config.group !== '') out.group = config.group;
  if (config.timer !== undefined) out.timer = config.timer;
  if (config.seed !== undefined) out.seed = config.seed;
  return out;
}

// ── pure Studio-document operations ─────────────────────────────────────────

const withModifiers = (level: StudioLevel, modifiers: Record<string, StudioModifier>): StudioLevel => {
  if (Object.keys(modifiers).length === 0) {
    if (!level.modifiers) return level;
    const { modifiers: _drop, ...rest } = level;
    return rest;
  }
  return { ...level, modifiers };
};

/** Apply (or replace) a modifier on the pixel at `(x, y)`. No-op on an empty cell. */
export function setModifier(level: StudioLevel, x: number, y: number, kind: ModifierKind): StudioLevel {
  const key = cellKey(x, y);
  if (!(key in level.cells)) return level;
  if (!MODIFIER_KINDS.includes(kind)) return level;
  const next = { ...(level.modifiers ?? {}) };
  const prev = next[key];
  next[key] = prev && prev.kind === kind ? prev : makeModifier(kind);
  return withModifiers(level, next);
}

/** Remove any modifier on `(x, y)`. */
export function removeModifier(level: StudioLevel, x: number, y: number): StudioLevel {
  const key = cellKey(x, y);
  if (!level.modifiers || !(key in level.modifiers)) return level;
  const next = { ...level.modifiers };
  delete next[key];
  return withModifiers(level, next);
}

/** Patch the config of the modifier on `(x, y)`. No-op when there is none. */
export function updateModifierConfig(
  level: StudioLevel,
  x: number,
  y: number,
  patch: Partial<StudioModifier['config']>,
): StudioLevel {
  const key = cellKey(x, y);
  const current = level.modifiers?.[key];
  if (!current) return level;
  const merged = { ...current.config, ...patch };
  // A field cleared to undefined / '' is dropped.
  const config = pruneConfig(merged);
  const next = { ...level.modifiers, [key]: { kind: current.kind, config } };
  return withModifiers(level, next);
}

export function clearModifiers(level: StudioLevel): StudioLevel {
  return withModifiers(level, {});
}

// ── link groups ────────────────────────────────────────────────────────────

export interface ModifierEntry {
  key: string;
  x: number;
  y: number;
  modifier: StudioModifier;
}

/** All modifier entries, in deterministic row-major order. */
export function modifierEntries(level: StudioLevel): ModifierEntry[] {
  const out: ModifierEntry[] = [];
  for (const [key, modifier] of Object.entries(level.modifiers ?? {})) {
    const { x, y } = parseCellKey(key);
    out.push({ key, x, y, modifier });
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Cell keys of every Linked pixel in `group`. */
export function linkGroupMembers(level: StudioLevel, group: string): string[] {
  return modifierEntries(level)
    .filter((e) => e.modifier.kind === 'linked' && e.modifier.config.group === group)
    .map((e) => e.key);
}

/** Distinct link-group ids currently in use, sorted. */
export function linkGroups(level: StudioLevel): string[] {
  const groups = new Set<string>();
  for (const e of modifierEntries(level)) {
    if (e.modifier.kind === 'linked' && e.modifier.config.group) groups.add(e.modifier.config.group);
  }
  return [...groups].sort();
}

/** Next free `link-N` id for a new link group. */
export function nextLinkGroup(level: StudioLevel): string {
  const used = new Set(linkGroups(level));
  for (let n = 1; ; n += 1) {
    const id = `link-${n}`;
    if (!used.has(id)) return id;
  }
}

// ── engine ↔ studio mapping ────────────────────────────────────────────────

/** {@link StudioModifier} → engine {@link ModifierInstance} (deterministic). */
export function toModifierInstance(m: StudioModifier): ModifierInstance {
  const out: ModifierInstance = { kind: m.kind };
  const { layers, group, timer, seed } = m.config;
  if (m.kind === 'bomb') {
    if (timer !== undefined) out.level = timer;
  } else if (layers !== undefined) {
    out.level = layers;
  }
  if (group !== undefined && group !== '') {
    out.group = group;
    if (m.kind === 'linked') out.linkId = group;
  }
  if (seed !== undefined) out.seed = seed;
  return out;
}

/** engine {@link ModifierInstance} → {@link StudioModifier} (round-trip inverse). */
export function fromModifierInstance(inst: ModifierInstance): StudioModifier {
  const kind = inst.kind;
  const config: StudioModifier['config'] = {};
  if (kind === 'bomb') {
    if (inst.level !== undefined) config.timer = inst.level;
  } else if (inst.level !== undefined) {
    config.layers = inst.level;
  }
  const group = inst.group ?? inst.linkId;
  if (group !== undefined && group !== '') config.group = group;
  if (inst.seed !== undefined) config.seed = inst.seed;
  return { kind, config };
}
