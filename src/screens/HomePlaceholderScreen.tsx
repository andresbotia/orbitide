import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeBottomNav, type HomeTab } from '@/components/home/HomeBottomNav';
import { HomeSkyBackdrop } from '@/components/home/HomeSkyBackdrop';
import { AV, AV_FONT } from '@/theme/arcadiaV2';

interface HomePlaceholderScreenProps {
  title: string;
  body: string;
  tab: Exclude<HomeTab, 'home'>;
  onShop: () => void;
  onHome: () => void;
  onLeaderboard: () => void;
  onBack?: () => void;
}

/** Safe visual placeholder for Home-adjacent destinations that have no backend. */
export const HomePlaceholderScreen = memo(function HomePlaceholderScreen({
  title,
  body,
  tab,
  onShop,
  onHome,
  onLeaderboard,
  onBack,
}: HomePlaceholderScreenProps) {
  const window = useWindowDimensions();

  return (
    <View style={styles.root}>
      <HomeSkyBackdrop width={window.width} height={window.height} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {onBack ? (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
            <Text style={styles.backLabel}>‹ Back</Text>
          </Pressable>
        ) : null}
        <View style={styles.body}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.copy}>{body}</Text>
        </View>
      </SafeAreaView>
      <HomeBottomNav
        active={tab}
        onShop={onShop}
        onHome={onHome}
        onLeaderboard={onLeaderboard}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AV.skyTop },
  safe: { flex: 1 },
  back: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  backLabel: {
    color: AV.white,
    fontFamily: AV_FONT.semibold,
    fontSize: 16,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    color: AV.ink,
    fontFamily: AV_FONT.extraBold,
    fontSize: 28,
  },
  copy: {
    color: AV.ink,
    fontFamily: AV_FONT.regular,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
});
