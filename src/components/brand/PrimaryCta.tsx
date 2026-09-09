import { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { brandColor, brandInk } from '@/theme/brand';
import { BrandGradientView } from './BrandGradientView';

interface PrimaryCtaProps {
  /** Uppercased automatically. PLAY / NEXT / CONTINUE / RETRY. */
  label: string;
  onPress: () => void;
  onPressIn?: () => void;
  disabled?: boolean;
  /** `primary` = the one amber CTA per screen. `secondary` = surface + border. */
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

/**
 * The approved Pixel Arcadia primary call-to-action. One `primary` per screen;
 * PLAY / NEXT / RETRY / CONTINUE all share this exact treatment and nothing else
 * does. Token-driven — no bespoke per-screen button styling.
 *
 *  - primary  : grad.cta fill, inset top highlight + bottom lip, warm drop glow,
 *               ink #2A1405, pressed = +2px / lip removed / glow dimmed (90ms),
 *               disabled = surface fill + secondary ink, no glow.
 *  - secondary: grad.surface fill + 1px border, primary-text ink.
 */
export const PrimaryCta = memo(function PrimaryCta({
  label,
  onPress,
  onPressIn,
  disabled = false,
  variant = 'primary',
  fullWidth = false,
  style,
  accessibilityHint,
}: PrimaryCtaProps) {
  const text = label.toUpperCase();
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      hitSlop={10}
      style={[fullWidth && styles.fullWidth, style]}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.shell,
            fullWidth && styles.fullWidth,
            isPrimary && !disabled && styles.glow,
            isPrimary && pressed && styles.glowPressed,
            pressed && !disabled && styles.pressed,
          ]}
        >
          {disabled ? (
            <View style={[styles.fill, styles.disabledFill]} />
          ) : isPrimary ? (
            <BrandGradientView token="cta" style={styles.fill} />
          ) : (
            <BrandGradientView token="surface" style={[styles.fill, styles.secondaryFill]} />
          )}

          {isPrimary && !disabled ? (
            <>
              <View style={styles.topHighlight} />
              {!pressed ? <View style={styles.bottomLip} /> : null}
            </>
          ) : null}

          <Text
            style={[
              styles.label,
              isPrimary && !disabled ? styles.inkPrimary : styles.inkMuted,
              !isPrimary && !disabled && styles.inkSecondary,
            ]}
          >
            {text}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

const RADIUS = 16;
const MIN_HEIGHT = 52;

const styles = StyleSheet.create({
  fullWidth: { alignSelf: 'stretch' },
  shell: {
    minHeight: MIN_HEIGHT,
    minWidth: 200,
    borderRadius: RADIUS,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pressed: { transform: [{ translateY: 2 }] },
  glow: {
    ...Platform.select({
      ios: {
        shadowColor: '#FF8A1F',
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 20,
        shadowOpacity: 0.32,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  glowPressed: {
    ...Platform.select({
      ios: { shadowOpacity: 0.4, shadowRadius: 14 },
      android: { elevation: 5 },
      default: {},
    }),
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: RADIUS },
  secondaryFill: { borderWidth: 1, borderColor: brandColor.border },
  disabledFill: { backgroundColor: brandColor.surface },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: RADIUS,
    right: RADIUS,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  bottomLip: {
    position: 'absolute',
    bottom: 0,
    left: RADIUS,
    right: RADIUS,
    height: 3,
    backgroundColor: 'rgba(150,70,10,0.4)',
  },
  label: { fontSize: 17, fontWeight: '700', letterSpacing: 17 * 0.16 },
  inkPrimary: { color: brandInk },
  inkMuted: { color: brandColor.textSecondary },
  inkSecondary: { color: brandColor.textPrimary },
});
