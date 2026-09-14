import { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, runOnJS, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';

import { PlayButton } from '@/components/PlayButton';
import { PixelArcadiaWordmark, PrimaryCta } from '@/components/brand';
import { FloatingFragments } from '@/components/home/FloatingFragments';
import { HomeCenterpiece } from '@/components/home/HomeCenterpiece';
import { HomeEnvironment } from '@/components/home/HomeEnvironment';
import { HomePixelPalHero } from '@/components/home/HomePixelPalHero';
import { LevelBadge } from '@/components/home/LevelBadge';
import { TopUtility } from '@/components/home/TopUtility';
import { CAMPAIGN_MANIFEST } from '@/game/levels/campaign';
import { summarizeWorlds } from '@/game/levels/campaignProgress';
import { FIRST_LEVEL, getLevel, requireLevel, TOTAL_LEVELS } from '@/game/levels/levels';
import { ambientChargeSpecs, computeHomeLayout, homeLevelPreview } from '@/game/rendering/homeGeometry';
import { useAmbientActive } from '@/hooks/useAmbientActive';
import { feedback } from '@/game/feedback';
import { material } from '@/theme/material';
import { spacing } from '@/theme/spacing';
import { worldSkin } from '@/theme/worldSkins';

interface HomeScreenProps {
  highestUnlockedLevel: number;
  loading: boolean;
  onPlay: () => void;
  /** Open the world/level-select campaign map. */
  onWorlds: () => void;
  /** Dev-only: hidden long-press affordance on the wordmark. */
  onSecretReset?: () => void;
}

/**
 * PIXEL ARCADIA HOME — the arcade hub (UI-R2). Presentation only: progression,
 * navigation, and storage are unchanged from the previous milestone. See
 * `docs/DESIGN.md` for the material/motion/world-skin foundations this screen
 * consumes (`theme/material.ts`, `theme/worldSkins.ts`).
 */
export function HomeScreen({ highestUnlockedLevel, loading, onPlay, onWorlds, onSecretReset }: HomeScreenProps) {
  const window = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const active = useAmbientActive();

  const [band, setBand] = useState({ width: window.width, height: Math.max(320, window.height * 0.55) });
  const onBandLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBand({ width: Math.round(width), height: Math.round(height) });
  }, []);

  const level = getLevel(highestUnlockedLevel) ?? requireLevel(1);
  const layout = useMemo(
    () => computeHomeLayout({ width: band.width, height: band.height, reducedMotion }),
    [band.width, band.height, reducedMotion],
  );
  const preview = useMemo(() => homeLevelPreview(level), [level]);
  const specs = useMemo(
    () => ambientChargeSpecs(level, layout.ambientChargeCount),
    [level, layout.ambientChargeCount],
  );

  // Current world identity — real campaign data, no hardcoded example values.
  const worldSummaries = useMemo(
    () => summarizeWorlds(CAMPAIGN_MANIFEST, { highestUnlockedLevel }),
    [highestUnlockedLevel],
  );
  const currentWorld = useMemo(
    () => worldSummaries.find((s) => s.world.levelIds.includes(level.id)),
    [worldSummaries, level.id],
  );
  const worldAccent = worldSkin(currentWorld?.world.themeId).accent;

  const activation = useSharedValue(0);
  const navigating = useRef(false);

  useFocusEffect(
    useCallback(() => {
      navigating.current = false;
      activation.set(0);
    }, [activation]),
  );

  const handlePressIn = useCallback(() => {
    feedback.emit('select');
  }, []);

  const handlePlay = useCallback(() => {
    if (navigating.current) return;
    navigating.current = true;
    // Navigate off the animation's own completion rather than a decoupled
    // timeout, so the activation ramp is the actual cause of the transition.
    activation.set(
      withTiming(1, { duration: 160 }, (finished) => {
        if (finished) runOnJS(onPlay)();
      }),
    );
  }, [activation, onPlay]);

  const cleared = Math.max(0, Math.min(TOTAL_LEVELS, highestUnlockedLevel - 1));
  const enter = !reducedMotion;

  return (
    <View style={styles.root}>
      <HomeEnvironment
        width={window.width}
        height={window.height}
        layout={layout}
        worldAccent={worldAccent}
        active={active}
        reducedMotion={reducedMotion}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <TopUtility />

        <View style={styles.hero} onLayout={onBandLayout}>
          <Animated.View entering={enter ? FadeIn.duration(360) : undefined}>
            <PixelArcadiaWordmark
              size={26}
              layout="stacked"
              align="center"
              style={styles.wordmark}
              onLongPress={__DEV__ ? onSecretReset : undefined}
            />
          </Animated.View>

          {band.width > 0 ? (
            <Animated.View
              entering={enter ? FadeIn.duration(420).delay(70) : undefined}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <HomeCenterpiece
                layout={layout}
                preview={preview}
                specs={specs}
                worldAccent={worldAccent}
                active={active}
                reducedMotion={reducedMotion}
                activation={activation}
              />
              <HomePixelPalHero layout={layout} active={active} reducedMotion={reducedMotion} activation={activation} />
              {layout.showForeground ? (
                <FloatingFragments layout={layout} active={active} reducedMotion={reducedMotion} />
              ) : null}
            </Animated.View>
          ) : null}
        </View>

        <Animated.View
          entering={enter ? FadeInDown.duration(360).delay(160) : undefined}
          style={styles.controls}
        >
          <LevelBadge
            levelId={level.id}
            difficulty={level.difficulty}
            worldDisplayIndex={currentWorld?.displayIndex}
            worldTitle={currentWorld?.world.title}
            worldAccent={worldAccent}
          />
          <PlayButton
            label={highestUnlockedLevel > FIRST_LEVEL ? 'Continue' : 'Play'}
            onPress={handlePlay}
            onPressIn={handlePressIn}
            disabled={loading}
            idleGlow={!loading}
          />
          <PrimaryCta
            label="Worlds"
            variant="secondary"
            onPress={onWorlds}
            onPressIn={handlePressIn}
            disabled={loading}
            style={styles.worldsCta}
          />
          <View style={styles.reward}>
            <Text style={styles.rewardText}>PICTURES RESTORED {cleared}/{TOTAL_LEVELS}</Text>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: material.background },
  safe: { flex: 1 },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
  },
  controls: {
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  worldsCta: { width: 236 },
  reward: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  rewardText: {
    color: material.textSecondary,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '600',
  },
});
