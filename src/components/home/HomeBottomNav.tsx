import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PixelPalFace } from '@/game/rendering/pixelPal/PixelPalFace';
import { homeAlpha, homeV2 } from '@/theme/homeV2';

export type HomeTab = 'shop' | 'home' | 'leaderboard';

interface HomeBottomNavProps {
  active: HomeTab;
  plinth: number;
  onShop: () => void;
  onHome: () => void;
  onLeaderboard: () => void;
}

/** 3-item control-deck nav. Center Home/Play sits on a raised plinth. */
export const HomeBottomNav = memo(function HomeBottomNav({
  active,
  plinth,
  onShop,
  onHome,
  onLeaderboard,
}: HomeBottomNavProps) {
  const insets = useSafeAreaInsets();
  const deck = 80;

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom }]}>
      <View style={[styles.deck, { height: deck }]}>
        <NavItem
          label="Shop"
          active={active === 'shop'}
          onPress={onShop}
          icon={<BagIcon active={active === 'shop'} />}
        />
        <View style={{ width: plinth }} />
        <NavItem
          label="Trophy"
          active={active === 'leaderboard'}
          onPress={onLeaderboard}
          icon={<TrophyIcon active={active === 'leaderboard'} />}
        />
      </View>

      <Pressable
        onPress={onHome}
        accessibilityRole="button"
        accessibilityLabel="Home"
        accessibilityState={{ selected: active === 'home' }}
        hitSlop={6}
        style={[
          styles.plinth,
          {
            width: plinth,
            height: plinth,
            borderRadius: plinth / 2,
            bottom: insets.bottom + 10,
            marginLeft: -plinth / 2,
          },
          active === 'home' && styles.plinthActive,
        ]}
      >
        <View style={styles.plinthRing} />
        <PixelPalFace color="white" size={Math.round(plinth * 0.52)} mood="happy" />
        <Text style={styles.plinthLabel}>Play</Text>
      </Pressable>
    </View>
  );
});

const NavItem = memo(function NavItem({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      {icon}
      <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{label}</Text>
    </Pressable>
  );
});

const BagIcon = memo(function BagIcon({ active }: { active: boolean }) {
  const color = active ? homeV2.cyan : homeAlpha(homeV2.white, 0.7);
  return (
    <View style={styles.iconBox}>
      <View style={[styles.bagBody, { borderColor: color }]} />
      <View style={[styles.bagHandle, { borderColor: color }]} />
    </View>
  );
});

const TrophyIcon = memo(function TrophyIcon({ active }: { active: boolean }) {
  const color = active ? homeV2.yellow : homeAlpha(homeV2.white, 0.7);
  return (
    <View style={styles.iconBox}>
      <View style={[styles.cup, { borderColor: color, backgroundColor: homeAlpha(color, 0.2) }]} />
      <View style={[styles.cupStem, { backgroundColor: color }]} />
      <View style={[styles.cupBase, { backgroundColor: color }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 0,
    backgroundColor: homeV2.deepNavy,
    borderTopWidth: 1,
    borderTopColor: homeAlpha(homeV2.cyan, 0.22),
  },
  deck: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 44,
    paddingBottom: 4,
  },
  itemPressed: { opacity: 0.7 },
  itemLabel: {
    color: homeAlpha(homeV2.white, 0.62),
    fontSize: 11,
    fontWeight: '600',
  },
  itemLabelActive: { color: homeV2.cyan },
  plinth: {
    position: 'absolute',
    left: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: homeV2.navy,
    borderWidth: 2,
    borderColor: homeV2.cyan,
    shadowColor: homeV2.cyan,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    gap: 1,
  },
  plinthActive: {
    borderColor: homeV2.yellow,
  },
  plinthRing: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: homeAlpha(homeV2.white, 0.18),
  },
  plinthLabel: {
    color: homeV2.white,
    fontSize: 10,
    fontWeight: '700',
    marginTop: -2,
  },
  iconBox: {
    width: 24,
    height: 22,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bagBody: {
    width: 16,
    height: 13,
    borderWidth: 1.5,
    borderRadius: 3,
  },
  bagHandle: {
    position: 'absolute',
    top: 2,
    width: 8,
    height: 7,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  cup: {
    width: 14,
    height: 10,
    borderWidth: 1.5,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
  },
  cupStem: {
    width: 2,
    height: 4,
    marginTop: 1,
  },
  cupBase: {
    width: 10,
    height: 2,
    borderRadius: 1,
  },
});
