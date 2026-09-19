import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withSequence, withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { feedback } from '@/game/feedback';
import type { FlightPass } from '@/game/presentation/events';
import { shotsClearedAt } from '@/game/presentation/motion';
import { GP, GP_DISPLAY_FONT, GP_TYPE, gpAlpha } from '@/theme/gameplayUi';
import { comboTierCrossed, GP_MOTION, nextComboChain, pulseEnvelope } from '@/theme/gameplayMotion';
import type { BoardGeometry } from './boardGeometry';
import { DigitStrip } from './pixelPal/AnimatedCount';
import { entryWaitEndAt } from './railPath';

/**
 * M5.8B board-level presentation effects. Everything here is driven from
 * existing clocks on the UI thread — no JS per hit, no timers, no React state.
 *
 *  - Combo: every flight reports its landed shots into one board-wide chain
 *    (`useComboHits`). Hits ≤ `comboWindowMs` apart extend it, across Pals.
 *    The chain drives a restrained board-edge pulse and, for longer chains, a
 *    small COMBO ×N chip on the top rail band — never over the artwork.
 *  - Gate: each flight plays its own GateTerminal response (transit on rail
 *    entry, gold capture into Holding, danger burst on reject) off its own
 *    pass clock, so it lands on the exact frame of the beat it represents.
 */

export interface ComboState {
  chain: SharedValue<number>;
  lastHitAt: SharedValue<number>;
  /** 0..1 one-shot per hit — edge pulse / chip punch. */
  beat: SharedValue<number>;
  /** 0..1 — chip visibility (holds, then fades on its own). */
  chip: SharedValue<number>;
}

export function useComboState(): ComboState {
  const chain = useSharedValue(0);
  const lastHitAt = useSharedValue(-1e9);
  const beat = useSharedValue(0);
  const chip = useSharedValue(0);
  return useMemo(() => ({ chain, lastHitAt, beat, chip }), [chain, lastHitAt, beat, chip]);
}

/** Sound-only hook (no haptic — the arbiter already escalates grouped hits). */
function onComboTier(): void {
  feedback.emit('combo', { haptic: false });
}

/**
 * Feed one flight's landed shots into the board combo. A re-scripted pass
 * re-arms the reaction (`previous === null`), which is ignored, so already
 * counted shots are never counted twice.
 */
export function useComboHits(pass: FlightPass, clock: SharedValue<number>, now: SharedValue<number>, combo: ComboState, reducedMotion: boolean): void {
  useAnimatedReaction(
    () => shotsClearedAt(pass, clock.value),
    (hits, previous) => {
      if (previous === null || hits <= previous) return;
      const at = now.value;
      const before = combo.chain.value;
      const next = nextComboChain(before, combo.lastHitAt.value, at, hits - previous, GP_MOTION.comboWindowMs);
      combo.chain.set(next);
      combo.lastHitAt.set(at);
      if (next >= GP_MOTION.comboEdgeAt && !reducedMotion) {
        combo.beat.set(withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 300 })));
      }
      if (next >= GP_MOTION.comboChipAt) {
        combo.chip.set(withSequence(
          withTiming(1, { duration: 90 }),
          withDelay(GP_MOTION.comboChipHoldMs, withTiming(0, { duration: GP_MOTION.comboChipFadeMs })),
        ));
      }
      if (comboTierCrossed(before, next) > 0) runOnJS(onComboTier)();
    },
    [pass, reducedMotion],
  );
}

const CHIP_H = 18;
const COMBO_NUMERAL = {
  color: GP.text,
  fontFamily: GP_DISPLAY_FONT,
  fontSize: 12,
  lineHeight: 13,
  textAlign: 'center' as const,
  fontVariant: ['tabular-nums' as const],
};

