import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { LEVEL_DEFINITIONS } from '@/game/levels/levelDefinitions';
import { nextFreeLevelId } from '@/game/studio/constants';
import { duplicateLevel } from '@/game/studio/duplicate';
import { fromLevelDefinition, toLevelDefinition } from '@/game/studio/serialize';
import { useCampaignManifest } from '@/hooks/useCampaignManifest';
import { useLevelAnalysis } from '@/hooks/useLevelAnalysis';
import { useLevelStudio } from '@/hooks/useLevelStudio';
import { STUDIO_NAME } from '@/theme/appIdentity';
import { AnalysisPanel } from '@/components/studio/AnalysisPanel';
import { BatchPanel } from '@/components/studio/BatchPanel';
import { CampaignPanel } from '@/components/studio/CampaignPanel';
import { MetadataPanel } from '@/components/studio/MetadataPanel';
import { ModifierPanel } from '@/components/studio/ModifierPanel';
import { PalettePanel } from '@/components/studio/PalettePanel';
import { PixelCanvas } from '@/components/studio/PixelCanvas';
import { RevealPanel } from '@/components/studio/RevealPanel';
import { SerializedPreview } from '@/components/studio/SerializedPreview';
import { StudioActionBar } from '@/components/studio/StudioActionBar';
import { TransformBar } from '@/components/studio/TransformBar';
import { StudioButton } from '@/components/studio/StudioButton';
import { StudioPlaytest } from '@/components/studio/StudioPlaytest';
import { StudioTabs, type StudioTab } from '@/components/studio/StudioTabs';
import { TunnelQueueEditor } from '@/components/studio/TunnelQueueEditor';
import { ValidationPanel } from '@/components/studio/ValidationPanel';
import { WitnessVisualizer } from '@/components/studio/WitnessVisualizer';
import { studioSpace, studioTheme } from '@/components/studio/theme';

/**
 * Internal ORBITIDE Level Studio. Dev-only, web-only (see `app/studio.tsx`).
 *
 * EDITOR   — create/load, paint, author tunnel queues, validate, export.
 * ANALYSIS — solver-backed difficulty assessment, first moves, seq vs con,
 *            Holding pressure, warnings.
 * WIN/FAIL PATH — step through the real winning / failing witness.
 * BATCH    — audit Levels 1–10.
 */
