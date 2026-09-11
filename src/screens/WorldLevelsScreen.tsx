import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BrandLoader } from '@/components/brand';
import { IconButton } from '@/components/IconButton';
import { LevelNode } from '@/components/campaign/LevelNode';
import type { CampaignWorld } from '@/game/studio/campaign/types';
import { levelSlotState } from '@/game/levels/campaignProgress';
import type { Progress } from '@/storage/progress';
import { feedback } from '@/game/feedback';
import { arcade } from '@/theme/arcade';
import { spacing, typography } from '@/theme/spacing';

interface WorldLevelsScreenProps {
  world: CampaignWorld;
  displayIndex: number;
  progress: Progress;
  loading: boolean;
  onSelectLevel: (levelId: number) => void;
  onBack: () => void;
}

const COLUMNS = 5;
const GRID_GAP = spacing.sm;

/** A single world's level grid: locked / current / complete nodes, tap to play. */
export function WorldLevelsScreen({
  world,
  displayIndex,
  progress,
  loading,
  onSelectLevel,
  onBack,
}: WorldLevelsScreenProps) {
  const { width } = useWindowDimensions();
  const accent = world.display?.accent ?? arcade.accent;

  if (loading) {
    return (
      <View style={styles.root}>
        <BrandLoader fill label="LOADING" />
      </View>
    );
  }

  const usableWidth = width - spacing.md * 2;
  const nodeSize = Math.round(
    Math.min(72, Math.max(52, (usableWidth - GRID_GAP * (COLUMNS - 1)) / COLUMNS)),
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[arcade.envTop, arcade.envMid, arcade.envBottom]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <IconButton glyph="←" onPress={onBack} accessibilityLabel="Back to Worlds" />
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>WORLD {String(displayIndex).padStart(2, '0')}</Text>
            <Text style={[styles.title, { color: accent }]} numberOfLines={1}>
              {world.title.toUpperCase()}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <Animated.View entering={FadeInDown.duration(220)} style={[styles.grid, { gap: GRID_GAP }]}>
          {world.levelIds.map((levelId, i) => (
            <LevelNode
              key={levelId}
              levelId={levelId}
              positionInWorld={i + 1}
              state={levelSlotState(progress, levelId)}
              accent={accent}
              size={nodeSize}
              onPress={() => {
                feedback.emit('select');
                onSelectLevel(levelId);
              }}
            />
          ))}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: arcade.envBottom },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerText: { alignItems: 'center', gap: 2 },
  eyebrow: { ...typography.label, color: arcade.metalEdge, fontSize: 11 },
  title: { ...typography.title, fontSize: 18 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
});
