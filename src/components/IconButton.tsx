import { Pressable, StyleSheet, Text } from 'react-native';

import { arcade } from '@/theme/arcade';
import { palette } from '@/theme/colors';

interface IconButtonProps {
  glyph: string;
  onPress?: () => void;
  accessibilityLabel: string;
  size?: number;
}

/**
 * The one icon-button pattern (DESIGN.md §8): painted-metal bezel, top-left
 * highlight / bottom-right shadow border, pressed = dim + scale down. Used
 * for every HUD/utility icon control (settings, restart) so none of them
 * invent a second style. `onPress` omitted disables it — the caller doesn't
 * need a separate `disabled` prop.
 */
export function IconButton({ glyph, onPress, accessibilityLabel, size = 40 }: IconButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        { width: size, height: size, borderRadius: size * 0.3 },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
    >
      <Text style={styles.icon}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    borderTopColor: arcade.metalHi,
    borderLeftColor: arcade.metalHi,
    borderRightColor: arcade.metalLo,
    borderBottomColor: arcade.metalLo,
    backgroundColor: arcade.metal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6, transform: [{ scale: 0.96 }] },
  icon: { color: palette.textSecondary, fontSize: 18 },
});
