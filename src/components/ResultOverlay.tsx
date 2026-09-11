import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { PrimaryCta } from '@/components/brand';
import { brandColor } from '@/theme/brand';
import { radius, spacing, typography } from '@/theme/spacing';

interface ResultOverlayProps {
  /** Win is owned by DiscoveryOverlay/DiscoveryReveal — this handles fail only. */
  visible: boolean;
  onRetry: () => void;
  onHome: () => void;
}

/**
 * Lightweight in-place fail treatment. Deliberately minimal so the player can
 * press Try Again almost immediately (no punitive delay).
 */
export function ResultOverlay({ visible, onRetry, onHome }: ResultOverlayProps) {
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      style={styles.backdrop}
      pointerEvents="auto"
    >
      <Animated.View entering={FadeInDown.duration(220)} style={styles.card}>
        <Text style={styles.heading}>HOLDING FULL</Text>
        <Text style={styles.sub}>The tray is jammed and nothing can resolve.</Text>

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
    backgroundColor: 'rgba(5,6,10,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: brandColor.surface,
    borderWidth: 1,
    borderColor: brandColor.border,
    width: '100%',
    maxWidth: 340,
  },
  heading: { ...typography.title, fontSize: 22, color: brandColor.textPrimary },
  sub: {
    color: brandColor.textSecondary,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  cta: { marginTop: spacing.sm },
  secondary: {
    color: brandColor.textSecondary,
    fontSize: 13,
    letterSpacing: 1,
    paddingTop: spacing.xs,
  },
});
