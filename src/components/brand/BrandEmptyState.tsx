import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { brandColor } from '@/theme/brand';
import { LogoMark } from './LogoMark';

interface BrandEmptyStateProps {
  /** 17px primary headline (one line). */
  title: string;
  /** One line of secondary copy — the state is carried by text, not colour. */
  message?: string;
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
}

/**
 * The shared empty / error / offline treatment: an "unlit portal" (the arch with
 * the core absent) over a headline, one line of copy and an optional secondary
 * button. Same construction for no-content, failed load and offline — only the
 * copy changes. No mascot, no illustration.
 */
export const BrandEmptyState = memo(function BrandEmptyState({
  title,
  message,
  action,
  style,
}: BrandEmptyStateProps) {
  return (
    <View style={[styles.root, style]} accessibilityRole="summary">
      <View style={styles.art} accessible accessibilityRole="image" accessibilityLabel="Unlit portal">
        <LogoMark size={48} variant="mono-dark" ink={brandColor.border} unlit accessibilityLabel={null} />
        <View style={[styles.pixel, { top: 2, left: -10 }]} />
        <View style={[styles.pixel, { bottom: 6, right: -6 }]} />
        <View style={[styles.pixel, { top: 20, right: -14 }]} />
      </View>

      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  art: { width: 48, height: 48, marginBottom: 4 },
  pixel: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 1,
    backgroundColor: brandColor.border,
  },
  title: {
    color: brandColor.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  message: {
    color: brandColor.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 300,
  },
  button: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: brandColor.surface,
    borderWidth: 1,
    borderColor: brandColor.border,
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: {
    color: brandColor.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
  },
});
