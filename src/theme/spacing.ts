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
  title: { fontSize: 24, letterSpacing: 2, fontWeight: '700' as const },
  label: { fontSize: 13, letterSpacing: 3, fontWeight: '600' as const },
  body: { fontSize: 16, letterSpacing: 0.5, fontWeight: '500' as const },
  numeric: { fontSize: 34, letterSpacing: 1, fontWeight: '700' as const },
} as const;
