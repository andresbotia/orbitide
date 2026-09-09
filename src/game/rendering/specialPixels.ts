import type { ModifierInstance, ModifierKind } from '@/game/engine/types';

/**
 * Pure model for the special-pixel material system. No React / RN / Skia.
 *
 * One shared conceptual model — BasePixel + ModifierShell/Hardware/Surface +
 * state/damage params + density simplification — so future engine states can
 * drive Frozen / Shielded / Armored / Locked / Bomb / Wild / Linked / Hidden
 * without redesigning the renderer. This module is presentation infrastructure
 * only: no mechanic logic.
 */

// ---------------------------------------------------------------------------
// Density → detail
// ---------------------------------------------------------------------------

export type MaterialDetail = 'full' | 'medium' | 'minimal';

/** Board densities: 7-9 → full, 11-13 → medium, 15-17 → minimal. */
export function materialDetail(density: number): MaterialDetail {
  if (density <= 9) return 'full';
  if (density <= 13) return 'medium';
  return 'minimal';
}

// ---------------------------------------------------------------------------
// Overflow — a modifier may bleed past its cell, but never into icon soup.
// ---------------------------------------------------------------------------

/** Hard ceiling: a modifier may never exceed this fraction of the cell. */
export const MAX_OVERFLOW = 0.18;

const OVERFLOW_BY_DETAIL: Record<MaterialDetail, number> = { full: 0.18, medium: 0.1, minimal: 0.04 };
const OVERFLOW_BY_KIND: Record<ModifierKind, number> = {
  frozen: 0.18, shielded: 0.16, armored: 0.12, locked: 0.16,
  bomb: 0.03, wild: 0.06, linked: 0.1, hidden: 0.05,
};

export function modifierOverflow(kind: ModifierKind, detail: MaterialDetail): number {
  return Math.min(MAX_OVERFLOW, OVERFLOW_BY_KIND[kind], OVERFLOW_BY_DETAIL[detail]);
}

// ---------------------------------------------------------------------------
// Consistent z-order (task section 10)
// ---------------------------------------------------------------------------

export const MATERIAL_LAYERS = [
  'shadow',
  'baseExtrusion',
  'coloredBody',
  'modifierInner',
  'modifierShell',
  'highlightRim',
  'damageState',
  'transientHit',
  'colorAssist',
] as const;
export type MaterialLayer = (typeof MATERIAL_LAYERS)[number];
export function layerIndex(layer: MaterialLayer): number {
  return MATERIAL_LAYERS.indexOf(layer);
}

// ---------------------------------------------------------------------------
// Motion hooks (declarative; wired in modifierMotion.ts / SpecialPixelLayer)
// ---------------------------------------------------------------------------

export type ModifierMotionKind =
  | 'crack'
  | 'shatter'
  | 'ripple'
  | 'shieldCollapse'
  | 'plateHit'
  | 'clampRelease'
  | 'bombPulse'
  | 'facetShimmer'
  | 'wildResolve'
  | 'linkPulse'
  | 'scanReveal';

/** Motions that repeat while idle (vs one-shot transient hit/break motions). */
export const IDLE_MOTIONS: ReadonlySet<ModifierMotionKind> = new Set<ModifierMotionKind>([
  'bombPulse',
  'facetShimmer',
  'linkPulse',
  'scanReveal',
]);

/** At most this many special pixels animate their idle motion at once. */
export const IDLE_ANIMATION_BUDGET = 6;

// ---------------------------------------------------------------------------
// Deterministic decorative detail
// ---------------------------------------------------------------------------

export interface DetailPoint {
  x: number;
  y: number;
  r: number;
  rot: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable string → 32-bit seed. */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * `count` decorative points, deterministic for a given seed. Positions are in a
 * unit cell centred on 0 (range roughly -0.5-spread .. 0.5+spread).
 */
export function deterministicDetail(seed: number, count: number, spread = 0.34): DetailPoint[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: Math.max(0, count) }, () => ({
    x: (rnd() - 0.5) * 2 * spread,
    y: (rnd() - 0.5) * 2 * spread,
    r: 0.04 + rnd() * 0.08,
    rot: rnd() * Math.PI,
  }));
}

