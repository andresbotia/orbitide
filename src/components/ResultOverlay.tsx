import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import type { GameStatus } from '@/game/engine/types';
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
          {won ? 'LEVEL COMPLETE' : 'TRAY OVERFLOW'}
        </Text>
        <Text style={styles.sub}>
          {won
            ? hasNextLevel
              ? 'The Core is aligned.'
              : 'Milestone 1 cleared — every handcrafted level solved.'
            : 'No room to hold, no match to make.'}
        </Text>

        {won ? (
          <Pressable
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            onPress={hasNextLevel ? onNext : onHome}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>
              {hasNextLevel ? 'NEXT LEVEL' : 'BACK TO HOME'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            onPress={onRetry}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>TRY AGAIN</Text>
          </Pressable>
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
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
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
  primary: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
    backgroundColor: palette.core,
  },
  pressed: { opacity: 0.7 },
  primaryText: {
    ...typography.label,
    color: palette.void,
    fontSize: 14,
  },
  secondary: {
    color: palette.textFaint,
    fontSize: 13,
    letterSpacing: 1,
    paddingTop: spacing.xs,
  },
});
