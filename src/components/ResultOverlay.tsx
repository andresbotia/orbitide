import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { PrimaryCta } from '@/components/brand';
import { material } from '@/theme/material';
import { NEON, neonAlpha } from '@/theme/neon';
import { radius, spacing, typography } from '@/theme/spacing';

export type FailureReason = 'holdingFull' | 'noMoves';

/**
 * TUNABLE — presentation beat between the presented loss (board dim begins)
 * and the LEVEL FAILED card. A UI-thread entering delay, not a JS timer.
 */
export const RESULT_BEAT_MS = 300;

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
 * Polished in-place fail treatment (UI-R6 — Pixel Arcadia material,
 * accurate reason copy). Deliberately minimal so the player can press Try
 * Again almost immediately (no punitive delay, no shaming language).
 */
export const ResultOverlay = memo(function ResultOverlay({ visible, reason = 'holdingFull', onRetry, onHome }: ResultOverlayProps) {
  if (!visible) return null;
  const copy = COPY[reason];

  return (
    <Animated.View
      entering={FadeIn.duration(200).delay(RESULT_BEAT_MS)}
      style={styles.backdrop}
      pointerEvents="auto"
    >
      <Animated.View 
        entering={ZoomIn.delay(RESULT_BEAT_MS).springify().damping(16).mass(0.9).stiffness(120)} 
        style={styles.card}
      >
        <View style={styles.palIcon}>
          <View style={styles.visor}>
            <Text style={styles.eyes}>×</Text>
            <View style={styles.eyeGap} />
            <Text style={styles.eyes}>×</Text>
          </View>
        </View>

        <Text style={styles.levelFailed}>LEVEL FAILED</Text>
        
        <View style={styles.messageBox}>
          <Text style={styles.reasonHeading}>{copy.heading}</Text>
          <Text style={styles.reasonSub}>{copy.sub}</Text>
        </View>

        <PrimaryCta label="Try Again" onPress={onRetry} fullWidth style={styles.cta} />

        <Pressable onPress={onHome} hitSlop={10} accessibilityRole="button">
          <Text style={styles.secondary}>Home</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
});

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
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: NEON.inkDeep,
    borderWidth: 1,
    borderColor: neonAlpha(NEON.cyan, 0.25),
    width: '100%',
    maxWidth: 340,
    zIndex: 101,
    elevation: 101,
  },
  palIcon: {
    width: 44,
    height: 44,
    backgroundColor: material.danger,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderTopWidth: 2,
    borderTopColor: '#FF7B8A',
    borderBottomWidth: 3,
    borderBottomColor: '#B82030',
  },
  visor: {
    width: 28,
    height: 14,
    backgroundColor: '#090A1E',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeGap: {
    width: 6,
  },
  eyes: {
    color: material.danger,
    fontSize: 12,
    fontWeight: '900',
    marginTop: -2,
  },
  levelFailed: {
    ...typography.display,
    color: material.danger,
    fontSize: 28,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  messageBox: {
    backgroundColor: neonAlpha(NEON.ink, 0.6),
    padding: spacing.md,
    borderRadius: radius.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  reasonHeading: {
    ...typography.title,
    fontSize: 16,
    color: material.textPrimary,
    marginBottom: spacing.xs,
    letterSpacing: 1,
  },
  reasonSub: {
    color: material.textSecondary,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  cta: {
    marginBottom: spacing.lg,
  },
  secondary: {
    color: material.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
