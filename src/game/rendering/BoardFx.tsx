import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { FlightPass } from '@/game/presentation/events';
import { GP } from '@/theme/gameplayUi';
import { GP_MOTION, pulseEnvelope } from '@/theme/gameplayMotion';
import type { BoardGeometry } from './boardGeometry';
import { entryWaitEndAt } from './railPath';

/**
 * M5.8B board-level presentation effects. Everything here is driven from
 * existing clocks on the UI thread — no JS per hit, no timers, no React state.
 *
 *  - Gate: each flight plays its own GateTerminal response (transit on rail
 *    entry, gold capture into Holding, danger burst on reject) off its own
 *    pass clock, so it lands on the exact frame of the beat it represents.
 */

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
  gateRing: { position: 'absolute', borderWidth: 2.5 },
  gateCore: { position: 'absolute' },
});
