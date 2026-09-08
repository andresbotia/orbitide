import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Charge } from '@/game/engine/types';
import type { Point } from '@/game/presentation/events';
import { orbColors, orbLabel, palette } from '@/theme/colors';
import { spacing, typography } from '@/theme/spacing';
interface HoldingTrayProps {
  holding: Charge[]; capacity: number; overflow: boolean; disabled: boolean;
  usefulIds: Set<string>;
  onLaunch: (id: string) => void;
  onSourceLayout: (key: string, point: Point) => void;
  message: string;
  layoutVersion: number;
}
export function HoldingTray({ holding, capacity, overflow, disabled, usefulIds, onLaunch, onSourceLayout, message, layoutVersion }: HoldingTrayProps) {
  const slots = useRef<(View | null)[]>([]);
  useEffect(() => {
    slots.current.forEach((node, index) => node?.measureInWindow((x, y, width, height) =>
      onSourceLayout(`holding-${index}`, { x: x + width / 2, y: y + height / 2 })));
  }, [layoutVersion, onSourceLayout]);
  return <View style={styles.container}>
    <Text style={[styles.label, holding.length >= 2 && { color: palette.warning }]}>
      HOLDING {holding.length}/{capacity}
    </Text>
    <View style={styles.row}>{Array.from({ length: capacity }, (_, index) => {
      const charge = holding[index];
      const useful = !!charge && usefulIds.has(charge.id);
      return <Pressable key={index} ref={(node) => { slots.current[index] = node; }} collapsable={false}
        onLayout={() => slots.current[index]?.measureInWindow((x, y, width, height) =>
          onSourceLayout(`holding-${index}`, { x: x + width / 2, y: y + height / 2 }))}
        disabled={disabled || !charge} onPressIn={() => charge && onLaunch(charge.id)}
        accessibilityRole="button" accessibilityState={{ disabled: disabled || !charge }}
        accessibilityLabel={charge ? `Relaunch ${orbLabel[charge.color]} charge, capacity ${charge.capacity}` : `Holding slot ${index + 1}, empty`}
        accessibilityHint={useful ? 'Tap to launch again' : 'No exposed matching pixels yet'}
        style={({ pressed }) => [styles.slot, useful && styles.ready, overflow && styles.failed,
          pressed && { transform: [{ scale: 0.94 }], backgroundColor: palette.surfaceBorder }]}>
        {charge ? <View style={[styles.charge, { backgroundColor: orbColors[charge.color], opacity: useful ? 1 : 0.65 }]}>
          <Text style={styles.count}>{charge.capacity}</Text>
        </View> : null}
      </Pressable>;
    })}</View>
    <Text accessibilityLiveRegion="polite" style={styles.help}>{message || (holding.length ? 'Tap a held charge to launch it again.' : ' ')}</Text>
  </View>;
}
const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm },
  label: { ...typography.label, color: palette.textFaint },
  row: { flexDirection: 'row', gap: spacing.md },
  slot: { width: 54, height: 54, borderRadius: 12, borderWidth: 1, borderColor: palette.surfaceBorder,
    backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  ready: { borderColor: palette.coreGlow, borderWidth: 2 },
  failed: { borderColor: palette.danger },
  charge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  count: { color: '#05060A', fontSize: 16, fontWeight: '800' },
  help: { color: palette.textSecondary, fontSize: 12, minHeight: 16, textAlign: 'center', paddingHorizontal: 12 },
});
