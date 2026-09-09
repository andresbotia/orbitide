import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { StudioLevel } from '@/game/studio/types';
import type { LevelStudio } from '@/hooks/useLevelStudio';
import { StudioButton } from './StudioButton';
import { studioSpace, studioTheme } from './theme';

interface RevealPanelProps {
  level: StudioLevel;
  studio: LevelStudio;
}

/**
 * Discovery-reveal authoring. Edits the ONE reveal schema
 * (`name / nodes / lines / accentNodes / collectionId`). Drop nodes by tapping
 * the board in REVEAL canvas mode; wire lines by selecting two nodes here.
 */
export function RevealPanel({ level, studio }: RevealPanelProps) {
  const reveal = level.reveal;

  if (!reveal) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.hint}>
          No authored reveal — the renderer derives a deterministic silhouette. Add one to hand-author the constellation.
        </Text>
        <StudioButton label="Add reveal" compact variant="primary" onPress={studio.startReveal} />
      </View>
    );
  }

  const sel = studio.selectedNode;

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Discovery name</Text>
        <TextInput
          value={reveal.name}
          onChangeText={studio.setRevealName}
          placeholder="THE CRESCENT"
          placeholderTextColor={studioTheme.textFaint}
          style={styles.input}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Collection id (optional)</Text>
        <TextInput
          value={reveal.collectionId ?? ''}
          onChangeText={(t) => studio.setRevealCollectionId(t.trim() === '' ? undefined : t)}
          placeholder="first-light"
          placeholderTextColor={studioTheme.textFaint}
          style={styles.input}
        />
      </View>

      <Text style={styles.sectionLabel}>Nodes ({reveal.nodes.length}) — tap the board in REVEAL mode to add</Text>
      {reveal.nodes.map((n, i) => (
        <View key={i} style={[styles.nodeRow, sel === i && styles.nodeRowSel]}>
          <StudioButton
            label={`#${i} (${round(n.x)}, ${round(n.y)})`}
            compact
            variant={sel === i ? 'primary' : 'default'}
            onPress={() => studio.selectNode(sel === i ? null : i)}
          />
          {(reveal.accentNodes ?? []).includes(i) ? <Text style={styles.accentTag}>accent</Text> : null}
          <View style={styles.spacer} />
          <StudioButton label="▲" compact onPress={() => studio.reorderRevealNodeAt(i, -1)} disabled={i === 0} />
          <StudioButton label="▼" compact onPress={() => studio.reorderRevealNodeAt(i, 1)} disabled={i === reveal.nodes.length - 1} />
          <StudioButton label="accent" compact onPress={() => studio.toggleAccentNodeAt(i)} />
          <StudioButton label="✕" compact variant="danger" onPress={() => studio.deleteRevealNodeAt(i)} />
        </View>
      ))}

      {sel !== null && reveal.nodes[sel] ? (
        <View style={styles.linkHelper}>
          <Text style={styles.hint}>Node #{sel} selected. Use the buttons below to toggle a line or nudge it:</Text>
          <View style={styles.nudgeRow}>
            {reveal.nodes.map((_, j) => (
              j === sel ? null : (
                <StudioButton key={j} label={`↔ #${j}`} compact onPress={() => studio.toggleRevealLineAt(sel, j)} />
              )
            ))}
          </View>
          <View style={styles.nudgeRow}>
            <StudioButton label="← x" compact onPress={() => studio.moveRevealNodeTo(sel, reveal.nodes[sel]!.x - 0.5, reveal.nodes[sel]!.y)} />
            <StudioButton label="x →" compact onPress={() => studio.moveRevealNodeTo(sel, reveal.nodes[sel]!.x + 0.5, reveal.nodes[sel]!.y)} />
            <StudioButton label="↑ y" compact onPress={() => studio.moveRevealNodeTo(sel, reveal.nodes[sel]!.x, reveal.nodes[sel]!.y - 0.5)} />
            <StudioButton label="y ↓" compact onPress={() => studio.moveRevealNodeTo(sel, reveal.nodes[sel]!.x, reveal.nodes[sel]!.y + 0.5)} />
          </View>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Lines ({reveal.lines.length})</Text>
      <View style={styles.lineWrap}>
        {reveal.lines.map(([a, b], i) => (
          <StudioButton key={i} label={`${a}–${b} ✕`} compact onPress={() => studio.deleteRevealLineAt(i)} />
        ))}
      </View>

      <StudioButton label="Remove reveal" compact variant="danger" onPress={studio.removeReveal} />
    </View>
  );
}

const round = (n: number) => Math.round(n * 10) / 10;

const styles = StyleSheet.create({
  wrap: { gap: studioSpace.sm },
  hint: { color: studioTheme.textFaint, fontSize: 10, fontFamily: studioTheme.mono },
  field: { gap: 4 },
  fieldLabel: { color: studioTheme.textDim, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionLabel: { color: studioTheme.textDim, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginTop: studioSpace.sm },
  input: {
    borderWidth: 1, borderColor: studioTheme.border, backgroundColor: studioTheme.bg,
    color: studioTheme.text, paddingHorizontal: studioSpace.sm, paddingVertical: 6, borderRadius: 5, fontSize: 13,
  },
  nodeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap' },
  nodeRowSel: { backgroundColor: studioTheme.panelAlt, borderRadius: 4 },
  accentTag: { color: studioTheme.warning, fontSize: 9, fontFamily: studioTheme.mono },
  spacer: { flex: 1 },
  linkHelper: { gap: 4, padding: studioSpace.sm, backgroundColor: studioTheme.panelAlt, borderRadius: 6 },
  nudgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  lineWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
});
