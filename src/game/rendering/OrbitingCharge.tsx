import { memo } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import type { FlightPass } from '@/game/presentation/events';
import { capacityAt } from '@/game/presentation/motion';
import { orbColors, orbGlow } from '@/theme/colors';
import type { BoardLayout } from './layout';
import { flightPosition } from './flightGeometry';
const Counter = Animated.createAnimatedComponent(TextInput);
export const OrbitingCharge = memo(function OrbitingCharge({ layout, pass, clock }: {
  layout: BoardLayout; pass: FlightPass; clock: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const point = flightPosition(pass, layout, clock.value);
    const tail = Math.max(0, Math.min(1, (clock.value - pass.orbitEndAt) / (pass.landingAt - pass.orbitEndAt)));
    return { opacity: clock.value >= pass.landingAt ? 0 : pass.endKind === 'burst' ? 1 - tail : 1,
      transform: [{ translateX: point.x - layout.chargeRadius }, { translateY: point.y - layout.chargeRadius },
        { scale: pass.endKind === 'burst' ? 1 + tail * 0.5 : 1 }] };
  });
  const count = useAnimatedProps(() => {
    const text = String(capacityAt(pass, clock.value));
    return { text, defaultValue: text } as TextInputProps & { text: string };
  });
  return <Animated.View pointerEvents="none" style={[styles.charge, {
    width: layout.chargeRadius * 2, height: layout.chargeRadius * 2, borderRadius: layout.chargeRadius,
    backgroundColor: orbColors[pass.charge.color], borderColor: orbGlow[pass.charge.color],
  }, style]}>
    <Counter editable={false} caretHidden accessible={false} pointerEvents="none"
      underlineColorAndroid="transparent" defaultValue={String(pass.charge.capacity)} animatedProps={count}
      style={[styles.count, { fontSize: layout.chargeRadius * 0.95 }]} />
  </Animated.View>;
});
const styles = StyleSheet.create({
  charge: { position: 'absolute', left: 0, top: 0, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  count: { color: '#05060A', fontWeight: '900', textAlign: 'center', padding: 0, width: '100%' },
});
