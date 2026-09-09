/**
 * PIXEL ARCADIA — brand token layer (M3.6B).
 *
 * Source of truth: the approved "Pixel Arcadia Brand System" deliverable
 * (M3.6A production branding lock). These tokens describe the *brand* surface —
 * app icon, splash, logo/wordmark, primary CTA, loading + empty moments and the
 * Home brand pass. They are deliberately kept SEPARATE from:
 *
 *   - the 15 functional gameplay colours (`theme/colors.ts` — `orbColors` etc.)
 *   - the in-game surface/material language (`theme/arcade.ts` — `arcade.*`)
 *
 * A gameplay colour is never reused as a brand colour and a brand colour never
 * denotes a charge/pixel. This module has no React / React Native imports so it
 * can be imported from pure unit tests.
 */

/* -------------------------------------------------------------------------- */
/*  11 brand colour tokens                                                     */
/* -------------------------------------------------------------------------- */

export const brandColor = {
  /** Primary background. App root, splash, store fields. 16.9:1 vs text.primary. */
  background: '#07060D',
  /** Secondary background. Sheets, modals, adaptive-icon bg, favicon plate. */
  backgroundAlt: '#120E2A',
  /** Portal block base — structure, secondary buttons. Large-text only (3.1:1). */
  indigo: '#4B47C9',
  /** Block highlight, focus ring, link-adjacent accent. 6.4:1 on background. */
  violet: '#9A7BFF',
  /** Warm portal accent — ARCADIA, primary CTA, core. 11.2:1. Ink #07060D on it. */
  portalWarm: '#FFB24D',
  /** Cool accent — rim light, links, informational marks. Never a CTA fill. */
  cyanAccent: '#4DE1FF',
  /** Headings, PIXEL wordmark, body copy. 16.9:1 on background. */
  textPrimary: '#EDEAF6',
  /** Sub-labels, metadata. 6.0:1 — floor for body copy. */
  textSecondary: '#948FB0',
  /** Cards, HUD pills, secondary button base. */
  surface: '#1A1730',
  /** Hairlines, dividers, card edges. 1px. */
  border: '#2A2440',
  /** Radial glow tint. Decorative only — never carries meaning or contrast. */
  glow: '#FFB24D',
} as const;

export type BrandColorToken = keyof typeof brandColor;

/** Ink colour to place on top of `portalWarm` fills (primary CTA label). */
export const brandInk = '#2A1405';

/* -------------------------------------------------------------------------- */
/*  4 approved gradients — no more                                             */
/* -------------------------------------------------------------------------- */

/**
 * Every gradient is expressed as ordered colour stops + a direction hint so it
 * can be rendered by whatever path a surface already uses (Skia gradient, a CSS
 * gradient on web, or a layered-View approximation). Anything not in this list
 * ships as a flat token — no gradient text, borders, or gameplay elements.
 */
export interface BrandGradient {
  readonly kind: 'linear' | 'radial';
  /** For linear: CSS-style angle in degrees (0 = up, 180 = down). */
  readonly angle?: number;
  /** For radial: focal point as [x%, y%] and radius %. */
  readonly center?: readonly [number, number];
  readonly radius?: number;
  readonly stops: readonly { readonly at: number; readonly color: string }[];
}

export const brandGradient = {
  /** Full-screen brand background. Every full-bleed brand surface. */
  background: {
    kind: 'radial',
    center: [50, 34],
    radius: 130,
    stops: [
      { at: 0, color: '#211546' },
      { at: 0.45, color: '#120E2A' },
      { at: 0.76, color: '#0A0817' },
      { at: 1, color: '#06050E' },
    ],
  },
  /** Warm pixel core. Icon core, loading pulse, logo mark only. */
  core: {
    kind: 'radial',
    center: [50, 50],
    radius: 50,
    stops: [
      { at: 0, color: '#FFFFFF' },
      { at: 0.22, color: '#FFF0B8' },
      { at: 0.55, color: '#FFC94D' },
      { at: 1, color: '#F2662E' },
    ],
  },
  /** Primary CTA fill only. */
  cta: {
    kind: 'linear',
    angle: 180,
    stops: [
      { at: 0, color: '#FFD98A' },
      { at: 0.52, color: '#FFB24D' },
      { at: 1, color: '#F0871F' },
    ],
  },
  /** Cards, HUD pills, secondary buttons — the only gradient allowed on repeated chrome. */
  surface: {
    kind: 'linear',
    angle: 165,
    stops: [
      { at: 0, color: '#231E3A' },
      { at: 1, color: '#141126' },
    ],
  },
} as const satisfies Record<string, BrandGradient>;

export type BrandGradientToken = keyof typeof brandGradient;

/* -------------------------------------------------------------------------- */
/*  5 brand motion tokens (additive — gameplay motion is untouched)            */
/* -------------------------------------------------------------------------- */

export interface BrandMotionToken {
  readonly durationMs: number;
  readonly easing: 'linear' | 'easeInOut' | 'easeOut' | 'spring';
  /** End state that reduce-motion resolves to immediately. */
  readonly reducedMotion: 'end-state' | 'static-hold';
}

export const brandMotion = {
  /** Portal glow breathing — splash + empty states. opacity .5→.8. */
  portalBreathe: { durationMs: 2400, easing: 'easeInOut', reducedMotion: 'end-state' },
  /** Pixel-core pulse — loading. scale 1→1.045, opacity .55→1. */
  corePulse: { durationMs: 1400, easing: 'easeInOut', reducedMotion: 'static-hold' },
  /** Square-particle arrival — brand reveals. scale .6→1 + 8px rise, 40ms stagger. */
  particleArrival: { durationMs: 260, easing: 'easeOut', reducedMotion: 'end-state' },
  /** Wordmark reveal — 6px rise + fade, 120ms after the mark. */
  wordmarkReveal: { durationMs: 420, easing: 'easeOut', reducedMotion: 'end-state' },
  /** Icon entrance — scale .88→1 with a soft overshoot. */
  iconEntrance: { durationMs: 500, easing: 'spring', reducedMotion: 'end-state' },
} as const satisfies Record<string, BrandMotionToken>;

export type BrandMotionName = keyof typeof brandMotion;

/* -------------------------------------------------------------------------- */
/*  Wordmark typography                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The in-app wordmark is LIVE text (accessibility + layout flexibility), set in
 * Space Grotesk 700 to match the approved outlined brand asset. PIXEL takes
 * `textPrimary`, ARCADIA takes `portalWarm`; the two words are equal weight and
 * separated by colour + a tighter-than-normal gap, never a weight change.
 */
export const wordmark = {
  /** Loaded via `@expo-google-fonts/space-grotesk` in `app/_layout.tsx`. */
  fontFamily: 'SpaceGrotesk_700Bold',
  fontWeight: '700' as const,
  words: { primary: 'PIXEL', accent: 'ARCADIA' },
  color: { primary: brandColor.textPrimary, accent: brandColor.portalWarm },
  /** Tracking by layout (fraction of font size — RN letterSpacing is absolute px). */
  trackingEm: { single: 0.1, stacked: 0.14, compact: 0.2 },
  /** Word gap as a fraction of font size for the single-line lockup. */
  wordGapEm: 0.34,
  /** Accessibility floor. */
  minFontSize: 15,
} as const;

/** Convenience: the plain wordmark string for `accessibilityLabel`. */
export const WORDMARK_LABEL = `${wordmark.words.primary} ${wordmark.words.accent}`;
