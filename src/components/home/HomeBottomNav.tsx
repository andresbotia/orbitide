import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PixelPalFace } from '@/game/rendering/pixelPal/PixelPalFace';
import { NEON, neonAlpha } from '@/theme/neon';

export type HomeTab = 'shop' | 'home' | 'leaderboard';

interface HomeBottomNavProps {
  active: HomeTab;
  plinth: number;
  onShop: () => void;
  onHome: () => void;
  onLeaderboard: () => void;
}

/** How far the centre Play tab rises above the panel row. */
const PLAY_RAISE = 22;

/**
 * 3-item control-deck nav. Shop and Trophy are framed panels; the centre
 * Home/Play tab is a round ring raised above the row. The deck reserves the
 * raise as top margin so the ring never crowds the PLAY button above it.
 */
export const HomeBottomNav = memo(function HomeBottomNav({
  active,
  plinth,
  onShop,
  onHome,
  onLeaderboard,
}: HomeBottomNavProps) {
  const insets = useSafeAreaInsets();
  const homeActive = active === 'home';

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 8 }]}>
      <NavItem
        label="Shop"
        active={active === 'shop'}
        onPress={onShop}
        icon={<BagIcon active={active === 'shop'} />}
      />

      <Pressable
        onPress={onHome}
        accessibilityRole="button"
        accessibilityLabel="Home"
        accessibilityState={{ selected: homeActive }}
        hitSlop={6}
        style={[
          styles.play,
          { width: plinth, height: plinth },
          homeActive ? styles.playActive : styles.playIdle,
        ]}
      >
        <PixelPalFace color="white" size={Math.round(plinth * 0.52)} mood="happy" />
        <Text style={[styles.playLabel, homeActive && styles.labelActive]}>Play</Text>
      </Pressable>

      <NavItem
        label="Trophy"
        active={active === 'leaderboard'}
        onPress={onLeaderboard}
        icon={<TrophyIcon active={active === 'leaderboard'} />}
      />
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
      <Text style={[styles.itemLabel, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
});

const INACTIVE_ICON = neonAlpha(NEON.cyanPale, 0.7);

const BagIcon = memo(function BagIcon({ active }: { active: boolean }) {
  const color = active ? NEON.cyan : INACTIVE_ICON;
  return (
    <View style={styles.iconBox}>
      <View style={[styles.bagBody, { borderColor: color }]} />
      <View style={[styles.bagHandle, { borderColor: color }]} />
    </View>
  );
});

const TrophyIcon = memo(function TrophyIcon({ active }: { active: boolean }) {
  const color = active ? NEON.gold : INACTIVE_ICON;
  const fill = active ? neonAlpha(NEON.gold, 0.2) : neonAlpha(NEON.cyanPale, 0.14);
  return (
    <View style={styles.iconBox}>
      <View style={[styles.cup, { borderColor: color, backgroundColor: fill }]} />
      <View style={[styles.cupStem, { backgroundColor: color }]} />
      <View style={[styles.cupBase, { backgroundColor: color }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: PLAY_RAISE,
    paddingTop: 10,
    paddingHorizontal: 12,
    backgroundColor: neonAlpha(NEON.ink, 0.9),
    borderTopWidth: 1,
    borderTopColor: neonAlpha(NEON.cyan, 0.35),
  },
  item: {
    flex: 1,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: neonAlpha(NEON.cyan, 0.25),
    borderRadius: 12,
  },
  itemPressed: { opacity: 0.7 },
  itemLabel: {
    color: neonAlpha(NEON.cyanPale, 0.62),
    fontSize: 11,
    fontWeight: '600',
  },
  labelActive: { color: NEON.cyan },
  play: {
    marginTop: -PLAY_RAISE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderRadius: 999,
    backgroundColor: NEON.ink,
    // Static iOS bloom only; never animated. Android relies on the ring.
    shadowColor: NEON.cyan,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  playActive: {
    borderWidth: 2.5,
    borderColor: NEON.cyan,
  },
  playIdle: {
    borderWidth: 1,
    borderColor: neonAlpha(NEON.cyan, 0.25),
  },
  playLabel: {
    color: NEON.cyanPale,
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
