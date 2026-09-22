/**
 * Level Studio working document. This is the editor's in-memory representation
 * of a level while it is being authored; it is a thin, lossless superset of the
 * production {@link LevelDefinition} and serialises back to it via
 * `studio/serialize.ts` — the ONE canonical path. The Studio never introduces a
 * second level format, a second engine or a second solver.
 *
 * The only structural difference from `LevelDefinition` is the pixel canvas: the
 * editor keeps a sparse `cells` map (`"x,y" -> OrbColor`) for cheap paint/erase,
 * which the serializer folds into `pixelArt` rows + an optional `legend`.
 */
import type {
  ChargeSpec,
  GameRuleset,
  LevelDifficulty,
  LevelReveal,
  ModifierKind,
  OrbColor,
} from '@/game/engine/types';

/**
 * Authoring-facing config for one special pixel. Deliberately small and neutral:
 * a field only exists where an authoring need is real. `layers` covers Frozen
 * crack-stages / Shielded strength / Armored plates / Hidden concealment;
 * `group` is a Locked lock-group or a Linked link-group; `timer` is inert Bomb
 * placeholder metadata. See `studio/modifiers.ts` and
 * docs/M3C_PRODUCTION_AUTHORING.md.
 */
export interface ModifierConfig {
  layers?: number;
  group?: string;
  timer?: number;
  /** Stable decorative seed carried through from a source level. */
  seed?: number;
}

export interface StudioModifier {
  kind: ModifierKind;
  config: ModifierConfig;
}

/** Studio-only authoring provenance. Never written into a `LevelDefinition`. */
export interface LevelProvenance {
  kind: 'original' | 'duplicate' | 'variation';
  /** Level id this was duplicated / varied from. */
  sourceLevelId?: number;
  note?: string;
}

export interface StudioLevel {
  /** 1-based level number. */
  id: number;
  title: string;
  /** Artwork / theme-set name (e.g. "first-light"). */
  themeId: string;
  difficulty: LevelDifficulty;
  /** Holding tray size. Fixed at 3 for M3A — surfaced, not edited. */
  holdingCapacity: number;
  /** Grid width in cells. */
  width: number;
  /** Grid height in cells. */
  height: number;
  /** Sparse occupied cells, keyed `"x,y"`. Absent key === empty cell. */
  cells: Record<string, OrbColor>;
  /**
   * Presentation modifiers, keyed `"x,y"` (same keys as {@link cells}). Absent
   * when the level has no special pixels — a normal level serialises exactly as
   * before. The engine attaches these but never reads them for a rule.
   */
  modifiers?: Record<string, StudioModifier>;
  /** Studio-only authoring provenance. Stripped on export to a `LevelDefinition`. */
  source?: LevelProvenance;
  /** Authored tunnel queues (Legacy V1: 3, Core V2: 3); index 0 of each is the front. */
  tunnels: ChargeSpec[][];
  /**
   * Authored Win / Discovery constellation. Preserved verbatim across a
   * load → edit → save round-trip; not edited in the M3A UI.
   */
  reveal?: LevelReveal;
  /** One-line non-modal teaching cue (carried verbatim; not edited in the M3 UI). */
  tutorial?: string;
  /** Targeting ruleset. Absent on campaign V1 documents. */
  ruleset?: GameRuleset;
  /** Concurrent active-pass capacity. Absent means the engine default (5). */
  activeCapacity?: number;
  /**
   * Explicit art-character → colour overrides carried on the source level.
   * Preserved for a faithful round-trip; the serializer also synthesises entries
   * for colours outside the shared default legend.
   */
  legend?: Record<string, OrbColor>;
}

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  /** Optional pointer at the offending part of the level for the UI. */
  where?:
    | { kind: 'metadata'; field: string }
    | { kind: 'board' }
    | { kind: 'cell'; x: number; y: number }
    | { kind: 'tunnel'; tunnel: number }
    | { kind: 'charge'; tunnel: number; index: number }
    | { kind: 'color'; color: OrbColor }
    | { kind: 'modifier'; x: number; y: number }
    | { kind: 'reveal'; part: 'name' | 'node' | 'line' | 'accent'; index?: number };
}

export interface ValidationReport {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** `true` when there are no `error`-severity issues (warnings are fine). */
  ok: boolean;
  /** `true` when the level is safe to export as a production level definition. */
  exportable: boolean;
}
