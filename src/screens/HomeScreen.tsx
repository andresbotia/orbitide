import { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';

import { PlayButton } from '@/components/PlayButton';
import { FloatingFragments } from '@/components/home/FloatingFragments';
import { HomeCenterpiece } from '@/components/home/HomeCenterpiece';
import { LevelBadge } from '@/components/home/LevelBadge';
import { StarfieldBackdrop } from '@/components/home/StarfieldBackdrop';
import { TopUtility } from '@/components/home/TopUtility';
import { getLevel, requireLevel, TOTAL_LEVELS } from '@/game/levels/levels';
import { ambientChargeSpecs, computeHomeLayout, homeLevelPreview } from '@/game/rendering/homeGeometry';
import { useAmbientActive } from '@/hooks/useAmbientActive';
import { feedback } from '@/game/feedback';
import { arcade } from '@/theme/arcade';
import { palette } from '@/theme/colors';
import { spacing, typography } from '@/theme/spacing';

interface HomeScreenProps {
  highestUnlockedLevel: number;
  loading: boolean;
  onPlay: () => void;
  /** Dev-only: hidden long-press affordance on the wordmark. */
  onSecretReset?: () => void;
}

/** Home → Gameplay transition budget (activation response + nav). */
const TRANSITION_MS = 300;

export function HomeScreen({ highestUnlockedLevel, loading, onPlay, onSecretReset }: HomeScreenProps) {
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
    activation.set(withTiming(1, { duration: 160 }));
    setTimeout(onPlay, TRANSITION_MS);
  }, [activation, onPlay]);

  const cleared = Math.max(0, Math.min(TOTAL_LEVELS, highestUnlockedLevel - 1));

  return (
    <View style={styles.root}>
      <StarfieldBackdrop
        width={window.width}
        height={window.height}
        layout={layout}
        active={active}
        reducedMotion={reducedMotion}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <TopUtility />

        <View style={styles.hero} onLayout={onBandLayout}>
          <Text
            style={styles.wordmark}
            onLongPress={__DEV__ ? onSecretReset : undefined}
            suppressHighlighting
          >
            ORBITIDE
          </Text>

          {band.width > 0 ? (
            <>
              <HomeCenterpiece
                layout={layout}
                preview={preview}
                specs={specs}
                active={active}
                reducedMotion={reducedMotion}
                activation={activation}
              />
              {layout.showForeground ? (
                <FloatingFragments layout={layout} active={active} reducedMotion={reducedMotion} />
              ) : null}
            </>
          ) : null}
        </View>

        <View style={styles.controls}>
          <LevelBadge levelId={level.id} difficulty={level.difficulty} />
          <PlayButton onPress={handlePlay} onPressIn={handlePressIn} disabled={loading} />
          <View style={styles.reward}>
            <Text style={styles.rewardText}>PICTURES RESTORED {cleared}/{TOTAL_LEVELS}</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: arcade.envBottom },
  safe: { flex: 1 },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    position: 'absolute',
    top: spacing.md,
    ...typography.wordmark,
    fontSize: 30,
    letterSpacing: 8,
    color: palette.textSecondary,
    opacity: 0.9,
  },
  controls: {
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  reward: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  rewardText: {
    color: arcade.metalEdge,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '600',
  },
});
