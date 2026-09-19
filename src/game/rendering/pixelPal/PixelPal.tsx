import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import type { FlightPass } from '@/game/presentation/events';
import { holdingHandoffOpacity } from '@/game/presentation/motion';
import { orbColors } from '@/theme/colors';
import { GAMEPLAY } from '@/theme/gameplayLayout';
import { homeAlpha } from '@/theme/homeV2';
import type { BoardGeometry } from '../boardGeometry';
import { flightPose } from '../flightGeometry';
import { AnimatedCount } from './AnimatedCount';
import { PixelPalBadge, PixelPalShell, PixelPalVisor } from './PixelPalFace';

/** How long after launch the wind-up squash reads (ms). */
const LAUNCH_SQUASH_MS = 160;

/**
 * Core V2 traveling Pixel Pal. Shell banks with travel; visor + count badge
 * stay upright so the face and remaining-count never read upside down.
 * No halo — silhouette, shell material, and a contact shadow do the separation.
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

  const motionState = useDerivedValue(() => {
    const t = clock.value;
    const pose = flightPose(pass, layout, t, laneOffset);
    const heading = pose.heading;
    const bank = pose.bank;

    const launchP = Math.max(0, Math.min(1, t / LAUNCH_SQUASH_MS));
    const launchSquash = t < pass.liftMs ? Math.sin(launchP * Math.PI) * 0.12 : 0;

    let recoil = 0;
    for (const shot of pass.shots) {
      if (t >= shot.fireAt && t <= shot.impactAt + 40) { recoil = 0.14; break; }
      if (t < shot.fireAt) break;
    }

    const tail = Math.max(0, Math.min(1, (t - pass.orbitEndAt) / Math.max(1, pass.landingAt - pass.orbitEndAt)));
    // consumed bursts at its last hit; reject bursts in place at GateTerminal.
    const bursts = pass.terminal.kind !== 'toHolding';
    const popScale = bursts ? 1 + tail * 0.6 : 1;
    // A landed Pal lingers at its slot through the Holding handoff so the tray's
    // Pal can appear underneath before this one fades.
    const opacity = bursts ? (t >= pass.landingAt ? 0 : 1 - tail) : holdingHandoffOpacity(pass, t);
    const s = pose.landing ?? 0;
    const grow = 1 + (trayScale - 1) * (s < 0.5 ? 2 * s * s : 1 - (-2 * s + 2) ** 2 / 2);

    return {
      x: pose.x, y: pose.y, heading, bank,
      scaleX: (1 - launchSquash - recoil) * popScale * grow,
      scaleY: (1 + launchSquash + recoil * 0.6) * popScale * grow,
      opacity,
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

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.wrap, { width: size, height: size }, shellStyle]}>
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
        style={[styles.wrap, { width: size, height: size, overflow: 'visible' }, visorStyle]}
      >
        <PixelPalVisor size={size} mood="focused" />
        {/* Sized for the launch count (it only falls); the digits run on the UI thread. */}
        <PixelPalBadge palSize={size} color={pass.charge.color} text={String(pass.charge.capacity)} active>
          <AnimatedCount palSize={size} pass={pass} clock={clock} active />
        </PixelPalBadge>
      </Animated.View>
    </>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, top: 0 },
});
