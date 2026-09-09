import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { ModifierKind } from '@/game/engine/types';
import { cellKey } from '@/game/studio/grid';
import { MODIFIER_KINDS, MODIFIER_SPECS, linkGroups, nextLinkGroup } from '@/game/studio/modifiers';
import type { StudioLevel } from '@/game/studio/types';
import { StudioButton } from './StudioButton';
import { studioSpace, studioTheme } from './theme';

interface ModifierPanelProps {
  level: StudioLevel;
  brush: ModifierKind | null;
  onBrush: (kind: ModifierKind | null) => void;
  selectedCell: { x: number; y: number } | null;
  onRemove: (x: number, y: number) => void;
  onUpdate: (x: number, y: number, patch: { layers?: number; group?: string; timer?: number }) => void;
}

/**
 * Special-pixel authoring. Pick a modifier brush, tap pixels on the MODIFIERS
 * canvas to apply it (or "None" to clear), then tune the selected pixel's
 * config here. A special pixel keeps its base colour — the modifier is a sidecar.
 */
export function ModifierPanel({ level, brush, onBrush, selectedCell, onRemove, onUpdate }: ModifierPanelProps) {
  const selected = selectedCell ? level.modifiers?.[cellKey(selectedCell.x, selectedCell.y)] : undefined;
  const spec = selected ? MODIFIER_SPECS[selected.kind] : null;
  const groups = linkGroups(level);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Brush</Text>
      <View style={styles.brushRow}>
        <StudioButton
          label="None"
          compact
          variant={brush === null ? 'primary' : 'default'}
          onPress={() => onBrush(null)}
        />
        {MODIFIER_KINDS.map((k) => (
          <StudioButton
            key={k}
            label={`${MODIFIER_SPECS[k].marker} ${MODIFIER_SPECS[k].label}`}
            compact
            variant={brush === k ? 'primary' : 'default'}
            onPress={() => onBrush(k)}
          />
        ))}
      </View>
      {brush ? <Text style={styles.hint}>{MODIFIER_SPECS[brush].hint}</Text> : (
        <Text style={styles.hint}>Tap a special pixel to remove its modifier.</Text>
      )}

      <View style={styles.divider} />

      {!selectedCell ? (
        <Text style={styles.hint}>Select a pixel on the canvas to inspect it.</Text>
      ) : !selected ? (
        <Text style={styles.hint}>
          ({selectedCell.x}, {selectedCell.y}) has no modifier.
        </Text>
      ) : (
        <View style={styles.inspector}>
          <Text style={styles.inspectorTitle}>
            {spec!.marker} {spec!.label} @ ({selectedCell.x}, {selectedCell.y})
          </Text>

          {spec!.layers ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{spec!.layers.label} ({spec!.layers.min}–{spec!.layers.max})</Text>
              <View style={styles.stepper}>
                <StudioButton
                  label="–" compact
                  disabled={(selected.config.layers ?? spec!.layers.min) <= spec!.layers.min}
                  onPress={() => onUpdate(selectedCell.x, selectedCell.y, {
                    layers: (selected.config.layers ?? spec!.layers!.default) - 1,
                  })}
                />
                <Text style={styles.stepperValue}>{selected.config.layers ?? spec!.layers.default}</Text>
                <StudioButton
                  label="+" compact
                  disabled={(selected.config.layers ?? spec!.layers.min) >= spec!.layers.max}
                  onPress={() => onUpdate(selectedCell.x, selectedCell.y, {
                    layers: (selected.config.layers ?? spec!.layers!.default) + 1,
                  })}
                />
              </View>
            </View>
          ) : null}

          {spec!.fields.includes('group') ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                {selected.kind === 'linked' ? 'Link group (≥ 2 members)' : 'Lock group (optional)'}
              </Text>
              <TextInput
                value={selected.config.group ?? ''}
                onChangeText={(t) => onUpdate(selectedCell.x, selectedCell.y, { group: t })}
                placeholder={selected.kind === 'linked' ? 'link-1' : 'lock-1'}
                placeholderTextColor={studioTheme.textFaint}
                style={styles.input}
              />
              <View style={styles.groupChips}>
                {selected.kind === 'linked' ? (
                  <StudioButton
                    label={`+ ${nextLinkGroup(level)}`} compact
                    onPress={() => onUpdate(selectedCell.x, selectedCell.y, { group: nextLinkGroup(level) })}
                  />
                ) : null}
                {groups.map((g) => (
                  <StudioButton key={g} label={g} compact onPress={() => onUpdate(selectedCell.x, selectedCell.y, { group: g })} />
                ))}
              </View>
            </View>
          ) : null}

          {spec!.fields.includes('timer') ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Timer (inert placeholder — no rule yet)</Text>
              <TextInput
                value={selected.config.timer !== undefined ? String(selected.config.timer) : ''}
                onChangeText={(t) => {
                  const n = Number.parseInt(t, 10);
                  onUpdate(selectedCell.x, selectedCell.y, { timer: Number.isFinite(n) ? n : undefined });
                }}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
          ) : null}

          {spec!.placeholder ? (
            <Text style={styles.warn}>No gameplay rule is implemented for {spec!.label} yet — this authors visual / metadata state only.</Text>
          ) : null}

          <StudioButton label="Remove modifier" compact variant="danger" onPress={() => onRemove(selectedCell.x, selectedCell.y)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: studioSpace.sm },
  label: { color: studioTheme.textDim, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  brushRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  hint: { color: studioTheme.textFaint, fontSize: 10, fontFamily: studioTheme.mono },
  divider: { height: 1, backgroundColor: studioTheme.border, marginVertical: studioSpace.sm },
  inspector: { gap: studioSpace.sm },
  inspectorTitle: { color: studioTheme.text, fontSize: 12, fontWeight: '700' },
  field: { gap: 4 },
  fieldLabel: { color: studioTheme.textDim, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepperValue: { color: studioTheme.text, fontSize: 13, fontFamily: studioTheme.mono, minWidth: 24, textAlign: 'center' },
  input: {
    borderWidth: 1, borderColor: studioTheme.border, backgroundColor: studioTheme.bg,
    color: studioTheme.text, paddingHorizontal: studioSpace.sm, paddingVertical: 6, borderRadius: 5, fontSize: 13,
  },
  groupChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  warn: { color: studioTheme.warning, fontSize: 10, fontFamily: studioTheme.mono },
});
