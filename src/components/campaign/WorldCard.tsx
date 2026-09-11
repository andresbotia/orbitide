import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { WorldSummary } from '@/game/levels/campaignProgress';
import { arcade } from '@/theme/arcade';
import { radius, spacing, typography } from '@/theme/spacing';

interface WorldCardProps {
  summary: WorldSummary;
  onPress: () => void;
}

/**
 * One row in the world-select list (DESIGN.md-consistent: metal housing,
 * arcade socket badge, world-accent identity colour reserved for the badge +
 * progress fill only — the card body stays neutral metal so ten worlds read
 * as one design system, not ten competing themes).
 */
export function WorldCard({ summary, onPress }: WorldCardProps) {
  const { world, displayIndex, completedCount, totalCount, state } = summary;
  const accent = world.display?.accent ?? arcade.accent;
  const locked = state === 'locked';
  const progress = totalCount === 0 ? 0 : completedCount / totalCount;

  const a11yLabel = locked
    ? `World ${displayIndex}, ${world.title}, locked`
    : state === 'complete'
      ? `World ${displayIndex}, ${world.title}, complete`
      : `World ${displayIndex}, ${world.title}, ${completedCount} of ${totalCount} levels complete`;

  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled: locked }}
      style={({ pressed }) => [
        styles.card,
        locked && styles.cardLocked,
        pressed && !locked && styles.cardPressed,
      ]}
    >
      <View style={[styles.badge, { borderColor: locked ? arcade.socketRim : accent }]}>
        <Text style={[styles.badgeNumber, { color: locked ? arcade.metalEdge : accent }]}>
          {String(displayIndex).padStart(2, '0')}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, locked && styles.textLocked]} numberOfLines={1}>
          {world.title.toUpperCase()}
        </Text>
        {world.display?.subtitle ? (
          <Text style={[styles.subtitle, locked && styles.textLocked]} numberOfLines={1}>
            {world.display.subtitle}
          </Text>
        ) : null}

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

      {!locked ? <Text style={styles.chevron}>›</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderTopColor: arcade.metalHi,
    borderLeftColor: arcade.metalHi,
    borderRightColor: arcade.metalLo,
    borderBottomColor: arcade.metalLo,
    backgroundColor: arcade.metal,
  },
  cardLocked: { opacity: 0.5 },
  cardPressed: { transform: [{ translateY: 1 }], backgroundColor: arcade.metalLo },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: arcade.socket,
  },
  badgeNumber: { ...typography.numeric, fontSize: 16, letterSpacing: 0.5 },
  body: { flex: 1, gap: 3 },
  title: { ...typography.label, fontSize: 14, color: arcade.metalEdge, letterSpacing: 1.5 },
  subtitle: { fontSize: 12, color: arcade.metalEdge, opacity: 0.75 },
  textLocked: { opacity: 0.7 },
  lockedLabel: { fontSize: 10, letterSpacing: 2, fontWeight: '700', color: arcade.metalEdge, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: arcade.socket, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  progressText: { fontSize: 10, color: arcade.metalEdge, letterSpacing: 1 },
  chevron: { color: arcade.metalEdge, fontSize: 22, fontWeight: '700' },
});
