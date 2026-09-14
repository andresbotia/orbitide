/** Locked Home layout metrics. Reference frame: 393 × 852pt. */

export interface HomeV2Layout {
  width: number;
  height: number;
  compact: boolean;
  heroHeight: number;
  palSize: number;
  medallion: number;
  bezel: number;
  plinth: number;
  playCap: number;
  marqueeWidth: number;
  gap: number;
  hudHeight: number;
  navHeight: number;
}

const SMALL_W = 375;
const SMALL_H = 667;

export function computeHomeV2Layout(width: number, height: number): HomeV2Layout {
  const compact = width <= SMALL_W && height <= SMALL_H;
  // Shrink order on small phones: hero stage, then marquee, then breathing gap.
  const heroRatio = compact ? 0.32 : 0.4;
  return {
    width,
    height,
    compact,
    heroHeight: Math.round(height * heroRatio),
    palSize: compact ? 112 : Math.min(150, Math.round(width * 0.38)),
    medallion: 72,
    bezel: compact ? 10 : 14,
    plinth: compact ? 66 : 76,
    playCap: Math.max(56, compact ? 56 : 64),
    marqueeWidth: compact ? Math.round(width * 0.66) : Math.min(320, Math.round(width * 0.72)),
    gap: compact ? 6 : 12,
    hudHeight: 48,
    navHeight: 80,
  };
}