// ---------------------------------------------------------------------------
// Per-kind state machines
// ---------------------------------------------------------------------------

export type ShellKind =
  | 'ice'
  | 'membrane'
  | 'plates'
  | 'clamp'
  | 'cavity'
  | 'crystal'
  | 'socket'
  | 'pane';

const SHELL_BY_KIND: Record<ModifierKind, ShellKind> = {
  frozen: 'ice',
  shielded: 'membrane',
  armored: 'plates',
  locked: 'clamp',
  bomb: 'cavity',
  wild: 'crystal',
  linked: 'socket',
  hidden: 'pane',
};

export interface ModifierCounts {
  plates: number;
  cracks: number;
  chips: number;
  bolts: number;
  facets: number;
  bubbles: number;
  scanlines: number;
  sockets: number;
}

export interface ModifierFeatures {
  refraction: boolean;
  frostCloud: boolean;
  rimLight: boolean;
  microArc: boolean;
  airGap: boolean;
  brushedTexture: boolean;
  pinGlow: boolean;
  ledRing: boolean;
  travelingHighlight: boolean;
  conduit: boolean;
  colorBleed: boolean;
  distortion: boolean;
}

export interface ModifierRender {
  kind: ModifierKind;
  shell: ShellKind;
  detail: MaterialDetail;
  overflow: number;
  /** 0..1 through this modifier's own state progression (drives animation). */
  progression: number;
  /** shell/hardware is failing but the base pixel is not yet affected. */
  shellFailing: boolean;
  /** base pixel itself is compromised / gone. */
  baseCompromised: boolean;
  /** 0..1 desaturation to apply to the base cube. */
  desaturate: number;
  /** 0..1 how concealed the base cube is (hidden). */
  concealment: number;
  counts: ModifierCounts;
  features: ModifierFeatures;
  motion: ModifierMotionKind | null;
  detailPoints: DetailPoint[];
  /** hooks the connection renderer consumes for linked pixels. */
  link: { linkId?: string; linkedPixelIds: string[]; linkProgress: number } | null;
}

const NO_FEATURES: ModifierFeatures = {
  refraction: false, frostCloud: false, rimLight: false, microArc: false,
  airGap: false, brushedTexture: false, pinGlow: false, ledRing: false,
  travelingHighlight: false, conduit: false, colorBleed: false, distortion: false,
};
const NO_COUNTS: ModifierCounts = {
  plates: 0, cracks: 0, chips: 0, bolts: 0, facets: 0, bubbles: 0, scanlines: 0, sockets: 0,
};

/** Clamp helper. */
const cl = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

interface KindResult {
  progression: number;
  shellFailing: boolean;
  baseCompromised: boolean;
  desaturate: number;
  concealment: number;
  counts: Partial<ModifierCounts>;
  features: Partial<ModifierFeatures>;
  motion: ModifierMotionKind | null;
}

function frozen(state: string | undefined, progress: number, detail: MaterialDetail): KindResult {
  const stage = state ?? (progress >= 0.95 ? 'breaking' : progress >= 0.75 ? 'fracturing'
    : progress >= 0.4 ? 'cracked2' : progress >= 0.15 ? 'cracked1' : 'intact');
  const cracks = { intact: 0, cracked1: 1, cracked2: 2, fracturing: 3, breaking: 3 }[stage] ?? 0;
  const progression = { intact: 0, cracked1: 0.25, cracked2: 0.55, fracturing: 0.8, breaking: 1 }[stage] ?? 0;
  const chips = detail === 'full' ? 3 : detail === 'medium' ? 2 : 1;
  const bubbles = detail === 'full' ? 5 : 0;
  return {
    progression,
    shellFailing: stage === 'fracturing' || stage === 'breaking',
    baseCompromised: stage === 'breaking',
    desaturate: 0,
    concealment: 0,
    counts: { cracks, chips, bubbles },
    features: {
      refraction: detail !== 'minimal',
      frostCloud: detail !== 'minimal',
      rimLight: true,
    },
    motion: stage === 'breaking' ? 'shatter' : cracks >= 2 ? 'crack' : null,
  };
}

