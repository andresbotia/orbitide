import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';

import { HomeBottomNav } from '@/components/home/HomeBottomNav';
import { HomeEnvironment } from '@/components/home/HomeEnvironment';
import { sceneHorizonY } from '@/components/home/environment/sceneGeometry';
import { HomeHud } from '@/components/home/HomeHud';
import { computeHomeV2Layout } from '@/components/home/homeLayout';
import { HomeLevelCard } from '@/components/home/HomeLevelCard';
import { HomeMarquee } from '@/components/home/HomeMarquee';
import { HomePixelPalHero, palHeroMetrics } from '@/components/home/HomePixelPalHero';
import { HomePlayButton } from '@/components/home/HomePlayButton';
import { getLevel, requireLevel } from '@/game/levels/levels';
import { useAmbientActive } from '@/hooks/useAmbientActive';
import { HOME_COINS_PLACEHOLDER, HOME_HEARTS_PLACEHOLDER } from '@/theme/homeV2';
import { NEON } from '@/theme/neon';

interface HomeScreenProps {
  highestUnlockedLevel: number;
  loading: boolean;
  onPlay: () => void;
  onShop: () => void;
  onLeaderboard: () => void;
  onSettings: () => void;
  /** Dev-only: hidden long-press affordance on the marquee. */
  onSecretReset?: () => void;
}

/** Gap between the painted horizon and the podium's top edge. */
const PODIUM_CLEARANCE = 2;

/**
 * PIXEL ARCADIA HOME — tiled looping background + cabinet chrome. Presentation
 * only: progression, PLAY navigation, and storage are unchanged. Home-scoped
 * V2 tokens only; Worlds / Gameplay token systems are not rewritten here.
 */
export function HomeScreen({
  highestUnlockedLevel,
  loading,
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

  // Stand the mascot's podium just below the painted horizon. The hero's
  // layout y is its window y: the SafeAreaView is the root's first in-flow
  // child, at y 0, and the hero is its direct child. The clamp keeps the hero
  // inside its own margins, so on short screens the podium yields before it
  // would overlap the logo or the level card.
  const [hero, setHero] = useState<{ y: number; height: number } | null>(null);
  const handleHeroLayout = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setHero((prev) => (prev && prev.y === y && prev.height === height ? prev : { y, height }));
  }, []);
  const palMetrics = palHeroMetrics(layout.palSize);
  const palTop = hero
    ? Math.min(
        hero.height + layout.gap - palMetrics.height,
        Math.max(
          -layout.gap,
          sceneHorizonY(window.height) + PODIUM_CLEARANCE - hero.y - palMetrics.podiumTop,
        ),
      )
    : null;

  const handleHomeTab = useCallback(() => {
    // Already on Home.
  }, []);

  return (
    <View style={styles.root}>
      <HomeEnvironment
        width={window.width}
        height={window.height}
        active={active}
        reducedMotion={!!reducedMotion}
      />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.hud}>
          <HomeHud
            hearts={HOME_HEARTS_PLACEHOLDER}
            coins={HOME_COINS_PLACEHOLDER}
            onSettings={onSettings}
          />
        </View>

        <View style={styles.marquee}>
          <HomeMarquee
            width={layout.marqueeWidth}
            onSecretReset={__DEV__ ? onSecretReset : undefined}
          />
        </View>

        <View
          style={[styles.hero, { minHeight: palMetrics.height, marginVertical: layout.gap }]}
          onLayout={handleHeroLayout}
        >
          {/* Hidden for the single frame before the hero is measured. */}
          <View style={palTop === null ? styles.palPending : [styles.palPinned, { top: palTop }]}>
            <HomePixelPalHero size={layout.palSize} active={active} reducedMotion={!!reducedMotion} />
          </View>
        </View>

        <View style={[styles.progress, { marginBottom: layout.gap }]}>
          <HomeLevelCard
            levelId={level.id}
            title={level.title}
            difficulty={level.difficulty}
            medallionSize={layout.medallion}
          />
        </View>

        <View style={styles.playWrap}>
          <HomePlayButton onPress={onPlay} disabled={loading} capHeight={layout.playCap} />
        </View>
      </SafeAreaView>

      <HomeBottomNav
        active="home"
        plinth={layout.plinth}
        onShop={onShop}
        onHome={handleHomeTab}
        onLeaderboard={onLeaderboard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEON.inkDeep },
  safe: { flex: 1 },
  hud: { flexShrink: 0 },
  marquee: { flexShrink: 1 },
  hero: {
    flex: 1,
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  palPending: { opacity: 0 },
  palPinned: { position: 'absolute' },
  progress: {
    alignItems: 'center',
    flexShrink: 0,
  },
  playWrap: {
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 4,
    marginBottom: 12,
  },
});
