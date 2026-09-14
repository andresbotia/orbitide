import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { PixelArcadiaWordmark } from '@/components/brand';
import { homeAlpha, homeV2 } from '@/theme/homeV2';

interface HomeMarqueeProps {
  size: number;
  onSecretReset?: () => void;
}

/** Quiet PIXEL ARCADIA wordmark — thin cyan underline, no marquee bubble. */
export const HomeMarquee = memo(function HomeMarquee({ size, onSecretReset }: HomeMarqueeProps) {
  return (
    <View style={styles.wrap}>
      <PixelArcadiaWordmark
        size={size}
        layout="single"
        align="center"
        onLongPress={onSecretReset}
      />
      <View style={styles.rule} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  rule: {
    marginTop: 6,
    width: 88,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: homeAlpha(homeV2.cyan, 0.45),
  },
});
