import { Fragment, useMemo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { LEVEL_DEFINITIONS } from '@/game/levels/levelDefinitions';
import { toLevelDefinition } from '@/game/studio/serialize';
import { useLevelStudio } from '@/hooks/useLevelStudio';
import { STUDIO_NAME } from '@/theme/appIdentity';
import { MetadataPanel } from '@/components/studio/MetadataPanel';
import { PalettePanel } from '@/components/studio/PalettePanel';
import { PixelCanvas } from '@/components/studio/PixelCanvas';
import { SerializedPreview } from '@/components/studio/SerializedPreview';
import { SolverPanel } from '@/components/studio/SolverPanel';
import { StudioActionBar } from '@/components/studio/StudioActionBar';
import { StudioButton } from '@/components/studio/StudioButton';
import { StudioPlaytest } from '@/components/studio/StudioPlaytest';
import { TunnelQueueEditor } from '@/components/studio/TunnelQueueEditor';
import { ValidationPanel } from '@/components/studio/ValidationPanel';
import { studioSpace, studioTheme } from '@/components/studio/theme';

/**
 * Internal ORBITIDE Level Studio. Dev-only, web-only (see `app/studio.web.tsx`).
 *
 * A developer can create or load a normal level, paint the board, author all
 * three deterministic tunnel queues, validate it, play it through the REAL game
 * engine, run the REAL solver, and export the canonical production level
 * definition — without hand-editing `levelDefinitions.ts`.
 */
export function LevelStudioScreen() {
  const studio = useLevelStudio();
  const { width } = useWindowDimensions();
  const wide = width > 960;

  const playDefinition = useMemo(
    () => (studio.mode === 'play' && studio.report.exportable ? toLevelDefinition(studio.level) : null),
    [studio.mode, studio.report.exportable, studio.level],
  );

  if (studio.mode === 'play' && playDefinition) {
    return <StudioPlaytest level={playDefinition} onExit={studio.exitPlay} />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{STUDIO_NAME}</Text>
        <Text style={styles.subtitle}>Level {studio.level.id} · {studio.level.title}</Text>
        <View style={styles.spacer} />
        <StudioButton label="New" compact onPress={studio.newLevel} />
        <Text style={styles.loadLabel}>Load</Text>
        {LEVEL_DEFINITIONS.map((def) => (
          <StudioButton key={def.id} label={String(def.id)} compact onPress={() => studio.loadCampaign(def.id)} />
        ))}
      </View>

      <View style={[styles.body, wide ? styles.bodyRow : styles.bodyColumn]}>
        <ScrollView style={styles.canvasPane} contentContainerStyle={styles.canvasInner}>
          <View style={styles.canvasTools}>
            <StudioButton label="Undo" compact disabled={!studio.canUndo} onPress={studio.undo} />
            <StudioButton label="Redo" compact disabled={!studio.canRedo} onPress={studio.redo} />
            <StudioButton label="Clear board" compact variant="danger" onPress={studio.clearBoard} />
            <StudioButton
              label={studio.showCoords ? 'Coords ✓' : 'Coords'}
              compact
              onPress={studio.toggleCoords}
            />
          </View>
          <PixelCanvas
            level={studio.level}
            tool={studio.tool}
            showCoords={studio.showCoords}
            onPaint={studio.paint}
            onErase={studio.erase}
          />
        </ScrollView>

        <ScrollView style={[styles.rail, wide ? styles.railWide : styles.railNarrow]} contentContainerStyle={styles.railInner}>
          <Section title="Level settings">
            <MetadataPanel level={studio.level} onMeta={studio.setMetadata} onResize={studio.resize} />
          </Section>
          <Section title="Palette">
            <PalettePanel
              mode={studio.tool.mode}
              color={studio.tool.color}
              onSelectColor={studio.selectColor}
              onSelectErase={studio.selectErase}
            />
          </Section>
          <Section title="Tunnel queues">
            <TunnelQueueEditor
              level={studio.level}
              onAdd={studio.addCharge}
              onRemove={studio.removeCharge}
              onUpdate={studio.updateCharge}
              onMove={studio.moveCharge}
              onDuplicate={studio.duplicateCharge}
            />
          </Section>
          <Section title="Validation">
            <ValidationPanel report={studio.report} />
          </Section>
          <Section title="Solver">
            <SolverPanel level={studio.level} exportable={studio.report.exportable} />
          </Section>
          <Section title="Canonical export">
            <SerializedPreview level={studio.level} exportable={studio.report.exportable} />
          </Section>
        </ScrollView>
      </View>

      <StudioActionBar level={studio.level} exportable={studio.report.exportable} onPlay={studio.enterPlay} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Fragment>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.section}>{children}</View>
    </Fragment>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: studioTheme.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: studioSpace.sm,
    paddingHorizontal: studioSpace.lg,
    paddingVertical: studioSpace.md,
    borderBottomWidth: 1,
    borderBottomColor: studioTheme.border,
    backgroundColor: studioTheme.panel,
  },
  title: { color: studioTheme.text, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  subtitle: { color: studioTheme.textDim, fontSize: 12, fontFamily: studioTheme.mono },
  spacer: { flex: 1 },
  loadLabel: { color: studioTheme.textFaint, fontSize: 10, letterSpacing: 1, marginLeft: studioSpace.sm },
  body: { flex: 1 },
  bodyRow: { flexDirection: 'row' },
  bodyColumn: { flexDirection: 'column' },
  canvasPane: { flex: 1 },
  canvasInner: { padding: studioSpace.lg, gap: studioSpace.md },
  canvasTools: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rail: { borderLeftWidth: 1, borderLeftColor: studioTheme.border, backgroundColor: studioTheme.panel },
  railWide: { width: 400 },
  railNarrow: { maxHeight: 520 },
  railInner: { padding: studioSpace.lg, gap: studioSpace.sm, paddingBottom: studioSpace.xl },
  sectionTitle: {
    color: studioTheme.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: studioSpace.md,
  },
  section: {
    borderWidth: 1,
    borderColor: studioTheme.border,
    borderRadius: 8,
    padding: studioSpace.md,
    backgroundColor: studioTheme.panelAlt,
  },
});
