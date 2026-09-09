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
  LevelDifficulty,
  LevelReveal,
  OrbColor,
} from '@/game/engine/types';

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
  /** Exactly three authored tunnel queues; index 0 of each is the front charge. */
  tunnels: ChargeSpec[][];
  /**
   * Authored Win / Discovery constellation. Preserved verbatim across a
   * load → edit → save round-trip; not edited in the M3A UI.
   */
  reveal?: LevelReveal;
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
    | { kind: 'color'; color: OrbColor };
}

export interface ValidationReport {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** `true` when there are no `error`-severity issues (warnings are fine). */
  ok: boolean;
  /** `true` when the level is safe to export as a production level definition. */
  exportable: boolean;
}
