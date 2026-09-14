import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { NEON, neonAlpha } from '@/theme/neon';

type PillTone = 'cyan' | 'magenta' | 'gold';

interface NeonPillProps {
  children: ReactNode;
  /** Neon tube colour. Pills only ever glow in palette neon. */
  tone?: PillTone;
  style?: StyleProp<ViewStyle>;
}

const PILL_RADIUS = 20;
const HALO_WIDTH = 6;

/**
 * Rounded HUD housing: dark translucent surface, 1.5px neon border, glow.
 *
 * The glow is a nested View, not a shadow: `shadowColor` / `shadowRadius` do
 * nothing on Android. An outer ring in the same neon at 20% opacity, 6px wide
 * with a radius grown by that width, reads as bloom on both platforms and costs
 * nothing to composite.
 *
 * Purely visual — accessibility labels stay on the content the pill wraps.
 */
export const NeonPill = memo(function NeonPill({ children, tone = 'cyan', style }: NeonPillProps) {
  const neon = NEON[tone];
  return (
    <View style={[styles.halo, { borderColor: neonAlpha(neon, 0.2) }, style]}>
      <View style={[styles.pill, { borderColor: neon }]}>{children}</View>
    </View>
  );
});

const styles = StyleSheet.create({
  halo: {
    borderWidth: HALO_WIDTH,
    borderRadius: PILL_RADIUS + HALO_WIDTH,
  },
  pill: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: PILL_RADIUS,
    borderWidth: 1.5,
    backgroundColor: NEON.surface,
  },
});
