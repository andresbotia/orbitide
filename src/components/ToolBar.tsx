import { Pressable, StyleSheet, Text, View } from 'react-native';

import { arcade } from '@/theme/arcade';
import { radius, spacing } from '@/theme/spacing';

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
 * Secondary tools: Undo, Scanner/Hint, Extra Slot. Presentation-only in M2A —
 * no booster logic, no economy. Rendered as dormant hardware — a recessed
 * socket housing present but unlit — rather than a row of floating low-
 * opacity glyphs, so an intentionally-unshipped feature still reads as a
 * designed "not yet" (DESIGN.md §15), the same "structure without the light"
 * idea as `LogoMark`'s `unlit` variant.
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
          <View style={styles.housing}>
            <Text style={styles.glyph}>{tool.glyph}</Text>
          </View>
          <Text style={styles.label}>{tool.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  tool: { alignItems: 'center', gap: 4 },
  housing: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: arcade.metalLo,
    backgroundColor: arcade.socket,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  glyph: { color: arcade.metalEdge, fontSize: 16, opacity: 0.7 },
  label: { color: arcade.metalEdge, fontSize: 9, letterSpacing: 2, fontWeight: '600', opacity: 0.7 },
});
