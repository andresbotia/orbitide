import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { material } from '@/theme/material';
import { radius, spacing } from '@/theme/spacing';

/**
 * Compact Core V2 active-occupancy readout. Sits under the board/rail and
 * above Holding — not in the top header. Capacity is passed in; never hardcoded.
 */
export const ActiveStatus = memo(function ActiveStatus({ count, capacity }: { count: number; capacity: number }) {
  if (capacity <= 0) return null;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Active ${count} of ${capacity}`}
      accessibilityLiveRegion="polite"
      style={styles.wrap}
    >
      <Text style={styles.text}>ACTIVE {count}/{capacity}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: material.recessedSurface,
    borderWidth: 1,
    borderColor: material.accentCyan,
  },
  text: {
    color: material.accentCyan,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
});
