import { memo } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import Animated, {
  useAnimatedProps, useAnimatedStyle, useDerivedValue, type SharedValue,
} from 'react-native-reanimated';

import type { FlightPass } from '@/game/presentation/events';
import { capacityAt } from '@/game/presentation/motion';
import { orbGlow } from '@/theme/colors';
import type { BoardGeometry } from '../boardGeometry';
import { flightPose } from '../flightGeometry';
import { PixelPalShell, PixelPalVisor } from './PixelPalFace';

const Counter = Animated.createAnimatedComponent(TextInput);

/** How long after launch the wind-up squash reads (ms). */
const LAUNCH_SQUASH_MS = 160;

/**
 * M5.3 — the Core V2 traveling Pixel Pal. One independent instance per active
 * flight (mirrors `OrbitingCharge`'s per-charge-clock architecture, spec
 * §19): position, heading and corner bank all come from `flightGeometry.ts`'s
 * rounded-perimeter functions, driven by the SAME UI-thread clock the
 * projectile and pixel-clear previews already use — nothing here re-derives
 * engine truth or owns a timer of its own.
 *
 * Rendered as two overlaid layers sharing one position: `PixelPalShell`
 * rotates/banks/leans with travel ("orientation follows perimeter travel",
 * spec §5), while `PixelPalVisor` (eyes + the live capacity number) stays
 * upright on top of it, so the gameplay-critical count never reads upside
 * down mid-corner (spec §4: readable "in all states").
 */
export const PixelPal = memo(function PixelPal({ layout, pass, clock, colorAssist, laneOffset = 0, dim = false }: {
  layout: BoardGeometry; pass: FlightPass; clock: SharedValue<number>; colorAssist?: boolean;
  /** Presentation-only radial lane nudge (px) so crowded charges stay readable. */
  laneOffset?: number;
  /** Calm the halo when several charges share the rail. */
  dim?: boolean;
}) {
  const r = layout.chargeRadius;
  const size = r * 2.1;
  const glow = orbGlow[pass.charge.color];
  const haloDepth = dim ? 0.55 : 1;

  const motionState = useDerivedValue(() => {
    const t = clock.value;
    const pose = flightPose(pass, layout, t, laneOffset);
    const heading = pose.heading;
    const bank = pose.bank;

    // Launch anticipation — a brief wind-up squash right as the Pixel Pal
    // clears its tunnel/Holding source (spec §5 "Launch anticipation").
    const launchP = Math.max(0, Math.min(1, t / LAUNCH_SQUASH_MS));
    const launchSquash = t < pass.liftMs ? Math.sin(launchP * Math.PI) * 0.12 : 0;

    // Fire recoil — brief squash the instant a shot fires.
    let recoil = 0;
    for (const shot of pass.shots) {
      if (t >= shot.fireAt && t <= shot.impactAt + 40) { recoil = 0.14; break; }
      if (t < shot.fireAt) break;
    }

    // Consumed exit — a compact pop (scale up + fade); never sent to Holding.
    const tail = Math.max(0, Math.min(1, (t - pass.orbitEndAt) / Math.max(1, pass.landingAt - pass.orbitEndAt)));
    const gone = t >= pass.landingAt;
    const popScale = pass.endKind === 'burst' ? 1 + tail * 0.6 : 1;
    const popOpacity = pass.endKind === 'burst' ? 1 - tail : 1;

    return {
      x: pose.x, y: pose.y, heading, bank,
      scaleX: (1 - launchSquash - recoil) * popScale,
      scaleY: (1 + launchSquash + recoil * 0.6) * popScale,
      opacity: gone ? 0 : popOpacity,
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

  // Same position, deliberately no rotation — the visor/number stay upright.
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

  const halo = useAnimatedStyle(() => {
    const m = motionState.value;
    const t = clock.value;
    const orbiting = t > pass.liftMs && t < pass.orbitEndAt;
    return {
      opacity: (t >= pass.landingAt ? 0 : orbiting ? 0.36 : 0.2) * haloDepth,
      transform: [{ translateX: m.x - size }, { translateY: m.y - size }],
    };
  });

  const count = useAnimatedProps(() => {
    const text = String(capacityAt(pass, clock.value));
    return { text, defaultValue: text } as TextInputProps & { text: string };
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, { width: size * 2, height: size * 2, borderRadius: size, backgroundColor: glow }, halo]}
      />
      <Animated.View pointerEvents="none" style={[styles.wrap, { width: size, height: size }, shellStyle]}>
        <PixelPalShell color={pass.charge.color} size={size} colorAssist={colorAssist} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        accessible
        accessibilityLabel={`Pixel Pal, ${pass.charge.color} charge, capacity ${pass.charge.capacity}`}
        style={[styles.wrap, { width: size, height: size }, visorStyle]}
      >
        <PixelPalVisor size={size} mood="focused">
          <Counter
            editable={false}
            caretHidden
            accessible={false}
            pointerEvents="none"
            underlineColorAndroid="transparent"
            defaultValue={String(pass.charge.capacity)}
            animatedProps={count}
            style={[styles.count, { fontSize: size * 0.34 }]}
          />
        </PixelPalVisor>
      </Animated.View>
    </>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, top: 0 },
  halo: { position: 'absolute', left: 0, top: 0 },
  count: { color: '#F4F8FF', fontWeight: '900', textAlign: 'center', padding: 0, width: '100%' },
});
