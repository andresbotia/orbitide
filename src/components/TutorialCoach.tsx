import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { tutorialCoachText } from '@/game/presentation/tutorialCoach';
import type { TutorialView } from '@/game/tutorial';
import { GP, GP_RADIUS, GP_TYPE } from '@/theme/gameplayUi';

interface TutorialCoachProps {
  tutorial: TutorialView;
}

/**
 * M5.4C — the one-line coach for the Core V2 Level 1 tutorial. Reads only
 * `session.tutorial`; it never drives progression, gating, or highlight —
 * `TunnelBar`/`HoldingTray` resolve their own spotlight from the same view.
 * Renders nothing outside `launch`/`relaunchHeld` (see `tutorialCoachText`),
 * so `freePlay` and `completed` fall out of this naturally.
 *
 * M5.8B: a callout in the gameplay panel material (lit cyan edge, 12pt copy)
 * that drops in 6pt — one-shot, never a modal.
 */
export function TutorialCoach({ tutorial }: TutorialCoachProps) {
  const reducedMotion = useReducedMotion();
  const text = tutorialCoachText(tutorial);
  if (!text) return null;

  return (
    <Animated.View
      key={text}
      entering={reducedMotion ? FadeIn.duration(120) : FadeInDown.duration(200).withInitialValues({ transform: [{ translateY: -6 }] })}
      exiting={FadeOut.duration(120)}
      style={styles.wrap}
      pointerEvents="none"
    >
      <View style={styles.edge} />
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    maxWidth: '94%',
    zIndex: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: GP_RADIUS.control,
    backgroundColor: GP.panel,
    borderWidth: 1,
    borderColor: GP.hairlineStrong,
  },
  edge: {
    position: 'absolute',
    top: -1,
    left: 16,
    right: 16,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: GP.cyan,
  },
  text: {
    ...GP_TYPE.body,
    color: GP.text,
    textAlign: 'center',
  },
});
