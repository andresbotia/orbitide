/** Pure, serializable game state. Manual Holding and encounter rules live in
 * actions.ts/pass.ts; rendering and clocks never determine outcomes. */

/**
 * The full gameplay colour vocabulary (15). Ordered around the hue wheel.
 * Levels 1-10 use a subset; the rest are reserved for later campaign content
 * and are already covered by the palette tokens and the Color Assist marks.
 */
export type OrbColor =
  | 'white'
  | 'yellow'
  | 'gold'
  | 'orange'
  | 'red'
  | 'coral'
  | 'pink'
  | 'magenta'
  | 'purple'
  | 'indigo'
  | 'blue'
  | 'cyan'
  | 'teal'
  | 'green'
  | 'lime';

/**
 * Special-pixel modifier. Serializable, cell-authored.
 *
 * Frozen, Shielded, and Linked are engine-owned. Durable shells consume a hit;
 * Linked members prime individually and clear atomically once their group is
 * fully primed. Other kinds remain presentation-only render-state hooks.
 */
export type ModifierKind =
  | 'frozen'
  | 'shielded'
  | 'armored'
  | 'locked'
  | 'bomb'
  | 'wild'
  | 'linked'
  | 'hidden';

export interface ModifierInstance {
  kind: ModifierKind;
  /** Kind-specific discrete state label (e.g. 'intact' | 'cracked1' | …). */
  state?: string;
  /** 0..1 continuous progress within the state machine (damage, reveal, …). */
  progress?: number;
  /** Countable magnitude: armored plate count, bomb stage, hidden layers, … */
  level?: number;
  /** Stable per-pixel seed for deterministic decorative detail. */
  seed?: number;
  /**
   * Authoring group identifier: a lock group (Locked) or a link group (Linked).
   * Linked gameplay and the connection renderer consume it.
   */
  group?: string;
  /** Runtime-hydrated Linked wiring consumed by rendering and diagnostics. */
  linkId?: string;
  linkedPixelIds?: string[];
  linkProgress?: number;
}

/**
 * Cell-keyed (`"x,y"`) sidecar of {@link ModifierInstance}s, layered
 * onto the picture from {@link LevelDefinition.pixelArt} by coordinate. Purely
 * additive: a level with no special pixels omits it and serialises exactly as
 * before. `createGame` copies each entry onto the matching {@link Pixel}; the
 * Frozen, Shielded, and Linked resolvers then consume their state.
 */
export type PixelModifierMap = Record<string, ModifierInstance>;

/** One occupied cell of the pixel-art picture. */
export interface Pixel {
  /** Stable identity, deterministic from the level definition. */
  id: string;
  x: number;
  y: number;
  color: OrbColor;
  cleared: boolean;
  /** Optional special-pixel modifier; Frozen, Shielded, and Linked affect gameplay. */
  modifier?: ModifierInstance;
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

/** Where a launched charge came from. */
export type ChargeSource = 'tunnel' | 'holding';

/**
 * One accepted launch, recorded on the epoch so the whole concurrent timeline
 * can be re-simulated deterministically. Serializable.
 */
export interface EpochLaunch {
  /** Runtime id of the charge (stable across a held relaunch). */
  chargeId: string;
  source: ChargeSource;
  /** Tunnel id or holding charge id the launch was taken from. */
  originId: string;
  color: OrbColor;
  /** Capacity the charge launched with. */
  capacity: number;
  /** Logical lap-time the charge enters the orbit at ORBIT_INSERTION. */
  insertionTime: number;
  /** Global monotonic launch order (equals `movesApplied` at acceptance). */
  launchSequence: number;
}

/** One resolved encounter: a clear, shell break, or Linked transition. */
export interface ActiveEncounter {
  pixelId: string;
  /** Absolute logical lap-time of the clear. */
  time: number;
  /** Lap-progress of the owning charge at the clear (`time - insertionTime`). */
  progress: number;
  /** Owning charge's capacity immediately after this clear. */
  remaining: number;
  /** `true` when this encounter cracked a Frozen ice layer instead of clearing. */
  frozenBreak?: boolean;
  /** `true` when this encounter collapsed a Shielded layer instead of clearing. */
  shieldBreak?: boolean;
  /** `true` when this encounter energized one Linked member without clearing it. */
  linkedPrime?: boolean;
  /** `true` when this encounter atomically cleared a complete Linked group. */
  linkedGroupClear?: boolean;
  linkedGroupId?: string;
  linkedClearedPixelIds?: string[];
}

export type ActiveChargePhase = 'orbiting' | 'finished';

/**
 * Independent per-charge runtime state. Each active charge is fully
 * self-describing: no global "current target", "current pass timer" or
 * "projectile" is shared between charges.
 */
export interface ActiveCharge {
  id: string;
  source: ChargeSource;
  originId: string;
  color: OrbColor;
  /** Capacity the charge launched with. */
  capacity: number;
  remainingCapacity: number;
  insertionTime: number;
  launchSequence: number;
  /** Laps completed (0 or 1 under the one-lap-per-launch rule). */
  passCount: number;
  phase: ActiveChargePhase;
  encounters: ActiveEncounter[];
  /**
   * Logical lap-time the charge leaves the orbit — its last encounter, or
   * `insertionTime + 1` when it completes a full lap with capacity to spare.
   */
  finishTime: number;
  /** Where the charge ends up once the epoch flushes. */
  landed: 'consumed' | 'holding';
}

/**
 * A batch of launches whose laps overlap in logical time, resolved as one
 * deterministic timeline. `baseline` is the committed truth when the epoch
 * opened (always `epoch: null`, `activeCharges: []`); replaying `launches`
 * against it reproduces the current state exactly.
 */
export interface EpochState {
  baseline: GameState;
  launches: EpochLaunch[];
  /** Insertion time the next launch would use. */
  clock: number;
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
  /**
   * Optional presentation modifiers, keyed by `"x,y"` cell. Additive: absent on
   * every normal level. The engine attaches these to the matching pixel and
   * never reads them for a rule.
   */
  modifiers?: PixelModifierMap;
  /** Exactly three authored tunnel queues; index 0 of each is the front charge. */
  tunnels: ChargeSpec[][];
  /** Optional authored Win / Discovery constellation. */
  reveal?: LevelReveal;
  /**
   * Optional one-line teaching cue shown once, non-modally, while the mechanic
   * it describes is still unused on this level (e.g. the Frozen introduction on
   * Level 21). Purely presentational — the engine never reads it.
   */
  tutorial?: string;
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
  /**
   * Charges launched into the current epoch, each with its independent resolved
   * state. Empty when no launch has happened or the previous epoch has flushed.
   * Counts toward {@link MAX_ACTIVE_CHARGES} while the epoch is open.
   */
  activeCharges: ActiveCharge[];
  /** The open concurrent-launch epoch, or `null` when the rail is idle. */
  epoch: EpochState | null;
}
