import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { BrandLoader } from '@/components/brand';
import { IconButton } from '@/components/IconButton';
import { LevelNode } from '@/components/campaign/LevelNode';
import type { CampaignWorld } from '@/game/studio/campaign/types';
import { levelSlotState } from '@/game/levels/campaignProgress';
import type { Progress } from '@/storage/progress';
import { feedback } from '@/game/feedback';
import { arcade } from '@/theme/arcade';
import { palette } from '@/theme/colors';
import { radius, spacing, typography } from '@/theme/spacing';

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
  const reducedMotion = useReducedMotion();
  const accent = world.display?.accent ?? arcade.accent;
  const subtitle = world.display?.subtitle ?? 'Explore the sector';
  const totalLevels = world.levelIds.length;
  const clearedCount = world.levelIds.filter(
    (id) => levelSlotState(progress, id) === 'complete',
  ).length;

  if (loading) {
    return (
      <View style={styles.root}>
        <BrandLoader fill label="LOADING" />
      </View>
    );
  }

  const usableWidth = width - spacing.md * 4;
  const nodeSize = Math.round(
    Math.min(62, Math.max(48, (usableWidth - GRID_GAP * (COLUMNS - 1)) / COLUMNS)),
  );
  const gridWidth = nodeSize * COLUMNS + GRID_GAP * (COLUMNS - 1);
  const allCleared = clearedCount === totalLevels;

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
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(220)}
            style={[styles.deck, { width: gridWidth + spacing.md * 2 }]}
          >
            <View style={styles.progressRow}>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${totalLevels > 0 ? Math.round((clearedCount / totalLevels) * 100) : 0}%`,
                      backgroundColor: accent,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {clearedCount}/{totalLevels} RESTORED
              </Text>
            </View>

            <View style={[styles.grid, { width: gridWidth, gap: GRID_GAP }]}>
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
            </View>

            <Text style={styles.footerNote}>
              {allCleared
                ? 'SECTOR COMPLETED'
                : `${totalLevels - clearedCount} ${totalLevels - clearedCount === 1 ? 'LEVEL' : 'LEVELS'} REMAINING`}
            </Text>
          </Animated.View>
        </View>
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
    paddingBottom: spacing.sm,
  },
  headerText: { alignItems: 'center', gap: 3 },
  eyebrow: { ...typography.label, color: arcade.metalEdge, fontSize: 11 },
  title: { ...typography.title, fontSize: 18 },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  deck: {
    backgroundColor: arcade.metal,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderTopColor: arcade.metalHi,
    borderLeftColor: arcade.metalHi,
    borderRightColor: arcade.metalLo,
    borderBottomColor: arcade.metalLo,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  progressRow: {
    alignItems: 'center',
    gap: spacing.xs,
    width: '100%',
  },
  track: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: arcade.socket,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  progressText: {
    color: arcade.metalEdge,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  footerNote: {
    color: arcade.metalEdge,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: '600',
  },
});
