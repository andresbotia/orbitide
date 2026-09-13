import { StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/IconButton';
import { material } from '@/theme/material';

interface TopUtilityProps {
  /** Presentation-only balance. No economy in M2A.2. */
  coins?: number;
  onSettings?: () => void;
}

/**
 * QUIET TOP UTILITY: settings + coin balance. Deliberately subdued — neither
 * element should ever compete with PLAY. No store promo, no economy panel.
 *
 * UI-R9 functional-UI cleanup: no screen has ever passed `onSettings` — there
 * is no production settings screen to open. Rather than show a dead,
 * decoration-only gear (a fake affordance), it's hidden entirely, leaving a
 * same-size spacer so the coin pill doesn't jump position. The moment a real
 * settings destination exists, passing `onSettings` brings the icon back
 * with zero further changes here.
 */
export function TopUtility({ coins = 0, onSettings }: TopUtilityProps) {
  return (
    <View style={styles.row}>
      {onSettings ? (
        <IconButton glyph="⚙" onPress={onSettings} accessibilityLabel="Settings" />
      ) : (
        <View style={styles.spacer} />
      )}

      <View style={styles.coins} accessibilityLabel={`${coins} coins`}>
        <Text style={styles.coinIcon}>◈</Text>
        <Text style={styles.coinValue}>{coins}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  spacer: { width: 40, height: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  coins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: material.structuralSurface,
    borderWidth: 1,
    borderColor: material.outline,
  },
  coinIcon: { color: material.energyWarm, fontSize: 11, opacity: 0.85 },
  coinValue: { color: material.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
});
