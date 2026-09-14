import { useCallback, useMemo, useState } from 'react';
import {
  FlatList, StyleSheet, Text, View, useWindowDimensions, type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { BrandLoader } from '@/components/brand';
import { CampaignBackdrop } from '@/components/campaign/CampaignBackdrop';
import { IconButton } from '@/components/IconButton';
import { WorldCard } from '@/components/campaign/WorldCard';
import type { WorldSummary } from '@/game/levels/campaignProgress';
import { feedback } from '@/game/feedback';
import { useAmbientActive } from '@/hooks/useAmbientActive';
import { material } from '@/theme/material';
import { spacing, typography } from '@/theme/spacing';
import { worldSkin } from '@/theme/worldSkins';

interface WorldSelectScreenProps {
  summaries: WorldSummary[];
  loading: boolean;
  onSelectWorld: (worldId: string) => void;
  onBack: () => void;
}

const SIDE_GAP = spacing.md;

/**
 * PIXEL ARCADIA campaign map (UI-R5, recomposed north-star phase 2) — a
 * horizontal destination CAROUSEL, not a stacked vertical list of flat
 * cards. Ten worlds became a browsing experience: one destination fills the
 * screen at a time, its own environmental artwork gets the space to actually
 * read (`WorldCard`'s `MOTIF_HEIGHT` grew accordingly), and the backdrop's
 * accent wash live-updates to whichever world is centered — the "world
 * accent color entering the next view" cue the north-star brief asked for,
 * paid for with one cheap `onViewableItemsChanged` callback (not a
 * per-frame scroll listener). Navigation contract (`onSelectWorld`/
 * `onBack`) and `WorldSummary` data are unchanged.
 */
export function WorldSelectScreen({ summaries, loading, onSelectWorld, onBack }: WorldSelectScreenProps) {
  const reducedMotion = useReducedMotion();
  const active = useAmbientActive();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(360, width - SIDE_GAP * 2 - 32);
  const snapInterval = cardWidth + SIDE_GAP;

  const [pageIndex, setPageIndex] = useState(0);
  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 60 }), []);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0]?.index;
    if (first != null) setPageIndex(first);
  }, []);

  if (loading) {
    return (
      <View style={styles.root}>
        <BrandLoader fill label="LOADING" />
      </View>
    );
  }

  const activeAccent = worldSkin(summaries[pageIndex]?.world.themeId).accent;

  return (
    <View style={styles.root}>
      <CampaignBackdrop worldAccent={activeAccent} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <IconButton glyph="←" onPress={onBack} accessibilityLabel="Back to Home" />
          <Text style={styles.headerTitle}>WORLDS</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={summaries}
          keyExtractor={(s) => s.world.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={snapInterval}
          decelerationRate="fast"
          contentContainerStyle={[styles.list, { paddingHorizontal: (width - cardWidth) / 2 }]}
          ItemSeparatorComponent={() => <View style={{ width: SIDE_GAP }} />}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          renderItem={({ item, index }) => (
            <Animated.View
              style={{ width: cardWidth }}
              entering={
                reducedMotion ? undefined : FadeInDown.duration(260).delay(Math.min(index, 6) * 45)
              }
            >
              <WorldCard
                summary={item}
                active={active}
                onPress={() => {
                  feedback.emit('select');
                  onSelectWorld(item.world.id);
                }}
              />
            </Animated.View>
          )}
        />

        {/* Page dots — the carousel's "which destination am I at" readout. */}
        <View style={styles.dots} accessibilityElementsHidden>
          {summaries.map((s, i) => (
            <View
              key={s.world.id}
              style={[styles.dot, i === pageIndex && [styles.dotActive, { backgroundColor: activeAccent }]]}
            />
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: material.background },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: { ...typography.label, color: material.textSecondary, fontSize: 13, letterSpacing: 3 },
  list: { alignItems: 'center', paddingVertical: spacing.sm },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, paddingVertical: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: material.outline },
  dotActive: { width: 18 },
});
