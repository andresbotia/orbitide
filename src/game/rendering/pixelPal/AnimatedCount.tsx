import { memo } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { FlightPass } from '@/game/presentation/events';
import { capacityAt } from '@/game/presentation/motion';
import { palBadgeNumeralStyle } from './PixelPalFace';

const DIGITS = '0\n1\n2\n3\n4\n5\n6\n7\n8\n9';
/** Strip line pitch vs font size — far enough apart that no neighbour digit peeks into the window. */
const STRIP_PITCH = 1.7;
/** Extra window height so an outlined (plate-less) numeral's shadow is not clipped. */
const WINDOW_PAD = 2;

/**
 * An in-flight Pal's remaining count, driven entirely on the UI thread from
 * the pass clock (`capacityAt`), so it changes on the same frame as the pixel
 * pop and costs no React commit per hit.
 */
export const AnimatedCount = memo(function AnimatedCount({ palSize, pass, clock, active = false }: {
  palSize: number;
  pass: FlightPass;
  clock: SharedValue<number>;
  /** Match `PixelPalBadge`'s `active` metrics. */
  active?: boolean;
}) {
  const numeral = palBadgeNumeralStyle(palSize, active);
  const count = useDerivedValue(() => capacityAt(pass, clock.value));
  return (
    <DigitStrip
      count={count}
      columns={String(Math.max(0, pass.charge.capacity)).length}
      numeral={numeral}
      padded={!!numeral.textShadowColor}
    />
  );
});

/**
 * A UI-thread integer readout with no animated text props: each digit is a
 * 0–9 strip in a clipped window, positioned by an animated translate. Fewer
 * digits than `columns` keep the visible digits centred. Shared by the Pal
 * count badge and the board's combo counter.
 */
export const DigitStrip = memo(function DigitStrip({ count, columns, numeral, padded = false }: {
  count: SharedValue<number>;
  columns: number;
  /** Must set `fontSize` and `lineHeight`. */
  numeral: TextStyle;
  /** Leave room for a text shadow (plate-less numerals). */
  padded?: boolean;
}) {
  const fontSize = numeral.fontSize as number;
  const windowH = (numeral.lineHeight as number) + (padded ? WINDOW_PAD * 2 : 2);
  const pitch = Math.round(fontSize * STRIP_PITCH);
  const digitW = Math.ceil(fontSize * 0.66);

  const rowStyle = useAnimatedStyle(() => {
    let visible = 1;
    for (let place = 10; place <= count.value && visible < columns; place *= 10) visible += 1;
    return { transform: [{ translateX: -((columns - visible) * digitW) / 2 }] };
  });

  return (
    <View style={{ height: windowH, width: digitW * columns, overflow: 'hidden' }}>
      <Animated.View style={[styles.row, rowStyle]}>
        {Array.from({ length: columns }, (_, i) => (
          <DigitColumn
            key={i}
            place={10 ** (columns - 1 - i)}
            count={count}
            width={digitW}
            pitch={pitch}
            windowH={windowH}
            numeral={numeral}
          />
        ))}
      </Animated.View>
    </View>
  );
});

function DigitColumn({ place, count, width, pitch, windowH, numeral }: {
  place: number;
  count: SharedValue<number>;
  width: number;
  pitch: number;
  windowH: number;
  numeral: TextStyle;
}) {
  const style = useAnimatedStyle(() => {
    const value = Math.max(0, Math.floor(count.value));
    const digit = Math.floor(value / place) % 10;
    return {
      opacity: place === 1 || value >= place ? 1 : 0,
      transform: [{ translateY: -digit * pitch - (pitch - windowH) / 2 }],
    };
  });
  return (
    <Animated.View style={[{ width }, style]}>
      <Text style={[numeral, { width, lineHeight: pitch }]}>{DIGITS}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
