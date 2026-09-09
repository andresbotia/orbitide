/** Pure, serializable game state. Manual Holding and encounter rules live in
 * actions.ts/pass.ts; rendering and clocks never determine outcomes. */
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

/**
 * Optional authored metadata for the Win / Discovery reveal. Purely
 * presentational — the engine never reads this. Node coordinates are in
 * pixel-grid cell units (may be fractional) so the constellation stays
 * spatially aligned with the solved picture. When absent, the reveal renderer
 * derives a deterministic silhouette fallback.
 */
export interface LevelReveal {
  /** Discovery name shown once the constellation resolves. */
  name: string;
  /** Constellation node positions, in cell coordinates. */
  nodes: { x: number; y: number }[];
  /** Index pairs into `nodes` for the constellation lines. */
  lines: [number, number][];
  /** Optional indices of nodes drawn with a brighter accent. */
  accentNodes?: number[];
  /** Passive metadata hook for a future collection system. */
  collectionId?: string;
}

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
  /** Optional authored Win / Discovery constellation. */
  reveal?: LevelReveal;
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