/** Board-edge momentum pulse + COMBO ×N chip. Two views plus the digit strip. */
export const ComboLayer = memo(function ComboLayer({ combo, geo, reducedMotion }: {
  combo: ComboState;
  geo: BoardGeometry;
  reducedMotion: boolean;
}) {
  const gold = useDerivedValue(() => (combo.chain.value >= GP_MOTION.comboGoldAt ? 1 : 0));
  const edgeStyle = useAnimatedStyle(() => {
    const strength = Math.min(1, combo.chain.value / 12);
    return {
      opacity: combo.chain.value >= GP_MOTION.comboEdgeAt ? combo.beat.value * (0.25 + strength * 0.4) : 0,
      borderColor: gold.value ? GP.gold : GP.cyan,
    };
  });
  const chipStyle = useAnimatedStyle(() => ({
    opacity: combo.chip.value,
    borderColor: gold.value ? GP.gold : GP.hairlineStrong,
    transform: [{ scale: reducedMotion ? 1 : 0.9 + combo.chip.value * 0.1 + combo.beat.value * 0.08 }],
  }));
  const labelStyle = useAnimatedStyle(() => ({ color: gold.value ? GP.gold : GP.cyan }));

  const top = geo.perimeter ? geo.perimeter.y - CHIP_H / 2 : 2;
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.edge, edgeStyle]} />
      <View pointerEvents="none" style={[styles.chipRow, { top }]}>
        <Animated.View style={[styles.chip, chipStyle]}>
          <Animated.Text style={[styles.chipLabel, labelStyle]}>COMBO ×</Animated.Text>
          <DigitStrip count={combo.chain} columns={3} numeral={COMBO_NUMERAL} />
        </Animated.View>
      </View>
    </>
  );
});

/**
 * One flight's GateTerminal response. The static gate (Skia) never animates;
 * this ring + core only play on the flight's own beats:
 *   transit — when the Pal crosses the gate onto the rail (cyan)
 *   capture — when a toHolding Pal completes its lap (gold ring, cyan core)
 *   reject  — the burst (danger ring + core flash)
 */
export const GateFx = memo(function GateFx({ pass, clock, geo, reducedMotion }: {
  pass: FlightPass;
  clock: SharedValue<number>;
  geo: BoardGeometry;
  reducedMotion: boolean;
}) {
  const r = Math.max(8, geo.chargeRadius * 0.62);
  const terminal = pass.terminal.kind === 'toHolding' ? 1 : pass.terminal.kind === 'reject' ? 2 : 0;
  const transitAt = useMemo(() => entryWaitEndAt(pass) - GP_MOTION.gateTransitLeadMs, [pass]);
  const endAt = pass.orbitEndAt;

  const phase = useDerivedValue(() => {
    const t = clock.value;
    if (terminal !== 0) {
      const ms = terminal === 1 ? GP_MOTION.gateCaptureMs : GP_MOTION.gateRejectMs;
      const since = t - endAt;
      if (since >= 0 && since < ms) return { kind: terminal, v: pulseEnvelope(since, ms, 70), p: since / ms };
    }
    const since = t - transitAt;
    if (since >= 0 && since < GP_MOTION.gateTransitMs) {
      return { kind: 0, v: pulseEnvelope(since, GP_MOTION.gateTransitMs, 60), p: since / GP_MOTION.gateTransitMs };
    }
    return { kind: -1, v: 0, p: 0 };
  });

  const ringStyle = useAnimatedStyle(() => {
    const { kind, v, p } = phase.value;
    if (kind < 0) return { opacity: 0 };
    const grow = kind === 2 ? 1.5 : kind === 1 ? 0.9 : 1;
    return {
      opacity: v * 0.9,
      borderColor: kind === 2 ? GP.danger : kind === 1 ? GP.gold : GP.cyan,
      transform: [{ scale: reducedMotion ? 1.2 : 0.7 + p * grow }],
    };
  });
  const coreStyle = useAnimatedStyle(() => {
    const { kind, v } = phase.value;
    if (kind < 1) return { opacity: 0 };
    return {
      opacity: v * (kind === 2 ? 0.85 : 0.6),
      backgroundColor: kind === 2 ? GP.danger : GP.cyan,
    };
  });

  const { x, y } = geo.orbitInsertion;
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.gateRing, { left: x - r * 1.6, top: y - r * 1.6, width: r * 3.2, height: r * 3.2, borderRadius: r * 1.6 }, ringStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.gateCore, { left: x - r * 0.7, top: y - r * 0.7, width: r * 1.4, height: r * 1.4, borderRadius: r * 0.7 }, coreStyle]}
      />
    </>
  );
});

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    top: -2, left: -2, right: -2, bottom: -2,
    borderRadius: 18,
    borderWidth: 2,
  },
  chipRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  chip: {
    height: CHIP_H,
    paddingHorizontal: 8,
    borderRadius: CHIP_H / 2,
    borderWidth: 1,
    backgroundColor: gpAlpha(GP.canvas, 0.92),
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipLabel: { ...GP_TYPE.label, fontSize: 9, letterSpacing: 1.2 },
  gateRing: { position: 'absolute', borderWidth: 2.5 },
  gateCore: { position: 'absolute' },
});
