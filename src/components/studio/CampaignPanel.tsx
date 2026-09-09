import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { LevelDefinition } from '@/game/engine/types';
import { batchValidate } from '@/game/studio/batchValidate';
import { unassignedLevelIds } from '@/game/studio/campaign/manifest';
import { serializeManifestJSON, serializeManifestTS } from '@/game/studio/campaign/serialize';
import { exportCampaignBundle, exportLevelsJSON, importStudioJSON } from '@/game/studio/io';
import type { BatchLevelAnalysisSlice } from '@/game/studio/batchValidate';
import type { CampaignManifestController } from '@/hooks/useCampaignManifest';
import type { BrowserAnalysisSlice } from '@/game/studio/browser';
import type { StudioLevel } from '@/game/studio/types';
import { LevelBrowser } from './LevelBrowser';
import { StudioButton } from './StudioButton';
import { studioSpace, studioTheme } from './theme';

interface CampaignPanelProps {
  defs: LevelDefinition[];
  ctrl: CampaignManifestController;
  analyses?: Map<number, BrowserAnalysisSlice>;
  onOpen: (id: number) => void;
  onDuplicate: (id: number) => void;
  onNew: () => void;
  onImport?: (level: StudioLevel) => void;
}

function analysesToBatch(
  analyses?: Map<number, BrowserAnalysisSlice>,
): Map<number, BatchLevelAnalysisSlice> | undefined {
  if (!analyses) return undefined;
  const out = new Map<number, BatchLevelAnalysisSlice>();
  for (const [id, a] of analyses) {
    const slice: BatchLevelAnalysisSlice = {};
    if (a.solvable !== undefined) slice.solvable = a.solvable;
    if (a.suggestedDifficulty) slice.suggestedDifficulty = a.suggestedDifficulty;
    out.set(id, slice);
  }
  return out;
}

/**
 * The CAMPAIGN tab: browse the whole campaign, organise levels into worlds /
 * sets, and export a deterministic campaign manifest. No backend — the developer
 * commits the exported data.
 */
