/** 4-point spacing scale used across the app. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

export const typography = {
  wordmark: { fontSize: 40, letterSpacing: 8, fontWeight: '700' as const },
  /**
   * Redesign Milestone 1 addition — hero-level headlines (world-map/campaign
   * titles). Larger than `title`; existing `title` usage (level titles,
   * section headers) is unchanged.
   */
  display: { fontSize: 28, letterSpacing: 1, fontWeight: '700' as const },
  title: { fontSize: 24, letterSpacing: 2, fontWeight: '700' as const },
  /**
   * Redesign Milestone 1 addition — matches `PrimaryCta`'s existing hardcoded
   * label style, so future CTA-adjacent text can reference one token instead
   * of re-deriving it. Does not change `PrimaryCta` itself this milestone.
   */
  cta: { fontSize: 17, letterSpacing: 17 * 0.16, fontWeight: '700' as const },
  label: { fontSize: 13, letterSpacing: 3, fontWeight: '600' as const },
  body: { fontSize: 16, letterSpacing: 0.5, fontWeight: '500' as const },
  /** Redesign Milestone 1 addition — tiny footer/secondary metadata, lighter than `label`. */
  metadata: { fontSize: 10, letterSpacing: 1, fontWeight: '500' as const },
  numeric: { fontSize: 34, letterSpacing: 1, fontWeight: '700' as const },
} as const;
