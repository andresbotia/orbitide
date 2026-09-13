import { Pressable, StyleSheet, Text } from 'react-native';

import { material } from '@/theme/material';

interface IconButtonProps {
  glyph: string;
  onPress?: () => void;
  accessibilityLabel: string;
  size?: number;
}

/**
 * The one icon-button pattern (UI-R8 — migrated off `arcade.*`, closing the
 * shared-icon inconsistency reported across Home/Gameplay HUD/World Select/
 * World Levels). Dimensional Pixel Arcadia bevel: raised by default,
 * recesses on press — the same structural/bevel-highlight/bevel-shadow
 * language as tunnels, holding, and the board frame, so every icon control
 * in the app now belongs to one hardware family.
 *
 * `onPress` omitted both disables it AND dims it — an honest "not yet"
 * affordance (the settings gear today) rather than a control that looks
 * identical to a working one. The glyph itself stays a plain Unicode
 * character for now; only the button treatment around it is new. A owned
 * vector icon set (replacing ⚙/↺/←) is future work, not part of this pass.
 */
export function IconButton({ glyph, onPress, accessibilityLabel, size = 40 }: IconButtonProps) {
  const disabled = !onPress;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        { width: size, height: size, borderRadius: size * 0.3 },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
    >
      <Text style={[styles.icon, disabled && styles.iconDisabled]}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    borderTopColor: material.bevelHighlight,
    borderLeftColor: material.bevelHighlight,
    borderRightColor: material.bevelShadow,
    borderBottomColor: material.bevelShadow,
    backgroundColor: material.structuralSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ translateY: 1 }, { scale: 0.94 }],
    backgroundColor: material.recessedSurface,
  },
  disabled: { opacity: 0.5 },
  icon: { color: material.textSecondary, fontSize: 18 },
  iconDisabled: { color: material.disabled },
});
