import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { BrandLoader } from '@/components/brand';
import { CampaignBackdrop } from '@/components/campaign/CampaignBackdrop';
import { IconButton } from '@/components/IconButton';
import { LevelNode } from '@/components/campaign/LevelNode';
import type { CampaignWorld } from '@/game/studio/campaign/types';
import { levelSlotState } from '@/game/levels/campaignProgress';
import type { Progress } from '@/storage/progress';
import { feedback } from '@/game/feedback';
import { material } from '@/theme/material';
import { spacing, typography } from '@/theme/spacing';
import { worldSkin } from '@/theme/worldSkins';

interface WorldLevelsScreenProps {
  world: CampaignWorld;
  displayIndex: number;
  progress: Progress;
  loading: boolean;
  onSelectLevel: (levelId: number) => void;
  onBack: () => void;
}

const NODE_SIZE = 60;
const CAPSTONE_SIZE = 84;
const V_STEP = 100;
/** A hand-tuned S-curve, 10 entries (one per level) — starts and ends
 * centered so the capstone always sits grounded on the path's centerline. */
const OFFSET_PATTERN = [0, 0.6, 0.95, 0.6, 0, -0.6, -0.95, -0.6, 0, 0];

/**
 * A single world's level path (UI-R5 — replaces the flat 5-column grid with
 * a winding vertical journey; a plain scroll, no gestures required to find
 * the next level). Preserves level ordering, tap targets, and lock/current/
 * complete semantics exactly — `levelSlotState` is untouched.
 */
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
  const skin = worldSkin(world.themeId);
  const accent = world.display?.accent ?? skin.accent;
  const subtitle = world.display?.subtitle ?? 'Explore the sector';
  const totalLevels = world.levelIds.length;
  const clearedCount = world.levelIds.filter(
    (id) => levelSlotState(progress, id) === 'complete',
  ).length;
  const isFinaleWorld = displayIndex === 10;

  const scrollRef = useRef<ScrollView>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const onViewportLayout = useCallback((e: LayoutChangeEvent) => {
    setViewportHeight(e.nativeEvent.layout.height);
  }, []);

  const amplitude = Math.min(width * 0.24, 80);
  const pathWidth = amplitude * 2 + CAPSTONE_SIZE;
  const centerX = pathWidth / 2;

  const nodes = useMemo(() => world.levelIds.map((levelId, i) => {
    const isCapstone = i === totalLevels - 1;
    const size = isCapstone ? CAPSTONE_SIZE : NODE_SIZE;
    const cx = centerX + OFFSET_PATTERN[i % OFFSET_PATTERN.length]! * amplitude;
    const cy = V_STEP * i + size / 2 + spacing.md;
    return { levelId, i, isCapstone, isFinale: isCapstone && isFinaleWorld, size, cx, cy };
  }), [world.levelIds, totalLevels, centerX, amplitude, isFinaleWorld]);

  const pathHeight = (nodes[nodes.length - 1]?.cy ?? 0) + CAPSTONE_SIZE / 2 + spacing.xl;
  const currentIndex = nodes.findIndex((n) => levelSlotState(progress, n.levelId) === 'current');

  useEffect(() => {
    if (currentIndex < 0 || viewportHeight <= 0) return;
    const target = nodes[currentIndex]!.cy - viewportHeight / 2;
    scrollRef.current?.scrollTo({ y: Math.max(0, target), animated: !reducedMotion });
    // Intentionally runs once viewport/current level are known, not on every progress tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex >= 0, viewportHeight]);

  if (loading) {
    return (
      <View style={styles.root}>
        <BrandLoader fill label="LOADING" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CampaignBackdrop worldAccent={accent} />
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

        <View style={styles.progressRow}>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${totalLevels > 0 ? Math.round((clearedCount / totalLevels) * 100) : 0}%`, backgroundColor: accent },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{clearedCount}/{totalLevels} RESTORED</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ width: pathWidth, height: pathHeight, alignSelf: 'center' }}
          showsVerticalScrollIndicator={false}
          onLayout={onViewportLayout}
          ref={scrollRef}
        >
          {/* Path connectors — lit up to how far the player has actually progressed. */}
          {nodes.slice(0, -1).map((node, i) => {
            const next = nodes[i + 1]!;
            const dx = next.cx - node.cx;
            const dy = next.cy - node.cy;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            const midX = (node.cx + next.cx) / 2;
            const midY = (node.cy + next.cy) / 2;
            const cleared = levelSlotState(progress, node.levelId) === 'complete';
            return (
              <View
                key={`link-${node.levelId}`}
                pointerEvents="none"
                style={[
                  styles.link,
                  {
                    left: midX - length / 2,
                    top: midY - 1.5,
                    width: length,
                    backgroundColor: cleared ? accent : material.outline,
                    opacity: cleared ? 0.6 : 0.5,
                    transform: [{ rotate: `${angle}rad` }],
                  },
                ]}
              />
            );
          })}

          {nodes.map((node, i) => (
            <Animated.View
              key={node.levelId}
              entering={reducedMotion ? undefined : FadeIn.duration(220).delay(Math.min(i, 8) * 30)}
              style={{ position: 'absolute', left: node.cx - node.size / 2, top: node.cy - node.size / 2 }}
            >
              <LevelNode
                levelId={node.levelId}
                positionInWorld={i + 1}
                state={levelSlotState(progress, node.levelId)}
                accent={accent}
                size={node.size}
                isCapstone={node.isCapstone}
                isFinale={node.isFinale}
                onPress={() => {
                  feedback.emit('select');
                  onSelectLevel(node.levelId);
                }}
              />
            </Animated.View>
          ))}
        </ScrollView>

        {clearedCount === totalLevels ? (
          <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(220)}>
            <Text style={styles.footerNote}>SECTOR COMPLETED</Text>
          </Animated.View>
        ) : null}
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
    paddingBottom: spacing.xs,
  },
  headerText: { alignItems: 'center', gap: 3 },
  eyebrow: { ...typography.label, color: material.textSecondary, fontSize: 11 },
  title: { ...typography.display, fontSize: 20 },
  subtitle: {
    color: material.textSecondary,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: material.recessedSurface, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  progressText: { fontSize: 10, color: material.textSecondary, letterSpacing: 1, fontWeight: '700' },
  scroll: { flex: 1 },
  link: {
    position: 'absolute',
    height: 3,
    borderRadius: 1.5,
  },
  footerNote: {
    textAlign: 'center',
    paddingVertical: spacing.sm,
    color: material.textSecondary,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '600',
  },
});
