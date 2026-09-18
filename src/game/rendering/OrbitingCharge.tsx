import { memo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { ColorAssistMark } from '@/components/ColorAssistMark';
import type { FlightPass } from '@/game/presentation/events';
import { capacityAt } from '@/game/presentation/motion';
import { orbColors, orbGlow, orbLabel } from '@/theme/colors';
import { arcade } from '@/theme/arcade';
import type { BoardGeometry } from './boardGeometry';
import { flightPosition } from './flightGeometry';

/**
 * One independent active-charge renderer. It owns nothing global: N simultaneous
 * charges (M2B) = N mounted <OrbitingCharge> instances, each bound to its own
 * FlightPass and a shared UI-thread clock. Dimensional energy-glass orb, live
 * capacity number, a short restrained trail, its actual orbit position.
 */
export const OrbitingCharge = memo(function OrbitingCharge({ layout, pass, clock, colorAssist, laneOffset = 0, dim = false }: {
  layout: BoardGeometry; pass: FlightPass; clock: SharedValue<number>; colorAssist?: boolean;
  /** Presentation-only radial lane nudge (px) so crowded charges stay readable. */
  laneOffset?: number;
  /** Calm the halo/trail when several charges share the rail. */
  dim?: boolean;
}) {
  const r = layout.chargeRadius;
  const fill = orbColors[pass.charge.color];
  const glow = orbGlow[pass.charge.color];
  const trailDepth = dim ? 0.55 : 1;

  const body = useAnimatedStyle(() => {
    const point = flightPosition(pass, layout, clock.value, laneOffset);
    const tail = Math.max(0, Math.min(1, (clock.value - pass.orbitEndAt) / Math.max(1, pass.landingAt - pass.orbitEndAt)));
    const gone = clock.value >= pass.landingAt;
    const bursts = pass.terminal.kind !== 'toHolding';
    return {
      opacity: gone ? 0 : bursts ? 1 - tail : 1,
      transform: [
        { translateX: point.x - r },
        { translateY: point.y - r },
        { scale: bursts ? 1 + tail * 0.5 : 1 },
      ],
    };
  });

  const halo = useAnimatedStyle(() => {
    const point = flightPosition(pass, layout, clock.value, laneOffset);
    const orbiting = clock.value > pass.liftMs && clock.value < pass.orbitEndAt;
    return {
      opacity: (clock.value >= pass.landingAt ? 0 : orbiting ? 0.28 : 0.16) * trailDepth,
      transform: [{ translateX: point.x - r * 2 }, { translateY: point.y - r * 2 }],
    };
  });

  const [capacity, setCapacity] = useState(pass.charge.capacity);

  useAnimatedReaction(
    () => capacityAt(pass, clock.value),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setCapacity)(current);
      }
    },
    [pass],
  );

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, { width: r * 4, height: r * 4, borderRadius: r * 2, backgroundColor: glow }, halo]}
      />
      <Trail pass={pass} layout={layout} clock={clock} lag={150} depth={0.22 * trailDepth} laneOffset={laneOffset} />
      <Trail pass={pass} layout={layout} clock={clock} lag={280} depth={0.13 * trailDepth} laneOffset={laneOffset} />
      <Animated.View
        pointerEvents="none"
        accessible
        accessibilityLabel={`${orbLabel[pass.charge.color]} charge, capacity ${pass.charge.capacity}`}
        style={[
          styles.charge,
          { width: r * 2, height: r * 2, borderRadius: r, backgroundColor: fill, borderColor: glow },
          body,
        ]}
      >
        <Animated.View style={[styles.gloss, { width: r * 1.1, height: r * 0.8, borderRadius: r, top: r * 0.28, left: r * 0.3 }]} />
        <Text style={[styles.count, { fontSize: r * 1.0 }]}>{capacity}</Text>
        {colorAssist ? (
          <Animated.View style={[styles.assist, { bottom: r * 0.12 }]} pointerEvents="none">
            <ColorAssistMark color={pass.charge.color} size={r * 0.82} etched />
          </Animated.View>
        ) : null}
      </Animated.View>
    </>
  );
});

function Trail({ pass, layout, clock, lag, depth, laneOffset = 0 }: {
  pass: FlightPass; layout: BoardGeometry; clock: SharedValue<number>; lag: number; depth: number; laneOffset?: number;
}) {
  const r = layout.chargeRadius;
  const style = useAnimatedStyle(() => {
    const t = clock.value - lag;
    const visible = clock.value > pass.liftMs + lag && clock.value < pass.orbitEndAt;
    if (!visible) return { opacity: 0, transform: [{ translateX: -999 }, { translateY: -999 }] };
    const point = flightPosition(pass, layout, Math.max(pass.liftMs, t), laneOffset);
    return { opacity: depth, transform: [{ translateX: point.x - r * 0.7 }, { translateY: point.y - r * 0.7 }, { scale: 0.7 }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.trail, { width: r * 1.4, height: r * 1.4, borderRadius: r * 0.7, backgroundColor: orbGlow[pass.charge.color] }, style]}
    />
  );
}

const styles = StyleSheet.create({
  charge: {
    position: 'absolute', left: 0, top: 0, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  gloss: { position: 'absolute', backgroundColor: arcade.glassHi, opacity: 0.55 },
  halo: { position: 'absolute', left: 0, top: 0 },
  trail: { position: 'absolute', left: 0, top: 0 },
  count: { color: '#05060A', fontWeight: '900', textAlign: 'center', padding: 0, width: '100%' },
  assist: { position: 'absolute', alignSelf: 'center' },
});
