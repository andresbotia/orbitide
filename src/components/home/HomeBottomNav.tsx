import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvIcon, type AvIconName } from '@/components/v2/AvIcon';
import { AV, AV_DEPTH, AV_FONT, avAlpha } from '@/theme/arcadiaV2';

export type HomeTab = 'shop' | 'home' | 'leaderboard';

interface HomeBottomNavProps {
  active: HomeTab;
  onShop: () => void;
  onHome: () => void;
  onLeaderboard: () => void;
}

const TRAY_H = 70;
/** Space kept above the tray (the old raised tile's rise), so Home layout holds. */
const TRAY_TOP_GAP = 16;
const PILL_W = 52;
const PILL_H = 32;
const ACTIVE_PILL = avAlpha(AV.iconSoft, 0.14);

/**
 * M7A — v2 bottom nav: a floating white tray (70pt, radius 26, 14pt side
 * inset) with three equal navigation tabs — Shop, Home, Trophies. Stroke
 * icons with 11pt labels; the selected tab sits in a soft blue pill. Play
 * lives only on the gold Home CTA, never here. Static; press feedback only.
 */
export const HomeBottomNav = memo(function HomeBottomNav({
  active,
  onShop,
  onHome,
  onLeaderboard,
}: HomeBottomNavProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.outer, { marginBottom: Math.max(12, insets.bottom - 6) }]}>
      <View style={styles.tray}>
        <NavItem label="Shop" icon="shop" active={active === 'shop'} onPress={onShop} />
        <NavItem label="Home" icon="home" active={active === 'home'} onPress={onHome} />
        <NavItem label="Trophies" icon="trophy" active={active === 'leaderboard'} onPress={onLeaderboard} />
      </View>
    </View>
  );
});

const NavItem = memo(function NavItem({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: AvIconName;
  active: boolean;
  onPress: () => void;
}) {
  const color = active ? AV.ink : AV.iconSoft;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={active ? `${label}, current tab` : label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <View style={[styles.pill, active && styles.pillActive]}>
        <AvIcon name={icon} size={24} color={color} stroke={2.2} />
      </View>
      <Text style={[styles.itemLabel, { color }]}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  outer: {
    flexShrink: 0,
    marginTop: TRAY_TOP_GAP,
    marginHorizontal: 14,
  },
  tray: {
    height: TRAY_H,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    ...AV_DEPTH.softLift,
  },
  item: {
    flex: 1,
    height: TRAY_H,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  itemPressed: { opacity: 0.7 },
  pill: {
    width: PILL_W,
    height: PILL_H,
    borderRadius: PILL_H / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: ACTIVE_PILL },
  itemLabel: { fontFamily: AV_FONT.bold, fontSize: 11 },
});
