import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { WorldSummary } from '@/game/levels/campaignProgress';
import { material } from '@/theme/material';
import { radius, spacing, typography } from '@/theme/spacing';
import { worldSkin } from '@/theme/worldSkins';
import { WorldMotif } from './WorldMotif';

interface WorldCardProps {
  summary: WorldSummary;
  onPress: () => void;
}

/**
 * World destination card (UI-R5 — replaces the old "one row per world" list
 * item, which deliberately suppressed per-world identity). Each world now
 * carries its own static motif (`WorldMotif`, from `worldSkin(themeId)`) and
 * accent, while housing materials, typography, and bevel language stay
 * global Pixel Arcadia chrome — worlds differ in identity, not in system.
 */
export function WorldCard({ summary, onPress }: WorldCardProps) {
  const { world, displayIndex, completedCount, totalCount, state } = summary;
  const skin = worldSkin(world.themeId);
  const accent = world.display?.accent ?? skin.accent;
  const locked = state === 'locked';
  const current = state === 'active';
  const complete = state === 'complete';
  const isFinale = displayIndex === 10;
  const progress = totalCount === 0 ? 0 : completedCount / totalCount;
  const reducedMotion = useReducedMotion();

  const breathe = useSharedValue(0.4);
  useEffect(() => {
    cancelAnimation(breathe);
    if (!current || reducedMotion) { breathe.set(0.4); return; }
    breathe.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(breathe);
  }, [current, reducedMotion, breathe]);
  const edgeStyle = useAnimatedStyle(() => ({ opacity: current ? 0.35 + breathe.value * 0.4 : 0 }));

  const a11yLabel = locked
    ? `World ${displayIndex}, ${world.title}, locked`
    : complete
      ? `World ${displayIndex}, ${world.title}, complete`
      : `World ${displayIndex}, ${world.title}, ${completedCount} of ${totalCount} levels complete`;

  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled: locked, selected: current }}
      style={({ pressed }) => [
        styles.card,
        locked && styles.cardLocked,
        pressed && !locked && styles.cardPressed,
        isFinale && !locked && styles.cardFinale,
      ]}
    >
      {/* Current-world breathing accent edge — never on locked/complete. */}
      <Animated.View pointerEvents="none" style={[styles.edge, { borderColor: accent }, edgeStyle]} />

      <View style={styles.motifStrip}>
        <WorldMotif ambientId={skin.ambientId} accent={accent} secondaryAccent={skin.secondaryAccent} muted={locked} style={StyleSheet.absoluteFill} />
        {isFinale && !locked ? <View pointerEvents="none" style={styles.finaleWash} /> : null}
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={[styles.badge, { borderColor: locked ? material.outline : accent }]}>
            <Text style={[styles.badgeNumber, { color: locked ? material.textSecondary : accent }]}>
              {String(displayIndex).padStart(2, '0')}
            </Text>
          </View>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, locked && styles.textMuted]} numberOfLines={1}>
              {world.title.toUpperCase()}
            </Text>
            {world.display?.subtitle ? (
              <Text style={[styles.subtitle, locked && styles.textMuted]} numberOfLines={1}>
                {world.display.subtitle}
              </Text>
            ) : null}
          </View>
          <StateGlyph locked={locked} complete={complete} current={current} accent={accent} />
        </View>

        {locked ? (
          <Text style={styles.lockedLabel}>LOCKED</Text>
        ) : (
          <View style={styles.progressRow}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: accent }]} />
            </View>
            <Text style={styles.progressText}>{completedCount}/{totalCount}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function StateGlyph({ locked, complete, current, accent }: { locked: boolean; complete: boolean; current: boolean; accent: string }) {
  if (locked) {
    // A plain geometric lock (two stacked rects), not an emoji — consistent
    // with the app's existing Unicode-glyph icon language elsewhere.
    return (
      <View style={styles.lockGlyph} accessibilityElementsHidden>
        <View style={styles.lockShackle} />
        <View style={styles.lockBody} />
      </View>
    );
  }
  if (complete) {
    return <Text style={[styles.glyph, { color: accent }]} accessibilityElementsHidden>✓</Text>;
  }
  if (current) {
    return (
      <View style={[styles.continuePill, { borderColor: accent }]}>
        <Text style={[styles.continueText, { color: accent }]}>CONTINUE</Text>
      </View>
    );
  }
  return null;
}

const MOTIF_HEIGHT = 64;

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderTopColor: material.bevelHighlight,
    borderLeftColor: material.bevelHighlight,
    borderRightColor: material.bevelShadow,
    borderBottomColor: material.bevelShadow,
    backgroundColor: material.structuralSurface,
    overflow: 'hidden',
  },
  cardLocked: { opacity: 0.62 },
  cardPressed: { transform: [{ translateY: 1 }], backgroundColor: material.raisedSurface },
  cardFinale: {
    borderTopColor: material.energyGlow,
    borderLeftColor: material.energyGlow,
    shadowColor: material.energyWarm,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  edge: {
    position: 'absolute',
    top: -1, left: -1, right: -1, bottom: -1,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  motifStrip: {
    height: MOTIF_HEIGHT,
    backgroundColor: material.recessedSurface,
    overflow: 'hidden',
  },
  finaleWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: material.energyGlow,
    opacity: 0.08,
  },
  body: { padding: spacing.md, gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: material.recessedSurface,
  },
  badgeNumber: { ...typography.numeric, fontSize: 15, letterSpacing: 0.5 },
  titleBlock: { flex: 1, gap: 2 },
  title: { ...typography.display, fontSize: 18, color: material.textPrimary },
  subtitle: { fontSize: 12, color: material.textSecondary },
  textMuted: { opacity: 0.75 },
  glyph: { fontSize: 18, color: material.textSecondary },
  lockGlyph: { width: 16, height: 19, alignItems: 'center' },
  lockShackle: {
    width: 10,
    height: 7,
    borderWidth: 2,
    borderColor: material.textSecondary,
    borderBottomWidth: 0,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  lockBody: {
    width: 16,
    height: 11,
    borderRadius: 3,
    backgroundColor: material.textSecondary,
    marginTop: -1,
  },
  continuePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  continueText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  lockedLabel: { fontSize: 10, letterSpacing: 2, fontWeight: '700', color: material.textSecondary },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: material.recessedSurface, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  progressText: { fontSize: 10, color: material.textSecondary, letterSpacing: 1 },
});