export function CampaignPanel({ defs, ctrl, analyses, onOpen, onDuplicate, onNew, onImport }: CampaignPanelProps) {
  const { manifest, report } = ctrl;
  const [newWorld, setNewWorld] = useState('');
  const [format, setFormat] = useState<'ts' | 'json'>('ts');
  const [flash, setFlash] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const unassigned = useMemo(() => unassignedLevelIds(manifest), [manifest]);
  const batch = useMemo(
    () => batchValidate({ defs, manifest, analyses: analysesToBatch(analyses) }),
    [defs, manifest, analyses],
  );

  const note = (m: string) => { setFlash(m); setTimeout(() => setFlash((c) => (c === m ? null : c)), 2500); };
  const text = format === 'ts' ? serializeManifestTS(manifest) : serializeManifestJSON(manifest);
  const write = async (payload: string, what: string) => {
    try { await navigator.clipboard.writeText(payload); note(`Copied ${what}`); }
    catch { note('Clipboard blocked — select the preview text'); }
  };
  const copy = () => write(text, 'manifest');

  return (
    <View style={styles.wrap}>
      <Text style={styles.h}>Worlds / sets</Text>
      <View style={styles.newWorld}>
        <TextInput
          value={newWorld} onChangeText={setNewWorld} placeholder="New world title"
          placeholderTextColor={studioTheme.textFaint} style={styles.input}
        />
        <StudioButton label="Add world" compact onPress={() => { if (newWorld.trim()) { ctrl.addWorld(newWorld.trim()); setNewWorld(''); } }} />
        <StudioButton label="Reset" compact variant="danger" onPress={ctrl.reset} />
      </View>

      {manifest.worlds.map((w, i) => (
        <View key={w.id} style={styles.world}>
          <View style={styles.worldHead}>
            <TextInput
              value={w.title}
              onChangeText={(t) => ctrl.renameWorld(w.id, t)}
              style={[styles.input, styles.worldTitle]}
            />
            <StudioButton label="▲" compact disabled={i === 0} onPress={() => ctrl.reorderWorld(w.id, -1)} />
            <StudioButton label="▼" compact disabled={i === manifest.worlds.length - 1} onPress={() => ctrl.reorderWorld(w.id, 1)} />
            <StudioButton label="✕" compact variant="danger" onPress={() => ctrl.removeWorld(w.id)} />
          </View>
          <TextInput
            value={w.themeId ?? ''}
            onChangeText={(t) => ctrl.setWorldTheme(w.id, t.trim() === '' ? undefined : t)}
            placeholder="themeId (optional)"
            placeholderTextColor={studioTheme.textFaint}
            style={styles.input}
          />
          <View style={styles.levelChips}>
            {w.levelIds.map((id, j) => (
              <View key={id} style={styles.chip}>
                <StudioButton label={`#${id}`} compact onPress={() => onOpen(id)} />
                <StudioButton label="◀" compact disabled={j === 0} onPress={() => ctrl.reorderLevelInWorld(w.id, id, -1)} />
                <StudioButton label="▶" compact disabled={j === w.levelIds.length - 1} onPress={() => ctrl.reorderLevelInWorld(w.id, id, 1)} />
                <StudioButton label="−" compact onPress={() => ctrl.unassignLevel(id)} />
              </View>
            ))}
          </View>
        </View>
      ))}

      {unassigned.length > 0 ? (
        <View style={styles.world}>
          <Text style={styles.sub}>Unassigned</Text>
          <View style={styles.levelChips}>
            {unassigned.map((id) => (
              <View key={id} style={styles.chip}>
                <Text style={styles.chipId}>#{id} →</Text>
                {manifest.worlds.map((w) => (
                  <StudioButton key={w.id} label={w.title} compact onPress={() => ctrl.assignLevel(id, w.id)} />
                ))}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.reportRow}>
        <Text style={report.ok ? styles.ok : styles.err}>
          {report.ok ? 'manifest valid' : `${report.errors.length} error(s)`} · {report.warnings.length} warning(s)
        </Text>
      </View>
      {[...report.errors, ...report.warnings].slice(0, 8).map((iss, i) => (
        <Text key={i} style={iss.severity === 'error' ? styles.err : styles.warn}>· {iss.message}</Text>
      ))}

      <View style={styles.exportRow}>
        <StudioButton label="TS" compact variant={format === 'ts' ? 'primary' : 'default'} onPress={() => setFormat('ts')} />
        <StudioButton label="JSON" compact variant={format === 'json' ? 'primary' : 'default'} onPress={() => setFormat('json')} />
        <StudioButton label="Copy manifest" compact onPress={copy} />
        <StudioButton label="Copy campaign bundle" compact onPress={() => write(exportCampaignBundle(manifest, defs), 'campaign bundle')} />
        <StudioButton label="Copy all levels (JSON)" compact onPress={() => write(exportLevelsJSON(defs), 'levels JSON')} />
        {flash ? <Text style={styles.ok}>{flash}</Text> : null}
      </View>
      <ScrollView horizontal style={styles.code}>
        <Text selectable style={styles.codeText}>{text}</Text>
      </ScrollView>

      <Text style={styles.h}>Batch validation</Text>
      <Text style={batch.ok ? styles.ok : styles.err}>
        {batch.summary.total} levels · {batch.summary.invalid} invalid · {batch.summary.withWarnings} with warnings
        {batch.summary.unsolvable ? ` · ${batch.summary.unsolvable} unsolvable` : ''}
        {batch.summary.difficultyMismatches ? ` · ${batch.summary.difficultyMismatches} difficulty mismatch` : ''}
      </Text>
      {[...batch.campaignIssues, ...batch.manifestIssues.map((i) => ({ severity: i.severity, message: i.message }))].slice(0, 6).map((iss, i) => (
        <Text key={`c${i}`} style={iss.severity === 'error' ? styles.err : styles.warn}>· {iss.message}</Text>
      ))}
      {batch.levels.filter((l) => !l.ok).slice(0, 10).map((l) => (
        <Text key={l.levelId} style={styles.err}>
          · #{l.levelId} {l.title}: {[...l.errors.map((e) => e.code), ...l.analysisFindings.filter((f) => f.severity === 'error').map((f) => f.code)].join(', ')}
        </Text>
      ))}

      <Text style={styles.h}>Import Studio JSON</Text>
      <TextInput
        value={importText}
        onChangeText={setImportText}
        placeholder='Paste a level, an array, or a { manifest, levels } bundle'
        placeholderTextColor={studioTheme.textFaint}
        multiline
        style={[styles.input, styles.importBox]}
      />
      <View style={styles.exportRow}>
        <StudioButton
          label="Validate + import"
          compact
          onPress={() => {
            const r = importStudioJSON(importText);
            setImportMsg(r.ok
              ? `OK — ${r.levels.length} level(s)${r.manifest ? ' + manifest' : ''}${r.warnings.length ? `, ${r.warnings.length} warning(s)` : ''}`
              : `Rejected: ${r.errors.slice(0, 3).join(' | ')}`);
            if (r.ok && r.studioLevels[0]) onImport?.(r.studioLevels[0]);
          }}
        />
        {importMsg ? <Text style={importMsg.startsWith('OK') ? styles.ok : styles.err}>{importMsg}</Text> : null}
      </View>

      <Text style={styles.h}>Level browser</Text>
      <LevelBrowser
        defs={defs}
        manifest={manifest}
        analyses={analyses}
        onOpen={onOpen}
        onDuplicate={onDuplicate}
        onNew={onNew}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: studioSpace.sm },
  h: { color: studioTheme.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: studioSpace.md },
  newWorld: { flexDirection: 'row', gap: studioSpace.sm, alignItems: 'center' },
  input: {
    flex: 1, borderWidth: 1, borderColor: studioTheme.border, backgroundColor: studioTheme.bg,
    color: studioTheme.text, paddingHorizontal: studioSpace.sm, paddingVertical: 6, borderRadius: 5, fontSize: 13,
  },
  world: { borderWidth: 1, borderColor: studioTheme.border, borderRadius: 6, padding: studioSpace.sm, gap: 6, backgroundColor: studioTheme.panelAlt },
  worldHead: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  worldTitle: { fontWeight: '700' },
  levelChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  chipId: { color: studioTheme.textDim, fontSize: 10, fontFamily: studioTheme.mono },
  sub: { color: studioTheme.textDim, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  reportRow: { marginTop: studioSpace.sm },
  ok: { color: studioTheme.ok, fontSize: 11, fontFamily: studioTheme.mono },
  warn: { color: studioTheme.warning, fontSize: 10, fontFamily: studioTheme.mono },
  err: { color: studioTheme.error, fontSize: 11, fontFamily: studioTheme.mono },
  exportRow: { flexDirection: 'row', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginTop: studioSpace.sm },
  code: { borderWidth: 1, borderColor: studioTheme.border, backgroundColor: studioTheme.bg, borderRadius: 5, maxHeight: 180 },
  codeText: { color: studioTheme.textDim, fontSize: 11, lineHeight: 15, fontFamily: studioTheme.mono, padding: studioSpace.sm },
  importBox: { minHeight: 80, textAlignVertical: 'top', fontFamily: studioTheme.mono, fontSize: 11 },
});
