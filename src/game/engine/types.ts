/**
 * ORBITIDE core game model — pixel-clearing orbital-charge mechanic.
 *
 * Everything in this file is a plain, serializable TypeScript type. There are no
 * React, React Native, or Skia imports anywhere in `src/game/engine` so the
 * engine can be unit-tested (and fed to the test-only solver) in a plain Node
 * environment.
 *
 * ---------------------------------------------------------------------------
 * MECHANIC SUMMARY
 * ---------------------------------------------------------------------------
 * The puzzle board is a handcrafted pixel-art picture. Around it sit exactly
 * three Launch Tunnels; each tunnel has a fixed authored queue of charges and
 * only its front charge is visible/selectable. Tapping a tunnel launches its
 * front charge into orbit: it clears up to `capacity` matching pixels that are
 * currently *reachable* (on the outer boundary of the remaining picture), one
 * per pixel. If the charge empties it vanishes; if capacity remains it parks in
 * the Holding tray, where it auto-relaunches later once matching pixels become
 * reachable. Win = every pixel cleared. Lose = Holding full with no resolution,
 * or no launch left to make while pixels remain.
 *
 * EXPOSED/REACHABLE RULE: a pixel is reachable iff at least one of its four
 * orthogonal neighbours is "exterior" — off the grid, or an empty cell that is
 * connected to the grid border through other empty cells. Fully enclosed pixels
 * wait until an outer layer is cleared. See `pixels.ts`.
 *
 * DETERMINISTIC CLEAR ORDER: matching reachable pixels are cleared in clockwise
 * orbital order starting from the 12 o'clock direction around the picture
 * centre; ties (same angle) clear the outer pixel first, then by id. The solver
 * and the renderer both consume this same ordering.
 */

export type OrbColor =
  | 'blue'
  | 'cyan'
  | 'white'
  | 'purple'
  | 'pink'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'green';

/** One occupied cell of the pixel-art picture. */
export interface Pixel {
  /** Stable identity, deterministic from the level definition. */
  id: string;
  x: number;
  y: number;
  color: OrbColor;
  cleared: boolean;
}

/** An orbital charge: a color plus how many matching pixels it can still clear. */
export interface Charge {
  id: string;
  color: OrbColor;
  capacity: number;
}

/** Authored charge before it is given a runtime id. */
export interface ChargeSpec {
  color: OrbColor;
  capacity: number;
}

export type LevelDifficulty = 'easy' | 'medium' | 'hard' | 'super-hard' | 'extreme';

/** Authored, serializable definition of a handcrafted level. */
export interface LevelDefinition {
  /** 1-based level number. */
  id: number;
  title: string;
  themeId: string;
  difficulty: LevelDifficulty;
  /** Maximum number of charges the Holding tray can contain. */
  holdingCapacity: number;
  /**
   * Pixel-art rows, one character per cell. `.` and ` ` are empty. Every other
   * character must be present in `legend` (or the shared default legend).
   */
  pixelArt: string[];
  /** Per-level override of the art character -> color mapping. */
  legend?: Record<string, OrbColor>;
  /** Exactly three authored tunnel queues; index 0 of each is the front charge. */
  tunnels: ChargeSpec[][];
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface TunnelState {
  id: string;
  /** Remaining authored charges; index 0 is the visible front charge. */
  queue: Charge[];
}

/**
 * The complete, serializable runtime state of a level in progress. Produced by
 * `createGame` and only ever replaced (never mutated) by `resolveLaunch`.
 */
export interface GameState {
  levelId: number;
  holdingCapacity: number;
  /** Grid width in cells. */
  width: number;
  /** Grid height in cells. */
  height: number;
  /** Every pixel of the picture, cleared ones kept with `cleared: true`. */
  pixels: Pixel[];
  /** Exactly three tunnels. */
  tunnels: TunnelState[];
  /** Charges parked with leftover capacity. */
  holding: Charge[];
  status: GameStatus;
  /** Number of player launches that have been accepted. Useful for race guards. */
  movesApplied: number;
}
