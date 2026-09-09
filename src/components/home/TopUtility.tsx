import { Pressable, StyleSheet, Text, View } from 'react-native';

import { arcade } from '@/theme/arcade';
import { palette } from '@/theme/colors';

interface TopUtilityProps {
  /** Presentation-only balance. No economy in M2A.2. */
  coins?: number;
  onSettings?: () => void;
}

/**
 * QUIET TOP UTILITY: settings + coin balance. Deliberately subdued — neither
 * element should ever compete with PLAY. No store promo, no economy panel.
 */
export function TopUtility({ coins = 0, onSettings }: TopUtilityProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onSettings}
        disabled={!onSettings}
        accessibilityRole="button"
        accessibilityLabel="Settings (coming soon)"
        hitSlop={12}
        style={({ pressed }) => [styles.gear, pressed && styles.pressed]}
      >
        <Text style={styles.gearIcon}>⚙</Text>
      </Pressable>

      <View style={styles.coins} accessibilityLabel={`${coins} coins`}>
        <Text style={styles.coinIcon}>◈</Text>
        <Text style={styles.coinValue}>{coins}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  gear: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  pressed: { opacity: 0.5 },
  gearIcon: { color: arcade.metalEdge, fontSize: 18 },
  coins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: arcade.metal,
    borderWidth: 1,
    borderColor: arcade.metalLo,
  },
  coinIcon: { color: arcade.warn, fontSize: 11, opacity: 0.85 },
  coinValue: { color: palette.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
});
