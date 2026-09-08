/**
 * ORBITIDE core game model.
 *
 * Everything in this file is a plain, serializable TypeScript type. There are no
 * React, React Native, or Skia imports anywhere in `src/game/engine` so the
 * engine can be unit-tested (and later fed to a solver/generator) in a plain
 * Node environment.
 *
 * ---------------------------------------------------------------------------
 * EXPOSED ORB CONVENTION
 * ---------------------------------------------------------------------------
 * A lane is an ordered array of orbs. **Index 0 is the exposed / selectable
 * orb** — the head of the lane, rendered closest to the Core. Removing the
 * exposed orb is `lane.slice(1)`. Authored level data follows the same rule:
 * in `["blue", "red"]` the blue orb is exposed first and the red orb sits
 * behind it.
 */

export type OrbColor = 'blue' | 'yellow' | 'red' | 'green' | 'purple';

export interface Orb {
  /** Stable identity, deterministic from the level definition. */
  id: string;
  color: OrbColor;
}

/** Ordered list of orbs. Index 0 is the exposed orb (see file header). */
export type Lane = Orb[];

/** The temporary storage area for non-matching orbs. */
export type HoldingTray = Orb[];

/**
 * A single entry in the Core's ordered target sequence. `count` is the number
 * of orbs of `color` still required; it is decremented as orbs resolve into the
 * Core and reaches 0 when the target is complete.
 */
export interface CoreTarget {
  color: OrbColor;
  count: number;
}

/** Authored, serializable definition of a handcrafted level. */
export interface LevelDefinition {
  /** 1-based level number. */
  id: number;
  /** Maximum number of orbs the holding tray can contain. */
  holdingCapacity: number;
  /** Ordered Core target sequence. */
  coreTargets: CoreTarget[];
  /** Lanes as authored colors. Index 0 of each lane is the exposed orb. */
  lanes: OrbColor[][];
}

export type GameStatus = 'playing' | 'won' | 'lost';

/**
 * The complete, serializable runtime state of a level in progress. Produced by
 * `createGame` and only ever replaced (never mutated) by `resolveMove`.
 */
export interface GameState {
  /** Level number this state was created from. */
  levelId: number;
  holdingCapacity: number;
  lanes: Lane[];
  holding: HoldingTray;
  /** Remaining Core targets; `count` fields are decremented as play proceeds. */
  targets: CoreTarget[];
  /** Index into `targets` of the currently active target. */
  activeTargetIndex: number;
  status: GameStatus;
  /** Number of player moves that have been accepted. Useful for race guards. */
  movesApplied: number;
}
