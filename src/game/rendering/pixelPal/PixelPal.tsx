import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';

import type { FlightPass } from '@/game/presentation/events';
import { holdingHandoffOpacity } from '@/game/presentation/motion';
import { orbColors } from '@/theme/colors';
import { activePalBadge, GAMEPLAY } from '@/theme/gameplayLayout';
import { GP_MOTION } from '@/theme/gameplayMotion';
import { homeAlpha } from '@/theme/homeV2';
import type { BoardGeometry } from '../boardGeometry';
import { flightPose } from '../flightGeometry';
import { AnimatedCount } from './AnimatedCount';
import { PixelPalShell, PixelPalVisor } from './PixelPalFace';
import { GP, gpAlpha } from '@/theme/gameplayUi';

/** How long after launch the wind-up squash reads (ms). */
const LAUNCH_SQUASH_MS = 160;
/** TUNABLE — how long the count plate takes to leave once the Pal is spent. */
const BADGE_FADE_MS = 120;
/** Plate anchor, as a fraction of Pal size from its centre (lower-right). */
const BADGE_AT = { x: 0.34, y: 0.3 };
/** Draw order across every flight: badges above visors above shells. */
const Z_SHELL = 1;
const Z_VISOR = 2;
const Z_BADGE = 3;

/**
 * Core V2 traveling Pixel Pal. Shell banks with travel; visor stays upright so
 * the face never reads upside down.
 * No halo — silhouette, shell material, and a contact shadow do the separation.
 *
 * The remaining-count plate is its own top-level layer (device QA): it is
 * positioned straight from board coordinates rather than riding inside the
 * visor box, so it cannot be clipped by that box, never inherits the shell's
 * rotation or its squash/recoil/burst scaling, and — via `zIndex` — always
 * draws above every other Pal's shell instead of being covered by the Pal
 * behind it in a convoy.
 *
 * Everything below is one derived value off the pass clock (no React state,
 * no per-hit render): lift squash + a short launch trail until rail entry,
 * shot recoil, the count plate's tick on each hit, and the terminal pop/fade.
 */
