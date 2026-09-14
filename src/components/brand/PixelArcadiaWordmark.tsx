import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { brandColor, wordmark, WORDMARK_LABEL } from '@/theme/brand';

type WordmarkLayout = 'single' | 'stacked' | 'compact';

interface PixelArcadiaWordmarkProps {
  /** Font size in px. Clamped to the 15px accessibility floor. */
  size?: number;
  layout?: WordmarkLayout;
  /** Force a single ink for both words (mono contexts). Defaults to the split. */
  mono?: boolean | string;
  align?: 'flex-start' | 'center';
  /** Dev-only affordance reused from the old Home wordmark. */
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Override the default "PIXEL ARCADIA" screen-reader label. */
  accessibilityLabel?: string;
}

/**
 * The live in-app wordmark. Accessible text set in Space Grotesk 700 to
 * visually match the approved outlined brand asset. PIXEL is
 * off-white, ARCADIA is portal amber; equal weight, the distinction is colour +
 * a tighter-than-normal word gap only. Falls back to the system bold face until
 * the font loads. The outlined SVG (`assets/brand/wordmark-*.svg`) is reserved
 * for splash / marketing lockups where exact kerning must not drift. Home is
 * the one screen that does not use this component: its title is the raster
 * lockup in `HomeMarquee`, which carries `WORDMARK_LABEL` as its accessible
 * name.
 */
export const PixelArcadiaWordmark = memo(function PixelArcadiaWordmark({
  size = 28,
  layout = 'single',
  mono = false,
  align = 'flex-start',
  onLongPress,
  style,
  accessibilityLabel = WORDMARK_LABEL,
}: PixelArcadiaWordmarkProps) {
  const fontSize = Math.max(wordmark.minFontSize, size);
  const trackingEm =
    layout === 'stacked'
      ? wordmark.trackingEm.stacked
      : layout === 'compact'
        ? wordmark.trackingEm.compact
        : wordmark.trackingEm.single;
  const letterSpacing = fontSize * trackingEm;

  const primaryColor = mono
    ? typeof mono === 'string'
      ? mono
      : brandColor.textPrimary
    : wordmark.color.primary;
  const accentColor = mono
    ? typeof mono === 'string'
      ? mono
      : brandColor.textPrimary
    : wordmark.color.accent;

  const base = {
    fontFamily: wordmark.fontFamily,
    fontWeight: wordmark.fontWeight,
    fontSize,
    letterSpacing,
    includeFontPadding: false,
  } as const;

  const stacked = layout === 'stacked';

  return (
    <Pressable
      accessible
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel}
      onLongPress={onLongPress}
      disabled={!onLongPress}
      style={[
        stacked ? styles.stacked : styles.row,
        { alignItems: stacked ? align : 'center' },
        style,
      ]}
    >
      <Text
        style={[base, { color: primaryColor }, stacked && { lineHeight: fontSize }]}
        suppressHighlighting
      >
        {wordmark.words.primary}
      </Text>
      {stacked ? null : <View style={{ width: fontSize * wordmark.wordGapEm }} />}
      <Text
        style={[base, { color: accentColor }, stacked && { lineHeight: fontSize }]}
        suppressHighlighting
      >
        {wordmark.words.accent}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  stacked: { flexDirection: 'column' },
});
