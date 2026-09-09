import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { FlightPass, Shot } from '@/game/presentation/events';
import { orbColors, orbGlow } from '@/theme/colors';
import type { BoardGeometry } from './boardGeometry';
import { flightPosition } from './flightGeometry';

/**
 * Exactly two native views per pass: the projectile streak and the impact flash.
 * The active shot is selected entirely on the UI thread. The streak starts at
 * the charge's ACTUAL rendered position and ends at the exact engine-selected
 * target cell — the player can always see which pixel spent the capacity.
 */
export const EnergyShot = memo(function EnergyShot({ pass, layout, clock, laneOffset = 0 }: {
  pass: FlightPass; layout: BoardGeometry; clock: SharedValue<number>; laneOffset?: number;
}) {
  const active = useDerivedValue(() => {
    let current: Shot | null = null;
    for (const shot of pass.shots) {
      if (clock.value < shot.anticipateAt) break;
      current = shot;
    }
    return current;
  });

  const length = Math.min(16, layout.cell * 0.8);
  const color = orbColors[pass.charge.color];

  const streak = useAnimatedStyle(() => {
    const shot = active.value;
    if (!shot) return { opacity: 0 };
    const from = flightPosition(pass, layout, shot.fireAt, laneOffset);
    const target = {
      x: layout.gridOrigin.x + (shot.target.x + 0.5) * layout.cell,
      y: layout.gridOrigin.y + (shot.target.y + 0.5) * layout.cell,
    };
    const angle = Math.atan2(target.y - from.y, target.x - from.x);
    const t = clock.value;
    const p = Math.max(0, Math.min(1, (t - shot.fireAt) / Math.max(1, shot.impactAt - shot.fireAt)));
    return {
      opacity: t >= shot.fireAt && t < shot.impactAt ? 1 : 0,
      transform: [
        { translateX: from.x + (target.x - from.x) * p - length / 2 },
        { translateY: from.y + (target.y - from.y) * p - 2 },
        { rotate: `${angle}rad` },
      ],
    };
  });

  const flash = useAnimatedStyle(() => {
    const shot = active.value;
    if (!shot) return { opacity: 0 };
    const t = clock.value;
    const pop = Math.max(0, Math.min(1, (t - shot.clearAt) / 120));
    return {
      opacity: t < shot.impactAt ? 0 : (1 - pop) * 0.95,
      transform: [
        { translateX: layout.gridOrigin.x + shot.target.x * layout.cell - layout.cell * 0.15 },
        { translateY: layout.gridOrigin.y + shot.target.y * layout.cell - layout.cell * 0.15 },
        { scale: 1 + pop * 0.9 },
      ],
    };
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.streak, { width: length, height: 4, borderRadius: 2, backgroundColor: color }, streak]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.flash,
          {
            width: layout.cell * 1.3,
            height: layout.cell * 1.3,
            borderRadius: layout.cell * 0.4,
            borderWidth: Math.max(2, layout.cell * 0.12),
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
  flash: { position: 'absolute', left: 0, top: 0 },
});
