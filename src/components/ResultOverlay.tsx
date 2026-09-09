import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import type { GameStatus } from '@/game/engine/types';
import { PrimaryCta } from '@/components/brand';
import { brandColor } from '@/theme/brand';
import { palette } from '@/theme/colors';
import { radius, spacing, typography } from '@/theme/spacing';

interface ResultOverlayProps {
  status: GameStatus;
  hasNextLevel: boolean;
  onNext: () => void;
  onRetry: () => void;
  onHome: () => void;
}

/**
 * Lightweight in-place win/fail treatment. Deliberately minimal so the player
 * can press Next / Try Again almost immediately.
 */
export function ResultOverlay({
  status,
  hasNextLevel,
  onNext,
  onRetry,
  onHome,
}: ResultOverlayProps) {
  if (status === 'playing') return null;
  const won = status === 'won';

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      style={styles.backdrop}
      pointerEvents="auto"
    >
      <Animated.View entering={FadeInDown.duration(220)} style={styles.card}>
        <Text style={[styles.heading, won ? styles.win : styles.lose]}>
          {won ? 'PICTURE CLEAR' : 'HOLDING FULL'}
        </Text>
        <Text style={styles.sub}>
          {won
            ? hasNextLevel
              ? 'Level complete.'
              : 'Milestone 1 cleared — every picture restored.'
            : 'The tray is jammed and nothing can resolve.'}
        </Text>

        {won ? (
          <PrimaryCta
            label={hasNextLevel ? 'Next Level' : 'Back to Home'}
            onPress={hasNextLevel ? onNext : onHome}
            fullWidth
            style={styles.cta}
          />
        ) : (
          <PrimaryCta label="Try Again" onPress={onRetry} fullWidth style={styles.cta} />
        )}

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
  heading: { ...typography.title, fontSize: 22 },
  win: { color: palette.success },
  lose: { color: palette.danger },
  sub: {
    color: palette.textSecondary,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  cta: { marginTop: spacing.sm },
  secondary: {
    color: palette.textFaint,
    fontSize: 13,
    letterSpacing: 1,
    paddingTop: spacing.xs,
  },
});
