import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlayButton } from '@/components/PlayButton';
import { palette } from '@/theme/colors';
import { spacing, typography } from '@/theme/spacing';

interface HomeScreenProps {
  highestUnlockedLevel: number;
  loading: boolean;
  onPlay: () => void;
  /** Dev-only: hidden long-press affordance on the wordmark. */
  onSecretReset?: () => void;
}

export function HomeScreen({
  highestUnlockedLevel,
  loading,
  onPlay,
  onSecretReset,
}: HomeScreenProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.top}>
          <Text
            style={styles.wordmark}
            onLongPress={__DEV__ ? onSecretReset : undefined}
            suppressHighlighting
          >
            ORBITIDE
          </Text>
          <Text style={styles.tagline}>ALIGN THE CORE</Text>
        </View>

        <View style={styles.center}>
          <View style={styles.coreHalo} />
          <View style={styles.core} />
          <Text style={styles.levelLabel}>
            {loading ? ' ' : `LEVEL ${highestUnlockedLevel}`}
          </Text>
        </View>

        <View style={styles.bottom}>
          <PlayButton onPress={onPlay} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.void },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  top: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl },
  wordmark: {
    ...typography.wordmark,
    color: palette.textPrimary,
  },
  tagline: {
    ...typography.label,
    color: palette.textFaint,
  },
  center: { alignItems: 'center', gap: spacing.xl },
  coreHalo: {
    position: 'absolute',
    top: -34,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: palette.coreGlow,
    opacity: 0.12,
  },
  core: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: palette.core,
    shadowColor: palette.coreGlow,
    shadowOpacity: 0.9,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
  },
  levelLabel: {
    ...typography.title,
    color: palette.textSecondary,
    fontSize: 18,
    letterSpacing: 6,
  },
  bottom: { alignItems: 'center', marginBottom: spacing.xl },
});
