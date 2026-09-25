import { useCallback, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';

import { HomeBottomNav } from '@/components/home/HomeBottomNav';
import { HomeHud } from '@/components/home/HomeHud';
import { computeHomeV2Layout } from '@/components/home/homeLayout';
import { HomeLevelCard } from '@/components/home/HomeLevelCard';
import { HomeMarquee } from '@/components/home/HomeMarquee';
import { HomeMascot, mascotMetrics } from '@/components/home/HomeMascot';
import { HomePlayButton } from '@/components/home/HomePlayButton';
import { HomeSkyBackdrop, HomeSkyline } from '@/components/home/HomeSkyBackdrop';
import { M6_ECONOMY } from '@/game/economy/config';
import { getLevel, nextLevelId, requireLevel } from '@/game/levels/levels';
import { useAmbientActive } from '@/hooks/useAmbientActive';
import { AV } from '@/theme/arcadiaV2';
import { HOME_COINS_PLACEHOLDER, HOME_HEARTS_PLACEHOLDER } from '@/theme/homeV2';

interface HomeScreenProps {
  highestUnlockedLevel: number;
  loading: boolean;
  coins?: number;
  onPlay: () => void;
  onShop: () => void;
  onLeaderboard: () => void;
  onSettings: () => void;
  /** Dev-only: hidden long-press affordance on the marquee. */
  onSecretReset?: () => void;
}

/** How far the mascot's podium sits above the skyline's horizon line (pt). */
const HORIZON_CLEARANCE = 30;

/**
 * PIXEL ARCADIA HOME — M7A v2 (B1): open blue sky, resource bar, logo, the
 * mascot on its podium over a soft skyline, the progression strip with the
 * pixel-stepped level badge, level title + difficulty, the gold PLAY CTA and
 * the floating nav tray. Presentation only: progression, PLAY navigation and
 * storage are unchanged. Static by default — the mascot's 2pt bob is the only
 * idle motion.
 */
export function HomeScreen({
  highestUnlockedLevel,
  loading,
  coins,
  onPlay,
  onShop,
  onLeaderboard,
  onSettings,
  onSecretReset,
}: HomeScreenProps) {
  const window = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const active = useAmbientActive();
  const layout = useMemo(
    () => computeHomeV2Layout(window.width, window.height),
    [window.width, window.height],
  );

  const level = getLevel(highestUnlockedLevel) ?? requireLevel(1);
  const mascot = mascotMetrics(layout.palSize);

  const handleHomeTab = useCallback(() => {
    // Already on Home.
  }, []);

  return (
    <View style={styles.root}>
      <HomeSkyBackdrop width={window.width} height={window.height} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <HomeHud
          hearts={HOME_HEARTS_PLACEHOLDER}
          coins={coins ?? HOME_COINS_PLACEHOLDER}
          onAddCoins={onShop}
          onSettings={onSettings}
        />

        <View style={[styles.marquee, { marginTop: layout.gap }]}>
          <HomeMarquee
            width={layout.logoWidth}
            onSecretReset={__DEV__ ? onSecretReset : undefined}
          />
        </View>

        <View style={[styles.hero, { minHeight: mascot.height + HORIZON_CLEARANCE + 8 }]}>
          <HomeSkyline width={window.width} />
          <View style={[styles.mascot, { bottom: HORIZON_CLEARANCE }]}>
            <HomeMascot size={layout.palSize} active={active} reducedMotion={!!reducedMotion} />
          </View>
        </View>

        <View style={[styles.progress, { marginTop: layout.gap }]}>
          <HomeLevelCard
            levelId={level.id}
            title={level.title}
            difficulty={level.difficulty}
            nextLevelId={nextLevelId(level.id)}
            clearReward={M6_ECONOMY.firstClearReward}
            compact={layout.compact}
          />
        </View>

        <View style={[styles.playWrap, { marginTop: layout.compact ? 12 : 18 }]}>
          <HomePlayButton
            onPress={onPlay}
            disabled={loading}
            width={layout.ctaWidth}
            height={layout.ctaHeight}
          />
        </View>
      </SafeAreaView>

      <HomeBottomNav
        active="home"
        onShop={onShop}
        onHome={handleHomeTab}
        onLeaderboard={onLeaderboard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AV.skyTop },
  safe: { flex: 1 },
  marquee: { flexShrink: 1, alignItems: 'center' },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  mascot: { position: 'absolute', alignSelf: 'center' },
  progress: { alignItems: 'center', flexShrink: 0 },
  playWrap: { alignItems: 'center', flexShrink: 0 },
});
