import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvHeartIcon, AvIcon } from '@/components/v2/AvIcon';
import { CoinMedallion } from '@/components/v2/primitives';
import { AV, AV_FONT, AV_TYPE, formatCount } from '@/theme/arcadiaV2';
import { HOME_COINS_PLACEHOLDER, HOME_HEARTS_PLACEHOLDER } from '@/theme/homeV2';

interface HomeHudProps {
  hearts?: number;
  coins?: number;
  /** Mint "+" on the coin pill. Omitted → the "+" is not drawn. */
  onAddCoins?: () => void;
  onSettings?: () => void;
}

/** Lives are presentation placeholders (no heart-loss logic yet); 5 reads as full. */
const HEARTS_MAX = 5;

/**
 * M7A — v2 Home resource bar: white 92% pills, 36pt tall, each led by a 28pt
 * medallion with a 2pt inner lip. Lives left; coins (+ mint "+") and a glass
 * settings button right. Accessibility labels sit on the counters.
 */
export const HomeHud = memo(function HomeHud({
  hearts = HOME_HEARTS_PLACEHOLDER,
  coins = HOME_COINS_PLACEHOLDER,
  onAddCoins,
  onSettings,
}: HomeHudProps) {
  const full = hearts >= HEARTS_MAX;
  return (
    <View style={styles.row}>
      <View style={[styles.pill, styles.heartPill]} accessible accessibilityLabel={`${hearts} lives${full ? ', full' : ''}`}>
        <LinearGradient colors={[AV.heartTop, AV.heartBottom]} style={[styles.medallion, styles.heartMedallion]}>
          <View style={[styles.innerLip, { backgroundColor: AV.heartLip }]} />
          <AvHeartIcon size={15} />
        </LinearGradient>
        <View style={styles.stack}>
          <Text style={styles.count}>{hearts}</Text>
          {full ? <Text style={styles.sub}>FULL</Text> : null}
        </View>
      </View>

      <View style={styles.spacer} />

      <View style={[styles.pill, styles.coinPill, !onAddCoins && styles.coinPillBare]}>
        <View style={styles.coinValue} accessible accessibilityLabel={`${coins} coins`}>
          <CoinMedallion size={28} />
          <Text style={[styles.count, styles.coinCount]}>{formatCount(coins)}</Text>
        </View>
        {onAddCoins ? (
          <Pressable
            onPress={onAddCoins}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Get more coins"
            style={({ pressed }) => [styles.plus, pressed && styles.pressed]}
          >
            <View style={[styles.innerLip, styles.plusLip]} />
            <Text style={styles.plusText}>+</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={onSettings}
        disabled={!onSettings}
        hitSlop={6}
        pressRetentionOffset={12}
        accessibilityRole="button"
        accessibilityLabel="Settings"
        accessibilityState={{ disabled: !onSettings }}
        style={({ pressed }) => [styles.gear, pressed && onSettings ? styles.pressed : null]}
      >
        <AvIcon name="gear" size={20} color={AV.white} stroke={2} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    height: 40,
    marginTop: 7,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spacer: { flex: 1 },
  pill: {
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    // Solid 3pt drop — the design's pill lip, not a blur.
    shadowColor: AV.ink,
    shadowOpacity: 0.15,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  heartPill: { paddingLeft: 4, paddingRight: 12 },
  coinPill: { paddingHorizontal: 4 },
  coinPillBare: { paddingRight: 8 },
  coinValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  medallion: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heartMedallion: { borderRadius: 14 },
  innerLip: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2 },
  stack: { justifyContent: 'center' },
  count: { ...AV_TYPE.counter, color: AV.ink, lineHeight: 17 },
  coinCount: { minWidth: 44 },
  sub: { fontFamily: AV_FONT.bold, fontSize: 9, lineHeight: 10, letterSpacing: 0.5, color: AV.inkMuted },
  plus: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: AV.mint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  plusLip: { backgroundColor: AV.mintLip },
  plusText: { fontFamily: AV_FONT.black, fontSize: 18, lineHeight: 20, color: AV.white, marginTop: -1 },
  gear: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
});
