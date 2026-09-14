import { memo } from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';

import { WORDMARK_LABEL } from '@/theme/brand';

/**
 * Home title: the raster PIXEL ARCADIA lockup. Replaces the text wordmark on
 * Home only — `PixelArcadiaWordmark` is still the live text lockup everywhere
 * else. Because the title is no longer real text it carries the wordmark's
 * screen-reader label and header role explicitly.
 */

const LOGO_SOURCE = require('../../../assets/pixel-arcadia-logo.png') as number;
/** Intrinsic 506 x 268 (a matching @2x ships alongside it). */
const LOGO_ASPECT = 506 / 268;

interface HomeMarqueeProps {
  /** Rendered logo width in px; height follows the intrinsic aspect ratio. */
  width: number;
  onSecretReset?: () => void;
}

export const HomeMarquee = memo(function HomeMarquee({ width, onSecretReset }: HomeMarqueeProps) {
  return (
    <Pressable
      accessible
      accessibilityRole="header"
      accessibilityLabel={WORDMARK_LABEL}
      onLongPress={onSecretReset}
      disabled={!onSecretReset}
      style={styles.wrap}
    >
      <Image
        source={LOGO_SOURCE}
        resizeMode="contain"
        style={{ width, height: Math.round(width / LOGO_ASPECT) }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
});
