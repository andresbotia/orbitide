import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { FlightPass, Shot } from '@/game/presentation/events';
import { orbColors, orbGlow } from '@/theme/colors';
import type { BoardGeometry } from './boardGeometry';
import { flightPosition } from './flightGeometry';

interface PrecomputedShot {
  shot: Shot;
  fromX: number;
  fromY: number;
  dx: number;
  dy: number;
  angle: number;
  duration: number;
  flashX: number;
  flashY: number;
  coreX: number;
  coreY: number;
}

/**
 * Exactly two native views per pass: the projectile streak and the impact flash.
 * The active shot is selected entirely on the UI thread. The streak starts at
 * the charge's ACTUAL rendered position and ends at the exact engine-selected
 * target cell — the player can always see which pixel spent the capacity.
 *
 * Performance: Per-shot flight position, target coordinates, angle, and offsets
 * are precalculated once per pass instead of re-evaluating flightPosition worklets
 * and Math.atan2 on every animation frame. Passes without shots return null.
 */
export const EnergyShot = memo(function EnergyShot(props: {
  pass: FlightPass; layout: BoardGeometry; clock: SharedValue<number>; laneOffset?: number; calm?: boolean;
}) {
  if (props.pass.shots.length === 0) return null;
  return <ActiveEnergyShot {...props} />;
});

const ActiveEnergyShot = memo(function ActiveEnergyShot({ pass, layout, clock, laneOffset = 0, calm = false }: {
  pass: FlightPass; layout: BoardGeometry; clock: SharedValue<number>; laneOffset?: number; calm?: boolean;
}) {
  const depth = calm ? 0.6 : 1;
  const length = Math.min(16, layout.cell * 0.8);
  const color = orbColors[pass.charge.color];

  const precomputed = useMemo<PrecomputedShot[]>(() => {
    return pass.shots.map((shot) => {
      const from = flightPosition(pass, layout, shot.fireAt, laneOffset);
      const targetCenterX = layout.gridOrigin.x + (shot.target.x + 0.5) * layout.cell;
      const targetCenterY = layout.gridOrigin.y + (shot.target.y + 0.5) * layout.cell;
      const dx = targetCenterX - from.x;
      const dy = targetCenterY - from.y;
      const angle = Math.atan2(dy, dx);
      const duration = Math.max(1, shot.impactAt - shot.fireAt);
      const flashX = layout.gridOrigin.x + shot.target.x * layout.cell - layout.cell * 0.15;
      const flashY = layout.gridOrigin.y + shot.target.y * layout.cell - layout.cell * 0.15;
      const coreX = layout.gridOrigin.x + shot.target.x * layout.cell + layout.cell * 0.2;
      const coreY = layout.gridOrigin.y + shot.target.y * layout.cell + layout.cell * 0.2;
      return {
        shot,
        fromX: from.x,
        fromY: from.y,
        dx,
        dy,
        angle,
        duration,
        flashX,
        flashY,
        coreX,
        coreY,
      };
    });
  }, [pass, layout, laneOffset]);

  const active = useDerivedValue(() => {
    let current: PrecomputedShot | null = null;
    for (let i = 0; i < precomputed.length; i++) {
      const ps = precomputed[i]!;
      if (clock.value < ps.shot.anticipateAt) break;
      current = ps;
    }
    return current;
  });

  const streak = useAnimatedStyle(() => {
    const ps = active.value;
    const t = clock.value;
    if (!ps || t < ps.shot.fireAt || t >= ps.shot.impactAt) return { opacity: 0 };
    const p = Math.max(0, Math.min(1, (t - ps.shot.fireAt) / ps.duration));
    return {
      opacity: depth,
      transform: [
        { translateX: ps.fromX + ps.dx * p - length / 2 },
        { translateY: ps.fromY + ps.dy * p - 2 },
        { rotate: `${ps.angle}rad` },
      ],
    };
  });

  const flash = useAnimatedStyle(() => {
    const ps = active.value;
    const t = clock.value;
    if (!ps || t < ps.shot.impactAt || t > ps.shot.clearAt + 120) return { opacity: 0 };
    const pop = Math.max(0, Math.min(1, (t - ps.shot.clearAt) / 120));
    return {
      opacity: (1 - pop) * 0.95 * depth,
      transform: [
        { translateX: ps.flashX },
        { translateY: ps.flashY },
        { scale: 1 + pop * 1.1 },
      ],
    };
  });

  const core = useAnimatedStyle(() => {
    const ps = active.value;
    const t = clock.value;
    if (!ps || t < ps.shot.impactAt || t > ps.shot.clearAt + 70) return { opacity: 0 };
    const pop = Math.max(0, Math.min(1, (t - ps.shot.impactAt) / 70));
    return {
      opacity: (1 - pop) * depth,
      transform: [
        { translateX: ps.coreX },
        { translateY: ps.coreY },
        { scale: 0.6 + pop * 0.7 },
      ],
    };
  });


  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.streak, { width: length, height: 5, borderRadius: 2.5, backgroundColor: color }, streak]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.core,
          { width: layout.cell * 0.6, height: layout.cell * 0.6, borderRadius: layout.cell * 0.3, backgroundColor: '#FFFFFF' },
          core,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.flash,
          {
            width: layout.cell * 1.4,
            height: layout.cell * 1.4,
            borderRadius: layout.cell * 0.45,
            borderWidth: Math.max(2.5, layout.cell * 0.14),
            borderColor: '#FFFFFF',
            backgroundColor: orbGlow[pass.charge.color],
          },
          flash,
        ]}
      />
    </>
  );
});

const styles = StyleSheet.create({
  streak: { position: 'absolute', left: 0, top: 0 },
  core: { position: 'absolute', left: 0, top: 0 },
  flash: { position: 'absolute', left: 0, top: 0 },
});
