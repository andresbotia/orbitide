import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BrandGradientView } from '@/components/brand/BrandGradientView';
import { material } from '@/theme/material';
import { radius, spacing } from '@/theme/spacing';

/**
 * Compact Core V2 active-occupancy readout. Sits under the board/rail and
 * above Holding — not in the top header. Capacity is passed in; never hardcoded.
 *
 * North-star pass — restyled as a small mounted "readout plaque" (the same
 * `BrandGradientView token="surface"` hardware body as the Tunnel/Holding
 * housings, plus a top connector tab) so it reads as part of the cabinet
 * rather than an unrelated floating pill, without changing its position in
 * the layout (still between the board and Holding, per the approved spec).
 */
export const ActiveStatus = memo(function ActiveStatus({ count, capacity }: { count: number; capacity: number }) {
  if (capacity <= 0) return null;
  return (
    <View style={styles.mount}>
      <View pointerEvents="none" style={styles.tab} />
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={`Active ${count} of ${capacity}`}
        accessibilityLiveRegion="polite"
        style={styles.wrap}
      >
        <BrandGradientView token="surface" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <Text style={styles.text}>ACTIVE {count}/{capacity}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  mount: { alignItems: 'center' },
  tab: {
    width: 10,
    height: 5,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: material.accentCyan,
    opacity: 0.6,
  },
  wrap: {
    alignSelf: 'center',
    paddingHorizontal: spacing.sm + 6,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: material.accentCyan,
    shadowColor: material.accentCyan,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
    overflow: 'hidden',
  },
  text: {
    color: material.accentCyan,
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
