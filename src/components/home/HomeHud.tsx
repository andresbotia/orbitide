import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HOME_COINS_PLACEHOLDER, HOME_HEARTS_PLACEHOLDER, homeAlpha, homeV2 } from '@/theme/homeV2';

interface HomeHudProps {
  hearts?: number;
  coins?: number;
  onSettings?: () => void;
}

/**
 * Top HUD: Hearts left, Coins + Settings right. Reserves a recharge-timer
 * slot under the heart count; the timer stays empty until a real system exists.
 */
export const HomeHud = memo(function HomeHud({
  hearts = HOME_HEARTS_PLACEHOLDER,
  coins = HOME_COINS_PLACEHOLDER,
  onSettings,
}: HomeHudProps) {
  return (
    <View style={styles.row}>
      <View style={styles.hearts} accessibilityLabel={`${hearts} hearts`}>
        <View style={styles.heartsRow}>
          <Text style={styles.heartGlyph}>♥</Text>
          <Text style={styles.heartCount}>{hearts}</Text>
        </View>
        <View style={styles.timerSlot} />
      </View>

      <View style={styles.right}>
        <View style={styles.coins} accessibilityLabel={`${coins} coins`}>
          <OctagonCoin />
          <Text style={styles.coinValue}>{coins}</Text>
        </View>
        <Pressable
          onPress={onSettings}
          disabled={!onSettings}
          hitSlop={10}
          pressRetentionOffset={12}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          accessibilityState={{ disabled: !onSettings }}
          style={({ pressed }) => [styles.gearHit, pressed && onSettings ? styles.gearPressed : null]}
        >
          <Text style={styles.gear}>⚙</Text>
        </Pressable>
      </View>
    </View>
  );
});

const OctagonCoin = memo(function OctagonCoin() {
  return (
    <View style={styles.coin} accessibilityElementsHidden>
      <View style={styles.coinDiamond} />
      <View style={styles.coinFace} />
      <View style={styles.coinGlint} />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  hearts: {
    minWidth: 72,
    justifyContent: 'center',
  },
  heartsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heartGlyph: {
    color: homeV2.red,
    fontSize: 18,
    lineHeight: 22,
  },
  heartCount: {
    color: homeV2.white,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 22,
  },
  timerSlot: {
    height: 12,
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  coinValue: {
    color: homeV2.white,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  coin: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinDiamond: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: homeV2.yellow,
    transform: [{ rotate: '45deg' }],
    borderRadius: 1,
  },
  coinFace: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: homeV2.yellow,
    borderWidth: 1,
    borderColor: homeV2.playSkirt,
  },
  coinGlint: {
    position: 'absolute',
    top: 3,
    left: 4,
    width: 4,
    height: 3,
    borderRadius: 1,
    backgroundColor: homeV2.white,
    opacity: 0.7,
  },
  gearHit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearPressed: { opacity: 0.7 },
  gear: {
    color: homeAlpha(homeV2.white, 0.55),
    fontSize: 18,
  },
});