function shielded(state: string | undefined, progress: number, detail: MaterialDetail): KindResult {
  const stage = state ?? (progress >= 0.95 ? 'gone' : progress >= 0.7 ? 'collapsing'
    : progress >= 0.3 ? 'stressed' : 'intact');
  const progression = { intact: 0, stressed: 0.5, collapsing: 0.85, gone: 1 }[stage] ?? 0;
  return {
    progression,
    shellFailing: stage === 'collapsing' || stage === 'gone',
    baseCompromised: false, // the shell always collapses before the base pixel
    desaturate: 0,
    concealment: 0,
    counts: {},
    features: {
      airGap: stage !== 'gone',
      microArc: detail === 'full' && stage !== 'gone',
      rimLight: true,
    },
    motion: stage === 'collapsing' ? 'shieldCollapse' : stage === 'stressed' ? 'ripple' : null,
  };
}

function armored(level: number | undefined, detail: MaterialDetail): KindResult {
  const plates = cl(Math.round(level ?? 2), 1, 4);
  return {
    progression: 0,
    shellFailing: false,
    baseCompromised: false,
    desaturate: 0,
    concealment: 0,
    counts: { plates, bolts: detail === 'full' ? 4 : detail === 'medium' ? 2 : 0 },
    features: { brushedTexture: detail !== 'minimal', rimLight: true },
    motion: null,
  };
}

function locked(state: string | undefined, detail: MaterialDetail): KindResult {
  const stage = state ?? 'locked';
  const progression = { locked: 0, unlocking: 0.5, released: 1 }[stage] ?? 0;
  return {
    progression,
    shellFailing: stage === 'released',
    baseCompromised: false,
    desaturate: stage === 'released' ? 0 : 0.35,
    concealment: 0,
    counts: { bolts: detail === 'minimal' ? 0 : 2 },
    features: { pinGlow: stage !== 'released', brushedTexture: detail !== 'minimal' },
    motion: stage === 'unlocking' ? 'clampRelease' : null,
  };
}

function bomb(state: string | undefined, detail: MaterialDetail): KindResult {
  const stage = state ?? 'dormant';
  const progression = { dormant: 0, warning: 0.5, critical: 1 }[stage] ?? 0;
  return {
    progression,
    shellFailing: false,
    baseCompromised: false,
    desaturate: 0,
    concealment: 0,
    counts: {},
    features: { ledRing: detail !== 'minimal', rimLight: true },
    motion: stage === 'dormant' ? null : 'bombPulse',
  };
}

function wild(state: string | undefined, detail: MaterialDetail): KindResult {
  const stage = state ?? 'idle';
  const progression = { idle: 0, active: 0.5, resolving: 1 }[stage] ?? 0;
  const facets = detail === 'full' ? 6 : detail === 'medium' ? 3 : 0;
  return {
    progression,
    shellFailing: stage === 'resolving',
    baseCompromised: false,
    desaturate: 0,
    concealment: 0,
    counts: { facets },
    features: { travelingHighlight: true, rimLight: true },
    motion: stage === 'resolving' ? 'wildResolve' : 'facetShimmer',
  };
}

function linked(instance: ModifierInstance, detail: MaterialDetail): KindResult {
  const linkedIds = instance.linkedPixelIds ?? [];
  return {
    progression: cl(instance.linkProgress ?? 0),
    shellFailing: false,
    baseCompromised: false,
    desaturate: 0,
    concealment: 0,
    counts: { sockets: linkedIds.length > 0 ? 2 : 1 },
    features: { conduit: linkedIds.length > 0, brushedTexture: detail !== 'minimal' },
    motion: linkedIds.length > 0 ? 'linkPulse' : null,
  };
}

function hidden(state: string | undefined, progress: number, detail: MaterialDetail): KindResult {
  const stage = state ?? (progress >= 0.95 ? 'revealed' : progress >= 0.4 ? 'partial' : 'concealed');
  const concealment = { concealed: 1, partial: 0.5, revealed: 0 }[stage] ?? 1;
  return {
    progression: 1 - concealment,
    shellFailing: stage === 'revealed',
    baseCompromised: false,
    desaturate: 0,
    concealment,
    counts: { scanlines: detail === 'full' ? 3 : 1 },
    features: {
      colorBleed: true,
      distortion: detail !== 'minimal',
    },
    motion: stage === 'revealed' ? null : 'scanReveal',
  };
}

