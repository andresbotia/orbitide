import { Pressable, StyleSheet, Text } from 'react-native';

import { studioSpace, studioTheme } from './theme';

interface StudioButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'danger';
  compact?: boolean;
}

/** One plain button style for every Studio control. */
export function StudioButton({ label, onPress, disabled, variant = 'default', compact }: StudioButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        variant === 'primary' && styles.primary,
        variant === 'danger' && styles.danger,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, variant === 'primary' && styles.primaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: studioSpace.sm,
    paddingHorizontal: studioSpace.md,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: studioTheme.borderStrong,
    backgroundColor: studioTheme.panelAlt,
    alignItems: 'center',
  },
  compact: { paddingVertical: studioSpace.xs, paddingHorizontal: studioSpace.sm },
  primary: { backgroundColor: studioTheme.accent, borderColor: studioTheme.accent },
  danger: { borderColor: studioTheme.error },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  label: { color: studioTheme.text, fontSize: 12, fontWeight: '600' },
  primaryLabel: { color: studioTheme.accentText },
});
