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
 *
 * UI-R9: `calm` (mirrors `OrbitingCharge`'s existing concurrency dimming —
 * previously this component never dimmed at all, the one inconsistency in an
 * otherwise-graceful degrade-under-load story) softens both the streak and
 * the impact flash once several charges share the rail, so five simultaneous
 * flights don't stack into visual noise.
 */
export const EnergyShot = memo(function EnergyShot({ pass, layout, clock, laneOffset = 0, calm = false }: {
  pass: FlightPass; layout: BoardGeometry; clock: SharedValue<number>; laneOffset?: number; calm?: boolean;
}) {
  const depth = calm ? 0.6 : 1;
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
    const t = clock.value;
    if (!shot || t < shot.fireAt || t >= shot.impactAt) return { opacity: 0 };
    const from = flightPosition(pass, layout, shot.fireAt, laneOffset);
    const target = {
      x: layout.gridOrigin.x + (shot.target.x + 0.5) * layout.cell,
      y: layout.gridOrigin.y + (shot.target.y + 0.5) * layout.cell,
    };
    const angle = Math.atan2(target.y - from.y, target.x - from.x);
    const p = Math.max(0, Math.min(1, (t - shot.fireAt) / Math.max(1, shot.impactAt - shot.fireAt)));
    return {
      opacity: depth,
      transform: [
        { translateX: from.x + (target.x - from.x) * p - length / 2 },
        { translateY: from.y + (target.y - from.y) * p - 2 },
        { rotate: `${angle}rad` },
      ],
    };
  });

  const flash = useAnimatedStyle(() => {
    const shot = active.value;
    const t = clock.value;
    if (!shot || t < shot.impactAt || t > shot.clearAt + 120) return { opacity: 0 };
    const pop = Math.max(0, Math.min(1, (t - shot.clearAt) / 120));
    return {
      opacity: (1 - pop) * 0.95 * depth,
      transform: [
        { translateX: layout.gridOrigin.x + shot.target.x * layout.cell - layout.cell * 0.15 },
        { translateY: layout.gridOrigin.y + shot.target.y * layout.cell - layout.cell * 0.15 },
        { scale: 1 + pop * 1.1 },
      ],
    };
  });

  // A brief brighter core at the instant of impact, under the ring flash —
  // reads as a sharper "hit" beat before the ring expands and fades.
  const core = useAnimatedStyle(() => {
    const shot = active.value;
    const t = clock.value;
    if (!shot || t < shot.impactAt || t > shot.clearAt + 70) return { opacity: 0 };
    const pop = Math.max(0, Math.min(1, (t - shot.impactAt) / 70));
    return {
      opacity: (1 - pop) * depth,
      transform: [
        { translateX: layout.gridOrigin.x + shot.target.x * layout.cell + layout.cell * 0.2 },
        { translateY: layout.gridOrigin.y + shot.target.y * layout.cell + layout.cell * 0.2 },
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
