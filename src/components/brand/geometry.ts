/**
 * Shared construction geometry for the Pixel Arcadia logo mark, on the approved
 * 120-unit / 4-unit-grid viewBox. Pure data so both the runtime component and
 * tests can consume it. The mark is: a 5-block arch + a plus-shaped pixel core.
 * The decorative crown diamond is intentionally NOT part of this geometry — the
 * identity is ARCH + WARM PIXEL CORE and must hold if the diamond is dropped.
 */
export interface UnitRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Corner radius in grid units. */
  r: number;
  /** Rotation in degrees, about the rect's own centre (arch shoulders only). */
  rot?: number;
}

export const MARK_VIEWBOX = 120;

/** The 5 arch blocks: crown keystone, two shoulders, two stacked piers. */
export const ARCH_BLOCKS: readonly UnitRect[] = [
  { x: 49, y: 12, w: 22, h: 18, r: 4 },
  { x: 24.5, y: 22, w: 20, h: 18, r: 4, rot: -32 },
  { x: 75.5, y: 22, w: 20, h: 18, r: 4, rot: 32 },
  { x: 14, y: 46, w: 20, h: 58, r: 4 },
  { x: 86, y: 46, w: 20, h: 58, r: 4 },
];

/** The plus-shaped pixel core: a centre square plus four stubby arms. */
export const CORE_CENTER: UnitRect = { x: 46, y: 46, w: 28, h: 28, r: 3 };
export const CORE_ARMS: readonly UnitRect[] = [
  { x: 39, y: 53, w: 7, h: 14, r: 0 },
  { x: 74, y: 53, w: 7, h: 14, r: 0 },
  { x: 53, y: 39, w: 14, h: 7, r: 0 },
  { x: 53, y: 74, w: 14, h: 7, r: 0 },
];

/** Warm-core radial ramp (centre → edge), matched to `brandGradient.core`. */
export const CORE_RAMP = ['#FFFFFF', '#FFF0B8', '#FFC94D', '#F2662E'] as const;
