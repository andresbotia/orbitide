import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { homeAlpha, homeV2 } from '@/theme/homeV2';

/**
 * Compact Core V2 active-occupancy readout. Capacity is passed in; never hardcoded.
 * When `embedded`, this is an inline label on the control deck — no pill, no border.
 */
export const ActiveStatus = memo(function ActiveStatus({
  count, capacity, embedded = false,
}: {
  count: number;
  capacity: number;
  embedded?: boolean;
}) {
  if (capacity <= 0) return null;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Active ${count} of ${capacity}`}
      accessibilityLiveRegion="polite"
      style={embedded ? styles.inline : styles.wrap}
    >
      <Text style={styles.label}>ACTIVE </Text>
      <Text style={styles.num}>{count}/{capacity}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'baseline' },
  inline: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'baseline', height: 20 },
  label: {
    color: homeAlpha(homeV2.white, 0.75),
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  num: {
    color: homeV2.cyan,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
