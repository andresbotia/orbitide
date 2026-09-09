import { StyleSheet, Text, Pressable, View } from 'react-native';

import { studioSpace, studioTheme } from './theme';

export type StudioTab = 'editor' | 'analysis' | 'winPath' | 'failPath' | 'campaign' | 'batch';

export const STUDIO_TABS: { id: StudioTab; label: string }[] = [
  { id: 'editor', label: 'EDITOR' },
  { id: 'analysis', label: 'ANALYSIS' },
  { id: 'winPath', label: 'WIN PATH' },
  { id: 'failPath', label: 'FAIL PATH' },
  { id: 'campaign', label: 'CAMPAIGN' },
  { id: 'batch', label: 'BATCH' },
];

export function StudioTabs({ tab, onTab }: { tab: StudioTab; onTab: (t: StudioTab) => void }) {
  return (
    <View style={styles.row}>
      {STUDIO_TABS.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => onTab(t.id)}
          style={[styles.tab, tab === t.id && styles.active]}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === t.id }}
        >
          <Text style={[styles.label, tab === t.id && styles.activeLabel]}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: studioSpace.lg,
    backgroundColor: studioTheme.panel,
    borderBottomWidth: 1,
    borderBottomColor: studioTheme.border,
  },
  tab: {
    paddingVertical: studioSpace.sm,
    paddingHorizontal: studioSpace.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  active: { borderBottomColor: studioTheme.accent },
  label: { color: studioTheme.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  activeLabel: { color: studioTheme.text },
});
