import { memo, useMemo } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { FlightPass } from '@/game/presentation/events';
import { shotsClearedAt } from '@/game/presentation/motion';
import { palBadgeNumeralStyle } from './PixelPalFace';

/**
 * Row height as a multiple of the font size. The row is a real view, so this
 * is the strip's pitch by LAYOUT — never an assumption about a text line box.
 */
const ROW_RATIO = 1.3;

/**
 * A UI-thread integer readout with no animated text props and no React commit
 * when the value changes: fixed-height rows in a clipped window, moved by an
 * animated translate.
 *
 * DEVICE BUG (M5.8B QA) this replaces: the rows used to be lines of one
 * multi-line `Text`, and the strip translated by `digit × round(fontSize ×
 * 1.7)` — an *assumed* line-box height. The real line box differs (platform
 * text metrics, and iOS Dynamic Type scales the font but not the arithmetic),
 * so the window landed between glyphs and showed blank for every digit except
 * `0`, whose offset is ~0. In flight that read as "no count at all, then a
 * glitchy 0 at the end". Rows are now views of an exact height, and the text
 * never scales, so the window always frames exactly one value.
 */
const RollingNumber = memo(function RollingNumber({ rows, index, rowH, width, numeral }: {
  /** Every value this readout can show, in order. */
  rows: readonly string[];
  /** Which row to frame; clamped to `rows`. */
  index: SharedValue<number>;
  rowH: number;
  width: number;
  numeral: TextStyle;
}) {
  const last = rows.length - 1;
  const style = useAnimatedStyle(() => {
    const i = Math.max(0, Math.min(last, Math.round(index.value)));
    return { transform: [{ translateY: -i * rowH }] };
  });
  return (
    <View style={{ height: rowH, width, overflow: 'hidden' }}>
      <Animated.View style={style}>
        {rows.map((row, i) => (
          <View key={i} style={[styles.row, { height: rowH, width }]}>
            {/* `allowFontScaling` off: Dynamic Type must not resize a row. */}
            <Text allowFontScaling={false} style={numeral}>{row}</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
});

/** Strip `lineHeight` — the row view centres the glyph instead. */
function rowText(numeral: TextStyle): TextStyle {
  const { lineHeight: _drop, ...rest } = numeral;
  return { ...rest, includeFontPadding: false, textAlign: 'center' };
}

function metrics(numeral: TextStyle, widestDigits: number) {
  const fontSize = numeral.fontSize as number;
  return {
    rowH: Math.ceil(fontSize * ROW_RATIO),
    width: Math.ceil(fontSize * 0.68 * Math.max(1, widestDigits)) + 2,
    text: rowText(numeral),
  };
}

/**
 * An in-flight Pal's remaining count.
 *
 * The rows ARE the pass's value sequence — its launch capacity followed by the
 * remaining count after each of its shots — so the readout cannot disagree
 * with `capacityAt`: both read the same source. Before the first clear it
 * shows the launch capacity (never 0, never blank), and it steps down on the
 * exact frame each pixel pops, driven by the pass clock on the UI thread.
 *
 * A re-scripted pass rebuilds these rows from the new plan while its already
 * presented prefix is unchanged, so the visible count never jumps backwards.
 */
export const AnimatedCount = memo(function AnimatedCount({ palSize, pass, clock, active = false }: {
  palSize: number;
  pass: FlightPass;
  clock: SharedValue<number>;
  /** Match `PixelPalBadge`'s `active` metrics. */
  active?: boolean;
}) {
  const numeral = palBadgeNumeralStyle(palSize, active);
  const rows = useMemo(
    () => [pass.charge.capacity, ...pass.shots.map((shot) => shot.remaining)].map(String),
    [pass],
  );
  const widest = rows.reduce((w, row) => Math.max(w, row.length), 1);
  const { rowH, width, text } = metrics(numeral, widest);
  // Row i is the count after i shots have landed — the same index `capacityAt`
  // walks to, so no lookup and no drift.
  const index = useDerivedValue(() => shotsClearedAt(pass, clock.value));
  return <RollingNumber rows={rows} index={index} rowH={rowH} width={width} numeral={text} />;
});

const styles = StyleSheet.create({
  row: { alignItems: 'center', justifyContent: 'center' },
});
