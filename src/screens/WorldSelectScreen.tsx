import { FlatList, StyleSheet, Text, View } from 'react-native';
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

interface WorldSelectScreenProps {
  summaries: WorldSummary[];
  loading: boolean;
  onSelectWorld: (worldId: string) => void;
  onBack: () => void;
}

/**
 * PIXEL ARCADIA campaign map (UI-R5) — ten destination cards, not a plain
 * list of rows. Home → here → a selected world's level path → the level
 * itself. `IconButton` (back button) keeps its current shared style — see
 * `docs/DESIGN.md` for the deferred global icon-system migration this and
 * Home/Gameplay all share.
 */
export function WorldSelectScreen({ summaries, loading, onSelectWorld, onBack }: WorldSelectScreenProps) {
  const reducedMotion = useReducedMotion();
  const active = useAmbientActive();

  if (loading) {
    return (
      <View style={styles.root}>
        <BrandLoader fill label="LOADING" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CampaignBackdrop />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <IconButton glyph="←" onPress={onBack} accessibilityLabel="Back to Home" />
          <Text style={styles.headerTitle}>WORLDS</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={summaries}
          keyExtractor={(s) => s.world.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <Animated.View
              entering={
                reducedMotion ? undefined : FadeInDown.duration(240).delay(Math.min(index, 6) * 40)
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
  headerTitle: { ...typography.label, color: material.textSecondary, fontSize: 13, letterSpacing: 4 },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
});
