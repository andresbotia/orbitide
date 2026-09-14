import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HOME_COINS_PLACEHOLDER, HOME_HEARTS_PLACEHOLDER } from '@/theme/homeV2';
import { NEON, neonAlpha } from '@/theme/neon';

import { NeonPill } from './NeonPill';

interface HomeHudProps {
  hearts?: number;
  coins?: number;
  onSettings?: () => void;
}

/**
 * Top HUD: Hearts left, Coins + Settings right. Hearts and coins sit in neon
 * pills so they hold up against the busy scene; accessibility labels stay on
 * the counters themselves, not the housings.
 */
export const HomeHud = memo(function HomeHud({
  hearts = HOME_HEARTS_PLACEHOLDER,
  coins = HOME_COINS_PLACEHOLDER,
  onSettings,
}: HomeHudProps) {
  return (
    <View style={styles.row}>
      <NeonPill tone="magenta">
        <View style={styles.counter} accessibilityLabel={`${hearts} hearts`}>
          <Text style={styles.heartGlyph}>♥</Text>
          <Text style={styles.count}>{hearts}</Text>
        </View>
      </NeonPill>

      <View style={styles.right}>
        <NeonPill tone="gold">
          <View style={styles.counter} accessibilityLabel={`${coins} coins`}>
            <OctagonCoin />
            <Text style={styles.count}>{coins}</Text>
          </View>
        </NeonPill>
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
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heartGlyph: {
    color: NEON.magenta,
    fontSize: 18,
    lineHeight: 22,
  },
  count: {
    color: NEON.cyanPale,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 22,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    backgroundColor: NEON.gold,
    transform: [{ rotate: '45deg' }],
    borderRadius: 1,
  },
  coinFace: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: NEON.gold,
    borderWidth: 1,
    borderColor: NEON.goldDeep,
  },
  coinGlint: {
    position: 'absolute',
    top: 3,
    left: 4,
    width: 4,
    height: 3,
    borderRadius: 1,
    backgroundColor: NEON.cyanPale,
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
    color: neonAlpha(NEON.cyanPale, 0.7),
    fontSize: 18,
  },
});
