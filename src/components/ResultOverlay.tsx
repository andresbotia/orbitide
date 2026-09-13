import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { PrimaryCta } from '@/components/brand';
import { material } from '@/theme/material';
import { radius, spacing, typography } from '@/theme/spacing';

export type FailureReason = 'holdingFull' | 'noMoves';

interface ResultOverlayProps {
  /** Win is owned by DiscoveryOverlay/DiscoveryReveal — this handles fail only. */
  visible: boolean;
  /** Which of the two loss conditions actually happened — read from existing
   * public state, not a new engine concept — so the message is accurate
   * instead of always assuming "Holding full." */
  reason?: FailureReason;
  onRetry: () => void;
  onHome: () => void;
}

const COPY: Record<FailureReason, { heading: string; sub: string }> = {
  holdingFull: { heading: 'HOLDING FULL', sub: 'The tray is jammed and nothing can resolve.' },
  noMoves: { heading: 'NO MOVES LEFT', sub: 'No launch can clear a pixel from here.' },
};

/**
 * Lightweight in-place fail treatment (UI-R6 — Pixel Arcadia material,
 * accurate reason copy). Deliberately minimal so the player can press Try
 * Again almost immediately (no punitive delay, no shaming language).
 */
export function ResultOverlay({ visible, reason = 'holdingFull', onRetry, onHome }: ResultOverlayProps) {
  if (!visible) return null;
  const copy = COPY[reason];

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      style={styles.backdrop}
      pointerEvents="auto"
    >
      <Animated.View entering={FadeInDown.duration(220)} style={styles.card}>
        <Text style={styles.heading}>{copy.heading}</Text>
        <Text style={styles.sub}>{copy.sub}</Text>

        <PrimaryCta label="Try Again" onPress={onRetry} fullWidth style={styles.cta} />

        <Pressable onPress={onHome} hitSlop={10} accessibilityRole="button">
          <Text style={styles.secondary}>Home</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: material.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    zIndex: 100,
    elevation: 100,
  },
  card: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: material.structuralSurface,
    borderWidth: 1,
    borderTopColor: material.bevelHighlight,
    borderLeftColor: material.bevelHighlight,
    borderRightColor: material.bevelShadow,
    borderBottomColor: material.bevelShadow,
    width: '100%',
    maxWidth: 340,
    zIndex: 101,
    elevation: 101,
  },
  heading: { ...typography.title, fontSize: 22, color: material.textPrimary },
  sub: {
    color: material.textSecondary,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  cta: { marginTop: spacing.sm },
  secondary: {
    color: material.textSecondary,
    fontSize: 13,
    letterSpacing: 1,
    paddingTop: spacing.xs,
  },
});
