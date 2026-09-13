/**
 * PIXEL ARCADIA WORLD-SKIN FOUNDATION (redesign Milestone 1).
 *
 * Declarative per-world identity, keyed by the campaign's real `themeId`
 * values (`@/game/levels/campaign.ts`). This is presentation data, not a
 * gameplay concept — swapping a world's skin never changes level content,
 * board rules, or level ordering.
 *
 * Scope note: this module defines the DATA only. No renderer consumes
 * `ambientId`/`intensity` yet — full environmental theming (parallax layers,
 * per-world particles, etc.) is a later milestone (world map / gameplay
 * background passes). `accent` is the one field already live today, feeding
 * `campaign.ts`'s `display.accent` (world-select badge / progress-fill
 * colour) so there is exactly one authored value per world, not two.
 *
 * Architecture rule this file exists to enforce: components look up a skin by
 * `themeId` through {@link worldSkin} — they never branch on a specific world
 * id/name. Adding an eleventh world (not in scope for this redesign) should
 * only ever require one new entry here, never a new `if`/`switch` in a
 * component.
 */

/**
 * A stable identifier for a future ambient treatment. Intentionally not yet
 * wired to any renderer — see the file-level scope note. Values are named for
 * the *effect*, not the world, so more than one world can reuse a treatment.
 */
export type AmbientTreatmentId =
  | 'warmDawn'
  | 'foliage'
  | 'neonSignage'
  | 'gearsSteam'
  | 'starfield'
  | 'skylineDrift'
  | 'currents'
  | 'arcaneParticles'
  | 'duskAsh'
  | 'galleryDust';

/** Coarse density/energy hint for whatever the ambient treatment turns out to be. */
export type SkinIntensity = 'low' | 'medium' | 'high';

export interface WorldSkin {
  readonly themeId: string;
  /** Primary per-world identity colour — world-select badge, progress fill. */
  readonly accent: string;
  /** Secondary tone for future two-tone ambient/gradient work. Never a CTA fill. */
  readonly secondaryAccent: string;
  readonly ambientId: AmbientTreatmentId;
  readonly intensity: SkinIntensity;
}

type SkinEntry = Omit<WorldSkin, 'themeId'>;

/**
 * One entry per real campaign world (`content/levels/world-0N.json` /
 * `levelDefinitions.ts`'s `themeId`s). Colours are a first pass for the
 * world-select redesign (Milestone 3) to tune against real screens — chosen
 * to be distinct from each other and from the 15 `orbColors` gameplay values
 * (`theme/colors.ts`), never reused from that set.
 *
 * `cosmic-frontier` deliberately owns the `starfield` treatment: the old
 * Cosmic Arcade starfield becomes ONE world's identity instead of the whole
 * product's default background (see `docs/DESIGN.md`, world-skin section).
 */
const WORLD_SKINS: Record<string, SkinEntry> = {
  'first-light': { accent: '#E3B15A', secondaryAccent: '#FFE1A8', ambientId: 'warmDawn', intensity: 'low' },
  'wild-garden': { accent: '#8FC768', secondaryAccent: '#C9E8A0', ambientId: 'foliage', intensity: 'medium' },
  'neon-nights': { accent: '#FF4FC3', secondaryAccent: '#4DE1FF', ambientId: 'neonSignage', intensity: 'high' },
  'mechanical-city': { accent: '#C98953', secondaryAccent: '#8A93A6', ambientId: 'gearsSteam', intensity: 'medium' },
  'cosmic-frontier': { accent: '#7C6CFF', secondaryAccent: '#9AF0FF', ambientId: 'starfield', intensity: 'high' },
  'world-landmarks': { accent: '#E0784D', secondaryAccent: '#F2C879', ambientId: 'skylineDrift', intensity: 'medium' },
  'ocean-depths': { accent: '#2E8494', secondaryAccent: '#6FE3D6', ambientId: 'currents', intensity: 'medium' },
  'mythic-realm': { accent: '#B15CC4', secondaryAccent: '#F0A8FF', ambientId: 'arcaneParticles', intensity: 'high' },
  'prehistoric-titans': { accent: '#B8703F', secondaryAccent: '#E3B27A', ambientId: 'duskAsh', intensity: 'medium' },
  'masterpiece-gallery': { accent: '#D4AF6A', secondaryAccent: '#F5E6C8', ambientId: 'galleryDust', intensity: 'low' },
};

const FALLBACK_SKIN: SkinEntry = WORLD_SKINS['first-light']!;

/** Every themeId with a defined skin, in authoring order. Exposed for tests/tools. */
export const WORLD_SKIN_THEME_IDS: readonly string[] = Object.keys(WORLD_SKINS);

/**
 * Look up a world's skin by `themeId`. Falls back to `first-light`'s skin for
 * an unknown id (e.g. a Studio-authored draft world with no skin yet) rather
 * than throwing — presentation data should never crash the app.
 */
export function worldSkin(themeId: string | undefined): WorldSkin {
  const entry = (themeId && WORLD_SKINS[themeId]) || FALLBACK_SKIN;
  return { themeId: themeId ?? 'first-light', ...entry };
}
