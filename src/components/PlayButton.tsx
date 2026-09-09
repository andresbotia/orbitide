import { Pressable, StyleSheet, Text, View } from 'react-native';

import { arcade } from '@/theme/arcade';
import { palette } from '@/theme/colors';
import { typography } from '@/theme/spacing';

interface PlayButtonProps {
  label?: string;
  onPress: () => void;
  /** Fired on touch-down for immediate feedback (haptic / activation). */
  onPressIn?: () => void;
  disabled?: boolean;
}

/**
 * The physical PLAY control — same painted-metal material family as the launch
 * tunnels. It sits on a shadow plate and depresses onto it when pressed
 * (travel + shadow reduce), with restrained static illumination. Not a flat
 * rounded rectangle, and it does not pulse.
 */
export function PlayButton({ label = 'PLAY', onPress, onPressIn, disabled }: PlayButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={12}
      style={styles.root}
    >
      {({ pressed }) => (
        <>
          <View style={[styles.glow, pressed && styles.glowPressed]} />
          <View style={styles.plate} />
          <View style={[styles.button, pressed && styles.buttonPressed]}>
            <View style={styles.face}>
              <Text style={styles.text}>{label}</Text>
            </View>
          </View>
        </>
      )}
    </Pressable>
  );
}

const WIDTH = 236;
const HEIGHT = 66;

const styles = StyleSheet.create({
  root: { width: WIDTH, height: HEIGHT + 10, alignItems: 'center', justifyContent: 'flex-start' },
  glow: {
    position: 'absolute',
    top: 4,
    width: WIDTH + 24,
    height: HEIGHT + 12,
    borderRadius: (HEIGHT + 12) / 2,
    backgroundColor: arcade.accent,
    opacity: 0.14,
  },
  glowPressed: { opacity: 0.09 },
  plate: {
    position: 'absolute',
    top: 8,
    width: WIDTH,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    backgroundColor: arcade.metalLo,
  },
  button: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    padding: 3,
    backgroundColor: arcade.metalEdge,
    borderWidth: 1,
    borderTopColor: arcade.metalHi,
    borderLeftColor: arcade.metalHi,
    borderRightColor: arcade.metalLo,
    borderBottomColor: arcade.metalLo,
  },
  buttonPressed: { transform: [{ translateY: 6 }] },
  face: {
    flex: 1,
    borderRadius: HEIGHT / 2,
    backgroundColor: arcade.metalRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderTopColor: 'rgba(190,214,255,0.22)',
    borderBottomColor: arcade.metalLo,
  },
  text: {
    ...typography.label,
    color: palette.textPrimary,
    fontSize: 18,
    letterSpacing: 6,
  },
});
