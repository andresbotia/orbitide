import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeBottomNav, type HomeTab } from '@/components/home/HomeBottomNav';
import { computeHomeV2Layout } from '@/components/home/homeLayout';
import { homeAlpha, homeV2 } from '@/theme/homeV2';

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
  const layout = useMemo(
    () => computeHomeV2Layout(window.width, window.height),
    [window.width, window.height],
  );

  return (
    <View style={styles.root}>
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
        plinth={layout.plinth}
        onShop={onShop}
        onHome={onHome}
        onLeaderboard={onLeaderboard}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: homeV2.deepNavy },
  safe: { flex: 1 },
  back: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  backLabel: {
    color: homeAlpha(homeV2.white, 0.8),
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    color: homeV2.white,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    fontWeight: '700',
  },
  copy: {
    color: homeAlpha(homeV2.white, 0.7),
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
});
