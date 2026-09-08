import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { FlightPass } from '@/game/presentation/events';
import { FEEL } from '@/game/presentation/constants';
import { orbColors, orbGlow } from '@/theme/colors';

import type { BoardLayout, Point } from './layout';

interface OrbitingChargeProps {
  layout: BoardLayout;
  /** Bumped once per pass; a new value restarts the flight. */
  signal: number;
  pass: FlightPass | null;
  /** Live remaining capacity to show on the charge (updated as pixels pop). */
  capacity: number | null;
}

const TWO_PI = Math.PI * 2;
const BURST_MS = 190;

function fractionToAngle(fraction: number): number {
  // 0 fraction = 12 o'clock = -PI/2 in screen radians; clockwise = increasing.
  return fraction * TWO_PI - Math.PI / 2;
}

function orbitPointAt(layout: BoardLayout, angle: number): Point {
  return {
    x: layout.center.x + Math.cos(angle) * layout.orbit[0]!.rx,
    y: layout.center.y + Math.sin(angle) * layout.orbit[0]!.ry,
  };
}

function OrbitingChargeComponent({
  layout,
  signal,
  pass,
  capacity,
}: OrbitingChargeProps) {
  const clock = useSharedValue(0);

  const geom = useMemo(() => {
    if (!pass) return null;
    const entryAngle = fractionToAngle(pass.entryFraction);
    const entryPoint = orbitPointAt(layout, entryAngle);
    // Tunnel launches start a little outside the orbit so there is a visible
    // "fired onto the track" move; held relaunches rise from below (the tray).
    const origin: Point =
      pass.origin === 'tunnel'
        ? {
            x: layout.center.x + (entryPoint.x - layout.center.x) * 1.22,
            y: layout.center.y + (entryPoint.y - layout.center.y) * 1.22,
          }
        : { x: layout.center.x, y: layout.size + layout.chargeRadius * 2 };
    const endAngle = entryAngle + pass.sweepTurns * TWO_PI;
    const exitPoint = orbitPointAt(layout, endAngle);
    const holdingTarget: Point = {
      x: layout.center.x,
      y: layout.size + layout.chargeRadius * 2.4,
    };
    const endMs = pass.endKind === 'burst' ? BURST_MS : FEEL.HOLDING_TRAVEL_DURATION;
    return {
      entryAngle,
      entryPoint,
      origin,
      exitPoint,
      holdingTarget,
      endMs,
      total: pass.liftMs + pass.orbitMs + endMs,
    };
  }, [pass, layout]);

  useEffect(() => {
    if (!geom || signal === 0) return;
    clock.value = 0;
    clock.value = withTiming(geom.total, {
      duration: geom.total,
      easing: Easing.linear,
    });
  }, [signal, geom, clock]);

  const style = useAnimatedStyle(() => {
    if (!geom || !pass || signal === 0) {
      return { opacity: 0, transform: [{ translateX: -999 }, { translateY: -999 }] };
    }
    const t = clock.value;
    const r = layout.chargeRadius;
    let x: number;
    let y: number;
    let scale = 1;
    let opacity = 1;

    if (t <= pass.liftMs) {
      const p = pass.liftMs === 0 ? 1 : t / pass.liftMs;
      const e = 1 - (1 - p) * (1 - p); // ease-out
      x = geom.origin.x + (geom.entryPoint.x - geom.origin.x) * e;
      y = geom.origin.y + (geom.entryPoint.y - geom.origin.y) * e;
      scale = 0.7 + 0.3 * e;
    } else if (t <= pass.liftMs + pass.orbitMs) {
      const p = (t - pass.liftMs) / pass.orbitMs;
      const angle = geom.entryAngle + p * pass.sweepTurns * TWO_PI;
      x = layout.center.x + Math.cos(angle) * layout.orbit[0]!.rx;
      y = layout.center.y + Math.sin(angle) * layout.orbit[0]!.ry;
    } else {
      const p = Math.min(1, (t - pass.liftMs - pass.orbitMs) / geom.endMs);
      if (pass.endKind === 'burst') {
        x = geom.exitPoint.x;
        y = geom.exitPoint.y;
        scale = 1 + p * 0.6;
        opacity = 1 - p;
      } else {
        x = geom.exitPoint.x + (geom.holdingTarget.x - geom.exitPoint.x) * p;
        y = geom.exitPoint.y + (geom.holdingTarget.y - geom.exitPoint.y) * p;
        scale = 1 - p * 0.5;
        opacity = p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1;
      }
    }

    return {
      opacity: t >= geom.total ? 0 : opacity,
      transform: [
        { translateX: x - r },
        { translateY: y - r },
        { scale },
      ],
    };
  });

  if (!pass) return null;
  const size = layout.chargeRadius * 2;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.charge,
        {
          width: size,
          height: size,
          borderRadius: layout.chargeRadius,
          backgroundColor: orbColors[pass.color],
          borderColor: orbGlow[pass.color],
        },
        style,
      ]}
    >
      {capacity !== null ? (
        <Text style={[styles.count, { fontSize: layout.chargeRadius * 0.95 }]}>
          {capacity}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  charge: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    color: '#05060A',
    fontWeight: '900',
  },
});

export const OrbitingCharge = memo(OrbitingChargeComponent);
