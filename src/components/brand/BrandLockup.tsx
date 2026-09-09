import { memo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { WORDMARK_LABEL } from '@/theme/brand';
import { LogoMark, type LogoMarkVariant } from './LogoMark';
import { PixelArcadiaWordmark } from './PixelArcadiaWordmark';

type LockupVariant = 'horizontal' | 'stacked' | 'mark' | 'wordmark';

interface BrandLockupProps {
  variant?: LockupVariant;
  /** Wordmark font size; the mark is sized relative to it. */
  size?: number;
  markVariant?: LogoMarkVariant;
  mono?: boolean | string;
  glow?: boolean;
  style?: ViewStyle;
}

/**
 * Reusable production lockups. Live wordmark text + geometry mark, with the
 * approved proportions baked in. Exact marketing / splash lockups use the static
 * SVGs under `assets/brand/`; these are the responsive in-app equivalents.
 */
export const BrandLockup = memo(function BrandLockup({
  variant = 'horizontal',
  size = 22,
  markVariant = 'full',
  mono = false,
  glow = false,
  style,
}: BrandLockupProps) {
  if (variant === 'wordmark') {
    return <PixelArcadiaWordmark size={size} layout="single" mono={mono} style={style} />;
  }
  if (variant === 'mark') {
    return (
      <LogoMark
        size={size * 2.1}
        variant={markVariant}
        glow={glow}
        accessibilityLabel={WORDMARK_LABEL}
        style={style}
      />
    );
  }

  const markSize = size * 2.1;

  if (variant === 'stacked') {
    return (
      <View style={[styles.stacked, { gap: markSize * 0.34 }, style]}>
        <LogoMark size={markSize} variant={markVariant} glow={glow} accessibilityLabel={null} />
        <PixelArcadiaWordmark size={size} layout="stacked" align="center" mono={mono} />
      </View>
    );
  }

  return (
    <View style={[styles.horizontal, { gap: markSize * 0.3 }, style]}>
      <LogoMark size={markSize} variant={markVariant} glow={glow} accessibilityLabel={null} />
      <PixelArcadiaWordmark size={size} layout="single" mono={mono} />
    </View>
  );
});

const styles = StyleSheet.create({
  horizontal: { flexDirection: 'row', alignItems: 'center' },
  stacked: { flexDirection: 'column', alignItems: 'center' },
});
