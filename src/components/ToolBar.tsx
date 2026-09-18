import { Pressable, StyleSheet, Text, View } from 'react-native';

import { material } from '@/theme/material';
import { radius, spacing, typography } from '@/theme/spacing';

interface ToolBarProps {
  /** Presentation-only — booster gameplay/economy is separate roadmap work, not this redesign. */
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
 * @deprecated Replaced by ItemRack.tsx in the control deck. Retained for reference.
 *
 * Secondary tools: Undo, Scanner/Hint, Extra Slot (UI-R8 — Pixel Arcadia
 * materials; still presentation-only).
 */
export function ToolBar({ onUndo, onHint, onExtraSlot }: ToolBarProps) {
  const handlers: Record<string, (() => void) | undefined> = {
    undo: onUndo,
    hint: onHint,
    slot: onExtraSlot,
  };

  return (
    <View style={styles.row}>
      {TOOLS.map((tool) => {
        const active = !!handlers[tool.key];
        return (
          <Pressable
            key={tool.key}
            disabled={!active}
            onPress={handlers[tool.key]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !active }}
            accessibilityLabel={active ? tool.label : `${tool.label} (coming soon)`}
            style={styles.tool}
          >
            <View style={[styles.housing, !active && styles.housingDormant]}>
              <Text style={[styles.glyph, !active && styles.glyphDormant]}>{tool.glyph}</Text>
              {/* Reserved, empty — a future quantity badge lands here without a layout change. */}
              <View style={styles.badgeSlot} />
            </View>
            <Text style={[styles.label, !active && styles.labelDormant]}>{tool.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const SIZE = 40;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  tool: { alignItems: 'center', gap: 4 },
  housing: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderTopColor: material.bevelHighlight,
    borderLeftColor: material.bevelHighlight,
    borderRightColor: material.bevelShadow,
    borderBottomColor: material.bevelShadow,
    backgroundColor: material.structuralSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  housingDormant: {
    backgroundColor: material.recessedSurface,
    borderTopColor: material.outline,
    borderLeftColor: material.outline,
  },
  glyph: { color: material.textSecondary, fontSize: 16 },
  glyphDormant: { color: material.disabled },
  badgeSlot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: material.outline,
    borderStyle: 'dashed',
    opacity: 0.5,
  },
  label: { ...typography.metadata, color: material.textSecondary, letterSpacing: 2 },
  labelDormant: { color: material.disabled },
});