// ---------------------------------------------------------------------------
// resolveModifier — the single entry point the renderer consumes.
// ---------------------------------------------------------------------------

const DETAIL_COUNT: Record<'bubbles' | 'facets' | 'chips' | 'scratches', Record<MaterialDetail, number>> = {
  bubbles: { full: 5, medium: 0, minimal: 0 },
  facets: { full: 6, medium: 3, minimal: 0 },
  chips: { full: 3, medium: 2, minimal: 1 },
  scratches: { full: 6, medium: 2, minimal: 0 },
};

export function resolveModifier(instance: ModifierInstance, density: number): ModifierRender {
  const detail = materialDetail(density);
  const kind = instance.kind;
  const progress = cl(instance.progress ?? 0);

  let k: KindResult;
  switch (kind) {
    case 'frozen': k = frozen(instance.state, progress, detail); break;
    case 'shielded': k = shielded(instance.state, progress, detail); break;
    case 'armored': k = armored(instance.level, detail); break;
    case 'locked': k = locked(instance.state, detail); break;
    case 'bomb': k = bomb(instance.state, detail); break;
    case 'wild': k = wild(instance.state, detail); break;
    case 'linked': k = linked(instance, detail); break;
    case 'hidden': k = hidden(instance.state, progress, detail); break;
    default: k = { progression: 0, shellFailing: false, baseCompromised: false, desaturate: 0, concealment: 0, counts: {}, features: {}, motion: null };
  }

  const counts: ModifierCounts = { ...NO_COUNTS, ...k.counts };
  const features: ModifierFeatures = { ...NO_FEATURES, ...k.features };

  const seed = instance.seed ?? 0;
  let decorativeCount = 0;
  if (kind === 'frozen') decorativeCount = counts.bubbles + counts.chips;
  else if (kind === 'wild') decorativeCount = counts.facets;
  else if (kind === 'armored') decorativeCount = DETAIL_COUNT.scratches[detail] + counts.bolts;
  else if (kind === 'hidden') decorativeCount = counts.scanlines;

  return {
    kind,
    shell: SHELL_BY_KIND[kind],
    detail,
    overflow: modifierOverflow(kind, detail),
    progression: k.progression,
    shellFailing: k.shellFailing,
    baseCompromised: k.baseCompromised,
    desaturate: k.desaturate,
    concealment: k.concealment,
    counts,
    features,
    motion: k.motion,
    detailPoints: deterministicDetail(seed, decorativeCount, 0.32 + counts.plates * 0),
    link: kind === 'linked'
      ? { linkId: instance.linkId, linkedPixelIds: instance.linkedPixelIds ?? [], linkProgress: cl(instance.linkProgress ?? 0) }
      : null,
  };
}

/**
 * Given the special pixels currently on the board, decide which get their idle
 * (repeating) animation — capped at IDLE_ANIMATION_BUDGET, prioritised by
 * urgency (critical bomb > resolving wild > everything else), stable order.
 */
export function pickIdleAnimated<T extends { id: string; render: ModifierRender }>(specials: T[]): Set<string> {
  const eligible = specials.filter((s) => s.render.motion !== null && IDLE_MOTIONS.has(s.render.motion));
  const priority = (r: ModifierRender): number => {
    if (r.kind === 'bomb' && r.progression >= 1) return 0;
    if (r.kind === 'wild' && r.progression >= 0.5) return 1;
    if (r.kind === 'bomb') return 2;
    return 3;
  };
  const ordered = [...eligible].sort((a, b) => {
    const pa = priority(a.render);
    const pb = priority(b.render);
    return pa !== pb ? pa - pb : a.id < b.id ? -1 : 1;
  });
  return new Set(ordered.slice(0, IDLE_ANIMATION_BUDGET).map((s) => s.id));
}
