import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { homeAlpha, homeV2 } from '@/theme/homeV2';

interface SettingsPlaceholderScreenProps {
  onBack: () => void;
}

/** Visual Settings destination. No economy, accounts, or gameplay wiring. */
export const SettingsPlaceholderScreen = memo(function SettingsPlaceholderScreen({
  onBack,
}: SettingsPlaceholderScreenProps) {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Text style={styles.backLabel}>‹ Back</Text>
        </Pressable>
        <View style={styles.body}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.copy}>Settings will live here. Nothing is wired yet.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: homeV2.deepNavy },
  safe: { flex: 1 },
  back: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  backLabel: {
    color: homeAlpha(homeV2.white, 0.8),
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    color: homeV2.white,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    fontWeight: '700',
  },
  copy: {
    color: homeAlpha(homeV2.white, 0.7),
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
});