export function LevelStudioScreen() {
  const studio = useLevelStudio();
  const analysis = useLevelAnalysis(studio.level, studio.report.exportable);
  const campaign = useCampaignManifest(useMemo(() => LEVEL_DEFINITIONS.map((l) => l.id), []));
  const [tab, setTab] = useState<StudioTab>('editor');
  const { width } = useWindowDimensions();
  const wide = width > 960;

  const openLevel = (id: number) => { studio.loadCampaign(id); setTab('editor'); };
  const duplicateFromBrowser = (id: number) => {
    const def = LEVEL_DEFINITIONS.find((l) => l.id === id);
    if (!def) return;
    const nextId = nextFreeLevelId(LEVEL_DEFINITIONS.map((l) => l.id));
    studio.loadStudioLevel(duplicateLevel(fromLevelDefinition(def), { id: nextId }));
    setTab('editor');
  };

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

      <StudioTabs tab={tab} onTab={setTab} />

      {tab === 'editor' ? (
        <View style={[styles.body, wide ? styles.bodyRow : styles.bodyColumn]}>
          <ScrollView style={styles.canvasPane} contentContainerStyle={styles.canvasInner}>
            <View style={styles.canvasTools}>
              <StudioButton label="Undo" compact disabled={!studio.canUndo} onPress={studio.undo} />
              <StudioButton label="Redo" compact disabled={!studio.canRedo} onPress={studio.redo} />
              <StudioButton label="Clear board" compact variant="danger" onPress={studio.clearBoard} />
              <StudioButton label={studio.showCoords ? 'Coords ✓' : 'Coords'} compact onPress={studio.toggleCoords} />
            </View>
            <View style={styles.subTabs}>
              {(['pixels', 'modifiers', 'reveal'] as const).map((m) => (
                <StudioButton
                  key={m}
                  label={m.toUpperCase()}
                  compact
                  variant={studio.canvasMode === m ? 'primary' : 'default'}
                  onPress={() => studio.setCanvasMode(m)}
                />
              ))}
            </View>
            <PixelCanvas
              level={studio.level}
              tool={studio.tool}
              showCoords={studio.showCoords}
              canvasMode={studio.canvasMode}
              selectedCell={studio.selectedCell}
              selectedNode={studio.selectedNode}
              onPaint={studio.paint}
              onErase={studio.erase}
              onModifierCell={studio.applyModifierAt}
              onRevealCell={studio.revealCanvasTap}
            />
          </ScrollView>

          <ScrollView style={[styles.rail, wide ? styles.railWide : styles.railNarrow]} contentContainerStyle={styles.railInner}>
            <Section title="Level settings">
              <MetadataPanel level={studio.level} onMeta={studio.setMetadata} onResize={studio.resize} />
            </Section>
            {studio.canvasMode === 'pixels' ? (
              <Section title="Palette">
                <PalettePanel mode={studio.tool.mode} color={studio.tool.color} onSelectColor={studio.selectColor} onSelectErase={studio.selectErase} />
              </Section>
            ) : null}
            {studio.canvasMode === 'pixels' ? (
              <Section title="Transforms">
                <TransformBar studio={studio} />
              </Section>
            ) : null}
            {studio.canvasMode === 'modifiers' ? (
              <Section title="Special pixels">
                <ModifierPanel
                  level={studio.level}
                  brush={studio.modifierBrush}
                  onBrush={studio.setModifierBrush}
                  selectedCell={studio.selectedCell}
                  onRemove={studio.removeModifierAt}
                  onUpdate={studio.updateModifierAt}
                />
              </Section>
            ) : null}
            {studio.canvasMode === 'reveal' ? (
              <Section title="Discovery reveal">
                <RevealPanel level={studio.level} studio={studio} />
              </Section>
            ) : null}
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
            <Section title="Canonical export">
              <SerializedPreview level={studio.level} exportable={studio.report.exportable} />
            </Section>
          </ScrollView>
        </View>
      ) : (
        <ScrollView style={styles.tabPane} contentContainerStyle={styles.tabInner}>
          {tab === 'analysis' ? <AnalysisPanel ctrl={analysis} exportable={studio.report.exportable} /> : null}
          {tab === 'winPath' ? (
            <WitnessVisualizer key={`win-${analysis.runId}`} trace={analysis.analysis?.winningTrace ?? null} kind="win" emptyMessage={witnessHint(analysis, 'winning')} />
          ) : null}
          {tab === 'failPath' ? (
            <WitnessVisualizer key={`fail-${analysis.runId}`} trace={analysis.analysis?.failingTrace ?? null} kind="fail" emptyMessage={witnessHint(analysis, 'failing')} />
          ) : null}
          {tab === 'campaign' ? (
            <CampaignPanel
              defs={LEVEL_DEFINITIONS}
              ctrl={campaign}
              onOpen={openLevel}
              onDuplicate={duplicateFromBrowser}
              onNew={() => { studio.newLevel(); setTab('editor'); }}
              onImport={(l) => { studio.loadStudioLevel(l); setTab('editor'); }}
            />
          ) : null}
          {tab === 'batch' ? <BatchPanel ctrl={analysis} /> : null}
        </ScrollView>
      )}

      <StudioActionBar level={studio.level} exportable={studio.report.exportable} onPlay={studio.enterPlay} />
    </View>
  );
}

function witnessHint(analysis: ReturnType<typeof useLevelAnalysis>, which: 'winning' | 'failing'): string {
  if (!analysis.analysis) return `Run ANALYSIS first to load the ${which} line.`;
  if (which === 'failing') return 'The solver found no failing line for this level (it cannot be lost).';
  return `This level has no ${which} line.`;
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
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: studioSpace.sm,
    paddingHorizontal: studioSpace.lg, paddingVertical: studioSpace.md,
    borderBottomWidth: 1, borderBottomColor: studioTheme.border, backgroundColor: studioTheme.panel,
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
  subTabs: { flexDirection: 'row', gap: 6 },
  rail: { borderLeftWidth: 1, borderLeftColor: studioTheme.border, backgroundColor: studioTheme.panel },
  railWide: { width: 400 },
  railNarrow: { maxHeight: 520 },
  railInner: { padding: studioSpace.lg, gap: studioSpace.sm, paddingBottom: studioSpace.xl },
  tabPane: { flex: 1 },
  tabInner: { padding: studioSpace.lg, paddingBottom: studioSpace.xl },
  sectionTitle: {
    color: studioTheme.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    textTransform: 'uppercase', marginTop: studioSpace.md,
  },
  section: {
    borderWidth: 1, borderColor: studioTheme.border, borderRadius: 8,
    padding: studioSpace.md, backgroundColor: studioTheme.panelAlt,
  },
});
