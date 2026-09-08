import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { FlightPass, Shot } from '@/game/presentation/events';
import { orbColors } from '@/theme/colors';
import type { BoardLayout } from './layout';
import { flightPosition } from './flightGeometry';
/** Exactly two views per pass; the active shot is selected entirely on the UI thread. */
export const EnergyShot = memo(function EnergyShot({ pass, layout, clock }: {
  pass: FlightPass; layout: BoardLayout; clock: SharedValue<number>;
}) {
  const active = useDerivedValue(() => {
    let current: Shot | null = null;
    for (const shot of pass.shots) {
      if (clock.value < shot.anticipateAt) break;
      current = shot;
    }
    return current;
  });
  const length = Math.min(14, layout.cell * 0.7);
  const streak = useAnimatedStyle(() => {
    const shot = active.value;
    if (!shot) return { opacity: 0 };
    const from = flightPosition(pass, layout, shot.fireAt);
    const target = { x: layout.gridOrigin.x + (shot.target.x + 0.5) * layout.cell,
      y: layout.gridOrigin.y + (shot.target.y + 0.5) * layout.cell };
    const angle = Math.atan2(target.y - from.y, target.x - from.x);
    const t = clock.value;
    const p = Math.max(0, Math.min(1, (t - shot.fireAt) / (shot.impactAt - shot.fireAt)));
    return { opacity: t >= shot.fireAt && t < shot.impactAt ? 1 : 0,
      transform: [{ translateX: from.x + (target.x - from.x) * p - length / 2 },
        { translateY: from.y + (target.y - from.y) * p - 1.5 }, { rotate: `${angle}rad` }] };
  });
  const flash = useAnimatedStyle(() => {
    const shot = active.value;
    if (!shot) return { opacity: 0 };
    const t = clock.value;
    const pop = Math.max(0, Math.min(1, (t - shot.clearAt) / 100));
    return { opacity: t < shot.impactAt ? 0.35 : (1 - pop) * 0.9,
      transform: [{ translateX: layout.gridOrigin.x + shot.target.x * layout.cell },
        { translateY: layout.gridOrigin.y + shot.target.y * layout.cell },
        { scale: t < shot.clearAt ? 1.06 : 1.06 + pop * 0.7 }] };
  });
  return <>
    <Animated.View pointerEvents="none" style={[styles.effect,
      { width: length, height: 3, borderRadius: 2, backgroundColor: orbColors[pass.charge.color] }, streak]} />
    <Animated.View pointerEvents="none" style={[styles.effect, {
      width: layout.cell, height: layout.cell, borderRadius: 3, borderWidth: 2, borderColor: '#FFFFFF',
    }, flash]} />
  </>;
});
const styles = StyleSheet.create({ effect: { position: 'absolute', left: 0, top: 0 } });