export const PixelPal = memo(function PixelPal({ layout, pass, clock, colorAssist, laneOffset = 0 }: {
  layout: BoardGeometry; pass: FlightPass; clock: SharedValue<number>; colorAssist?: boolean;
  /** Presentation-only radial lane nudge (px) so crowded charges stay readable. */
  laneOffset?: number;
  /** @deprecated Halo dimming was removed; accepted so existing call sites compile. */
  dim?: boolean;
}) {
  const r = layout.chargeRadius;
  const size = Math.round(r * 2.1);
  // Grows to the tray Pal's size on the way into Holding so the handoff is a
  // continuation, not a swap between two different-sized Pals.
  const trayScale = GAMEPLAY.holdingPal / size;
  const reducedMotion = useReducedMotion();

  // Count plate geometry, resolved on the JS side (the plate only ever shrinks
  // its value, so the launch count sizes it for the whole flight).
  const badge = activePalBadge(size);
  const digits = String(Math.max(0, pass.charge.capacity)).length;
  const plateW = Math.max(badge.height, badge.fontSize * digits * 0.7 + 10);
  const plateH = badge.height;
  // The beat this Pal is spent: its plate leaves as the terminal burst starts.
  const spentAt = pass.shots.find((shot) => shot.remaining <= 0)?.clearAt ?? Number.POSITIVE_INFINITY;

  const motionState = useDerivedValue(() => {
    const t = clock.value;
    const pose = flightPose(pass, layout, t, laneOffset);
    const heading = pose.heading;
    const bank = pose.bank;

    const launchP = Math.max(0, Math.min(1, t / LAUNCH_SQUASH_MS));
    const launchSquash = t < pass.liftMs ? Math.sin(launchP * Math.PI) * 0.12 : 0;

    let recoil = 0;
    let tick = 0;
    for (const shot of pass.shots) {
      if (t < shot.fireAt) break;
      if (t <= shot.impactAt + 40) recoil = 0.14;
      const since = t - shot.clearAt;
      if (since >= 0 && since < GP_MOTION.badgeTickMs) tick = 1 - since / GP_MOTION.badgeTickMs;
    }
    const trailSpan = pass.liftMs - GP_MOTION.trailStartMs;
    const trailP = (t - GP_MOTION.trailStartMs) / Math.max(1, trailSpan);
    const trail = trailP > 0 && trailP < 1 ? Math.sin(trailP * Math.PI) : 0;

    const tail = Math.max(0, Math.min(1, (t - pass.orbitEndAt) / Math.max(1, pass.landingAt - pass.orbitEndAt)));
    // consumed bursts at its last hit; reject bursts in place at GateTerminal.
    const bursts = pass.terminal.kind !== 'toHolding';
    const popScale = bursts ? 1 + tail * 0.6 : 1;
    // A landed Pal lingers at its slot through the Holding handoff so the tray's
    // Pal can appear underneath before this one fades.
    const opacity = bursts ? (t >= pass.landingAt ? 0 : 1 - tail) : holdingHandoffOpacity(pass, t);
    const s = pose.landing ?? 0;
    const grow = 1 + (trayScale - 1) * (s < 0.5 ? 2 * s * s : 1 - (-2 * s + 2) ** 2 / 2);

    const spent = t - spentAt;
    const badgeVis = spent < 0 ? 1 : Math.max(0, 1 - spent / BADGE_FADE_MS);

    return {
      x: pose.x, y: pose.y, heading, bank,
      grow,
      badgeVis,
      scaleX: (1 - launchSquash - recoil) * popScale * grow,
      scaleY: (1 + launchSquash + recoil * 0.6) * popScale * grow,
      opacity,
      tick,
      trail,
    };
  });

  const shellStyle = useAnimatedStyle(() => {
    const m = motionState.value;
    return {
      opacity: m.opacity,
      transform: [
        { translateX: m.x - size / 2 },
        { translateY: m.y - size / 2 },
        { rotate: `${m.heading + (m.bank * Math.PI) / 180}rad` },
        { scaleX: m.scaleX },
        { scaleY: m.scaleY },
      ],
    };
  });

  const visorStyle = useAnimatedStyle(() => {
    const m = motionState.value;
    return {
      opacity: m.opacity,
      transform: [
        { translateX: m.x - size / 2 },
        { translateY: m.y - size / 2 },
        { scaleX: m.scaleX },
        { scaleY: m.scaleY },
      ],
    };
  });

  const trailStyle = useAnimatedStyle(() => {
    const v = reducedMotion ? 0 : motionState.value.trail;
    return { opacity: v * 0.5, transform: [{ scaleY: 0.4 + v * 0.6 }] };
  });
  // Upright by construction: translation + scale only, never the shell's
  // rotation, bank, squash or burst pop.
  const badgeStyle = useAnimatedStyle(() => {
    const m = motionState.value;
    return {
      opacity: m.opacity * m.badgeVis,
      transform: [
        { translateX: m.x + size * BADGE_AT.x * m.grow - plateW / 2 },
        { translateY: m.y + size * BADGE_AT.y * m.grow - plateH / 2 },
        { scale: (reducedMotion ? 1 : 1 + m.tick * GP_MOTION.badgeTickScale) * m.grow },
      ],
    };
  });

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.wrap, { width: size, height: size, zIndex: Z_SHELL }, shellStyle]}>
        {/* Launch trail: behind the shell (its local "down") until rail entry. */}
        <Animated.View
          pointerEvents="none"
          style={[{
            position: 'absolute',
            left: size * 0.32,
            top: size * 0.62,
            width: size * 0.36,
            height: size * 0.9,
            borderRadius: size * 0.18,
            backgroundColor: orbColors[pass.charge.color],
          }, trailStyle]}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: -size * 0.06,
            top: -size * 0.06,
            width: size * 1.12,
            height: size * 1.12,
            borderRadius: size * 0.4,
            backgroundColor: homeAlpha(orbColors[pass.charge.color], 0.2),
          }}
        />
        <PixelPalShell color={pass.charge.color} size={size} colorAssist={colorAssist} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        accessible
        accessibilityLabel={`Pixel Pal, ${pass.charge.color} Pal, capacity ${pass.charge.capacity}`}
        style={[styles.wrap, { width: size, height: size, overflow: 'visible', zIndex: Z_VISOR }, visorStyle]}
      >
        <PixelPalVisor size={size} mood="focused" />
      </Animated.View>

      {/* Remaining count. Own layer, upright, above every shell on the board. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.wrap,
          {
            width: plateW,
            height: plateH,
            borderRadius: Math.min(7, plateH * 0.3),
            backgroundColor: GP.canvas,
            borderWidth: 1.5,
            borderColor: orbColors[pass.charge.color],
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: Z_BADGE,
          },
          badgeStyle,
        ]}
      >
        {/* Dark keyline so the plate separates from busy pixel art. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -3.5, left: -3.5, right: -3.5, bottom: -3.5,
            borderRadius: Math.min(7, plateH * 0.3) + 3.5,
            borderWidth: 1.5,
            borderColor: gpAlpha(GP.canvas, 0.85),
          }}
        />
        {/* Digits run on the UI thread — no React commit per hit. */}
        <AnimatedCount palSize={size} pass={pass} clock={clock} active />
      </Animated.View>
    </>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, top: 0 },
});
