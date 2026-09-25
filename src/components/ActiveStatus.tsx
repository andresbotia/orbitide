import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated';

import type { OrbColor } from '@/game/engine/types';
import { orbColors } from '@/theme/colors';
import { AV, AV_SIZE } from '@/theme/arcadiaV2';
import { GP, GP_TYPE } from '@/theme/gameplayUi';
import { GP_MOTION } from '@/theme/gameplayMotion';

const PIP_EMPTY = 'rgba(255,255,255,0.14)';
/** Full: empty-pip colour tinted coral at 30% (static, never blinking). */
const PIP_EMPTY_FULL = 'rgba(255,90,122,0.3)';
const PIP_FALLBACK = '#FFFFFF';

/**
 * Core V2 ACTIVE occupancy — the left half of the v2 tray: "ACTIVE n/cap"
 * over one pip per rail slot. A pip fills with the colour of the Pal on the
 * track, so players can read what is circling without looking at the board.
 * Capacity is passed in; never hardcoded. At capacity the count turns coral —
 * a static state, no pulse.
 *
 * Capacity refusal (a tap while ACTIVE is full) is one restrained coral flash
 * of this readout — a response to the tap, never an idle loop. `refusalSeq`
 * bumps once per refused tap; the Error haptic lives in the session.
 */
export const ActiveStatus = memo(function ActiveStatus({
  count, capacity, colors, refusalSeq = 0,
}: {
  count: number;
  capacity: number;
  /** Colours of the Pals currently on the track, launch order. */
  colors?: readonly OrbColor[];
  /** Bumped by the session each time a tap is refused because ACTIVE is full. */
  refusalSeq?: number;
}) {
  const reducedMotion = useReducedMotion();
  const full = capacity > 0 && count >= capacity;

  const alarm = useSharedValue(0);
  useEffect(() => {
    if (!refusalSeq) return;
    cancelAnimation(alarm);
    alarm.set(withSequence(
      withTiming(1, { duration: GP_MOTION.capacityRiseMs }),
      withTiming(0, { duration: GP_MOTION.capacityFallMs }),
    ));
  }, [refusalSeq, alarm]);

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(alarm.value, [0, 1], [AV.textSecondary, GP.danger]),
  }));
  const restNum = full ? GP.danger : AV.white;
  const numStyle = useAnimatedStyle(() => ({
    color: interpolateColor(alarm.value, [0, 1], [restNum, GP.danger]),
  }));

  if (capacity <= 0) return null;
  const pipW = capacity <= 5 ? AV_SIZE.activePipW : Math.max(8, Math.floor(92 / capacity) - 3);
  const empty = full ? PIP_EMPTY_FULL : PIP_EMPTY;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Active ${count} of ${capacity}${full ? ', full' : ''}`}
      accessibilityLiveRegion="polite"
      style={styles.block}
    >
      <View style={styles.head}>
        <Animated.Text style={[styles.label, labelStyle]}>ACTIVE</Animated.Text>
        <Animated.Text style={[styles.num, numStyle]}>{count}/{capacity}</Animated.Text>
      </View>
      <View style={styles.pips}>
        {Array.from({ length: capacity }, (_, i) => {
          const c = colors?.[i];
          return (
            <Pip
              key={i}
              on={i < count}
              color={c ? orbColors[c] : PIP_FALLBACK}
              empty={empty}
              width={pipW}
              reducedMotion={reducedMotion}
            />
          );
        })}
      </View>
    </View>
  );
});

const Pip = memo(function Pip({ on, color, empty, width, reducedMotion }: {
  on: boolean; color: string; empty: string; width: number; reducedMotion: boolean;
}) {
  const fill = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    fill.set(withTiming(on ? 1 : 0, { duration: reducedMotion ? 0 : 140 }));
  }, [on, fill, reducedMotion]);
  const style = useAnimatedStyle(() => ({ opacity: fill.value }));
  return (
    <View style={[styles.pip, { width, backgroundColor: empty }]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.pipFill, { backgroundColor: color }, style]} />
    </View>
  );
});

const styles = StyleSheet.create({
  block: { gap: 7 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  label: { ...GP_TYPE.label },
  num: { ...GP_TYPE.numeral },
  pips: { flexDirection: 'row', gap: 3 },
  pip: {
    height: AV_SIZE.activePipH,
    borderRadius: 3,
    overflow: 'hidden',
  },
  pipFill: { borderRadius: 3 },
});
