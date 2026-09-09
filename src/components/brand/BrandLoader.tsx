import { memo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { brandColor } from '@/theme/brand';
import { CorePulse } from './CorePulse';

interface BrandLoaderProps {
  /** Core size in px (§ Loading: 24 default). */
  size?: number;
  /** Optional caption under the pulse. */
  label?: string;
  /** Screen-reader announcement; the pulse itself carries no visual text. */
  accessibilityLabel?: string;
  fill?: boolean;
  style?: ViewStyle;
}

/**
 * The shared branded loading treatment: one breathing pixel core, optionally
 * captioned. Understandable without animation (reduce-motion holds it static and
 * the accessibility label still announces "Loading").
 */
export const BrandLoader = memo(function BrandLoader({
  size = 24,
  label,
  accessibilityLabel = 'Loading',
  fill = false,
  style,
}: BrandLoaderProps) {
  return (
    <View
      style={[fill ? styles.fill : styles.inline, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
    >
      <CorePulse size={size} glow />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  inline: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: brandColor.background,
  },
  label: {
    color: brandColor.textSecondary,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '600',
  },
});
