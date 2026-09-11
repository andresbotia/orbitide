import { FlatList, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BrandLoader } from '@/components/brand';
import { IconButton } from '@/components/IconButton';
import { WorldCard } from '@/components/campaign/WorldCard';
import type { WorldSummary } from '@/game/levels/campaignProgress';
import { feedback } from '@/game/feedback';
import { arcade } from '@/theme/arcade';
import { spacing, typography } from '@/theme/spacing';

interface WorldSelectScreenProps {
  summaries: WorldSummary[];
  loading: boolean;
  onSelectWorld: (worldId: string) => void;
  onBack: () => void;
}

/**
 * Campaign map: one row per world (never 100 giant level cards). Home → here
 * → a selected world's level grid → the level itself (M4C.11.3).
 */
export function WorldSelectScreen({ summaries, loading, onSelectWorld, onBack }: WorldSelectScreenProps) {
  if (loading) {
    return (
      <View style={styles.root}>
        <BrandLoader fill label="LOADING" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[arcade.envTop, arcade.envMid, arcade.envBottom]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <IconButton glyph="←" onPress={onBack} accessibilityLabel="Back to Home" />
          <Text style={styles.headerTitle}>WORLDS</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={summaries}
          keyExtractor={(s) => s.world.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.duration(220).delay(Math.min(index, 6) * 30)}>
              <WorldCard
                summary={item}
                onPress={() => {
                  feedback.emit('select');
                  onSelectWorld(item.world.id);
                }}
              />
            </Animated.View>
          )}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: arcade.envBottom },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: { ...typography.label, color: arcade.metalEdge, fontSize: 13, letterSpacing: 4 },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
});
