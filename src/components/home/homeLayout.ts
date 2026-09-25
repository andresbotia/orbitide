import { AV_COMPACT_HEIGHT, AV_SIZE } from '@/theme/arcadiaV2';

/** v2 Home layout metrics. Reference frame: 390 × 844pt (iPhone 14/15). */

export interface HomeV2Layout {
  width: number;
  height: number;
  /** Small phones (≤667pt tall): mascot, logo and badge step down. */
  compact: boolean;
  palSize: number;
  logoWidth: number;
  ctaWidth: number;
  ctaHeight: number;
  gap: number;
}

export function computeHomeV2Layout(width: number, height: number): HomeV2Layout {
  const compact = height <= AV_COMPACT_HEIGHT;
  return {
    width,
    height,
    compact,
    palSize: compact ? 96 : Math.min(128, Math.round(width * 0.33)),
    logoWidth: compact ? Math.round(width * 0.48) : Math.min(260, Math.round(width * 0.66)),
    ctaWidth: Math.min(AV_SIZE.cta.width, width - 64),
    ctaHeight: compact ? 58 : AV_SIZE.cta.height,
    gap: compact ? 6 : 12,
  };
}
