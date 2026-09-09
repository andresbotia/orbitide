import { Pressable, StyleSheet, Text, View } from 'react-native';

import { arcade } from '@/theme/arcade';
import { spacing } from '@/theme/spacing';

interface ToolBarProps {
  /** Presentation-only for M2A. Booster logic arrives in a later M2 pass. */
  onUndo?: () => void;
  onHint?: () => void;
  onExtraSlot?: () => void;
}

const TOOLS = [
  { key: 'undo', glyph: '⟲', label: 'Undo' },
  { key: 'hint', glyph: '◎', label: 'Scan' },
  { key: 'slot', glyph: '＋', label: 'Slot' },
] as const;

/**
 * Secondary tools: Undo, Scanner/Hint, Extra Slot. Deliberately subordinate to
 * the board and controls. Disabled / presentation-only in M2A — no booster
 * logic, no economy.
 */
export function ToolBar({ onUndo, onHint, onExtraSlot }: ToolBarProps) {
  const handlers: Record<string, (() => void) | undefined> = {
    undo: onUndo,
    hint: onHint,
    slot: onExtraSlot,
  };

  return (
    <View style={styles.row}>
      {TOOLS.map((tool) => (
        <Pressable
          key={tool.key}
          disabled={!handlers[tool.key]}
          onPress={handlers[tool.key]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !handlers[tool.key] }}
          accessibilityLabel={`${tool.label} (coming soon)`}
          style={styles.tool}
        >
          <Text style={styles.glyph}>{tool.glyph}</Text>
          <Text style={styles.label}>{tool.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, opacity: 0.55 },
  tool: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  glyph: { color: arcade.metalEdge, fontSize: 18, lineHeight: 22 },
  label: { color: arcade.metalEdge, fontSize: 9, letterSpacing: 2, fontWeight: '600' },
});
