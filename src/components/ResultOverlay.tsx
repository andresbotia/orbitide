import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';

import { PrimaryCta } from '@/components/brand';
import { feedback } from '@/game/feedback';
import { PixelPalFace } from '@/game/rendering/pixelPal/PixelPalFace';
import { GP, GP_DISPLAY_FONT, GP_RADIUS, GP_TYPE, gpAlpha } from '@/theme/gameplayUi';
import { GP_MOTION } from '@/theme/gameplayMotion';

export type FailureReason = 'holdingFull' | 'noMoves';

/**
 * TUNABLE — presentation beat between the presented loss (board dim begins)
 * and the LEVEL FAILED card. A UI-thread delay, not a JS timer.
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

const COPY: Record<FailureReason, { chip: string; sub: string }> = {
  holdingFull: { chip: 'HOLDING FULL', sub: 'The tray filled before the picture was cleared.' },
  noMoves: { chip: 'NO MOVES LEFT', sub: 'No launch can clear a pixel from here.' },
};

/**
 * LEVEL FAILED (M5.8B). Arrives on an already-dimmed, settled board: the
 * scrim fades in and the card rises 18pt after `RESULT_BEAT_MS`, never a zoom
 * spring. Danger is a thin top edge and the reason chip — the title itself is
 * calm light text and the Pal looks down, not dead: failing is a retry beat,
 * not a punishment. TRY AGAIN is the one dominant action.
 */
export const ResultOverlay = memo(function ResultOverlay({ visible, reason = 'holdingFull', onRetry, onHome }: ResultOverlayProps) {
  if (!visible) return null;
  return <FailCard reason={reason} onRetry={onRetry} onHome={onHome} />;
});

function FailCard({ reason, onRetry, onHome }: { reason: FailureReason; onRetry: () => void; onHome: () => void }) {
  const reducedMotion = useReducedMotion();
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(withDelay(RESULT_BEAT_MS, withTiming(1, {
      duration: reducedMotion ? GP_MOTION.reducedFadeMs : GP_MOTION.lossCardMs,
      easing: Easing.out(Easing.cubic),
    })));
  }, [shown, reducedMotion]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - shown.value) * GP_MOTION.lossCardRise }],
  }));
  const copy = COPY[reason];

  return (
    <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="auto">
      <Animated.View style={[styles.card, cardStyle]} accessibilityViewIsModal>
        <View pointerEvents="none" style={styles.dangerEdge} />
        <PixelPalFace color="cyan" size={48} mood="down" animate={false} />

        <Text style={styles.title} accessibilityRole="header">LEVEL FAILED</Text>

        <View style={styles.reasonChip}>
          <Text style={styles.reasonText}>{copy.chip}</Text>
        </View>
        <Text style={styles.sub}>{copy.sub}</Text>

        <PrimaryCta
          label="Try Again"
          onPress={onRetry}
          onPressIn={() => feedback.emit('select')}
          fullWidth
          style={styles.cta}
        />

        <Pressable onPress={onHome} hitSlop={12} accessibilityRole="button">
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
    backgroundColor: GP.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    zIndex: 100,
    elevation: 100,
  },
  card: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 24,
    borderRadius: GP_RADIUS.panel,
    backgroundColor: GP.panel,
    borderWidth: 1,
    borderColor: GP.hairline,
    width: '100%',
    maxWidth: 340,
    gap: 10,
    zIndex: 101,
    elevation: 101,
  },
  dangerEdge: {
    position: 'absolute',
    top: -1,
    left: 32,
    right: 32,
    height: 2,
    borderRadius: 1,
    backgroundColor: GP.danger,
    opacity: 0.85,
  },
  title: {
    color: GP.text,
    fontFamily: GP_DISPLAY_FONT,
    fontSize: 26,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 6,
  },
  reasonChip: {
    paddingHorizontal: 10,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    backgroundColor: gpAlpha(GP.danger, 0.14),
    borderWidth: 1,
    borderColor: gpAlpha(GP.danger, 0.5),
  },
  reasonText: { ...GP_TYPE.label, color: GP.danger, letterSpacing: 1.8 },
  sub: {
    ...GP_TYPE.body,
    fontSize: 14,
    lineHeight: 20,
    color: GP.textSecondary,
    textAlign: 'center',
    marginBottom: 10,
  },
  cta: {
    marginBottom: 6,
  },
  secondary: {
    ...GP_TYPE.body,
    fontSize: 14,
    color: GP.textMuted,
    letterSpacing: 1,
    paddingVertical: 4,
  },
});
