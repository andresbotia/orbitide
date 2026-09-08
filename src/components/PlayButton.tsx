import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/theme/colors';
import { radius, spacing, typography } from '@/theme/spacing';

interface PlayButtonProps {
  label?: string;
  onPress: () => void;
}

export function PlayButton({ label = 'PLAY', onPress }: PlayButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <View style={styles.glow} />
      <View style={styles.button}>
        <Text style={styles.text}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  glow: {
    position: 'absolute',
    width: 220,
    height: 80,
    borderRadius: radius.pill,
    backgroundColor: palette.coreGlow,
    opacity: 0.18,
  },
  button: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xxl + spacing.md,
    borderRadius: radius.pill,
    backgroundColor: palette.core,
  },
  text: {
    ...typography.label,
    color: palette.void,
    fontSize: 16,
    letterSpacing: 4,
  },
});
