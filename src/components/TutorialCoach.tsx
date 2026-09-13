import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { tutorialCoachText } from '@/game/presentation/tutorialCoach';
import type { TutorialView } from '@/game/tutorial';
import { material } from '@/theme/material';
import { spacing } from '@/theme/spacing';

interface TutorialCoachProps {
  tutorial: TutorialView;
}

/**
 * M5.4C — the one-line coach for the Core V2 Level 1 tutorial. Reads only
 * `session.tutorial`; it never drives progression, gating, or highlight —
 * `TunnelBar`/`HoldingTray` resolve their own spotlight from the same view.
 * Renders nothing outside `launch`/`relaunchHeld` (see `tutorialCoachText`),
 * so `freePlay` and `completed` fall out of this naturally.
 */
export function TutorialCoach({ tutorial }: TutorialCoachProps) {
  const text = tutorialCoachText(tutorial);
  if (!text) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(120)}
      style={styles.wrap}
      pointerEvents="none"
    >
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: spacing.sm,
    alignSelf: 'center',
    maxWidth: '96%',
    zIndex: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: material.overlay,
    borderWidth: 1,
    borderColor: 'rgba(77,225,255,0.35)',
  },
  text: {
    color: material.textPrimary,
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
});
