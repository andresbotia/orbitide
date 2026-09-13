import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LEVEL_DEFINITIONS } from '@/game/levels/levelDefinitions';
import type { BatchRow } from '@/game/studio/analysis';
import { LEVEL_DIFFICULTIES } from '@/game/studio/constants';
import type { LevelAnalysisController } from '@/hooks/useLevelAnalysis';
import { StudioButton } from './StudioButton';
import { studioSpace, studioTheme } from './theme';

type SortKey = keyof Pick<BatchRow, 'levelId' | 'score' | 'shortestWin' | 'viableFirstMoves' | 'peakHolding' | 'maxActive' | 'heldRelaunches' | 'nodes' | 'warningCount' | 'density' | 'uniqueColors' | 'maxLayerDepth'>;
type RowFilter = 'all' | 'mismatch' | 'unsolvable' | 'warnings';

const COLS: { key: SortKey; label: string; get: (r: BatchRow) => number | string; width: number }[] = [
  { key: 'levelId', label: 'L', get: (r) => r.levelId, width: 34 },
  { key: 'score', label: 'score', get: (r) => r.score, width: 52 },
  { key: 'shortestWin', label: 'win', get: (r) => r.shortestWin, width: 44 },
  { key: 'viableFirstMoves', label: 'vfm', get: (r) => `${r.viableFirstMoves}/${r.totalFirstMoves}`, width: 50 },
  { key: 'peakHolding', label: 'peak', get: (r) => r.peakHolding, width: 46 },
  { key: 'maxActive', label: 'maxA', get: (r) => r.maxActive, width: 48 },
  { key: 'heldRelaunches', label: 'held', get: (r) => r.heldRelaunches, width: 44 },
  { key: 'density', label: 'dens', get: (r) => r.density.toFixed(2), width: 48 },
  { key: 'uniqueColors', label: 'clr', get: (r) => r.uniqueColors, width: 36 },
  { key: 'maxLayerDepth', label: 'depth', get: (r) => r.maxLayerDepth, width: 48 },
  { key: 'nodes', label: 'nodes', get: (r) => r.nodes, width: 74 },
  { key: 'warningCount', label: 'warn', get: (r) => r.warningCount, width: 44 },
];

export function BatchPanel({ ctrl }: { ctrl: LevelAnalysisController }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'levelId', dir: 1 });
  const [rowFilter, setRowFilter] = useState<RowFilter>('all');
  const [diffFilter, setDiffFilter] = useState<string>('all');

  const rows = useMemo(() => ctrl.batch?.rows ?? [], [ctrl.batch]);
  const shown = useMemo(() => {
    let out = [...rows];
    if (diffFilter !== 'all') out = out.filter((r) => r.authoredDifficulty === diffFilter);
    if (rowFilter === 'mismatch') out = out.filter((r) => r.authoredDifficulty !== r.suggestedDifficulty);
    if (rowFilter === 'unsolvable') out = out.filter((r) => r.solvable !== true);
    if (rowFilter === 'warnings') out = out.filter((r) => r.warningCount > 0);
    out.sort((a, b) => {
      const av = a[sort.key]; const bv = b[sort.key];
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
    });
    return out;
  }, [rows, sort, rowFilter, diffFilter]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  return (
    <View style={styles.wrap}>
      <View style={styles.controls}>
        <StudioButton
          label={ctrl.batchStatus === 'running'
            ? `Analysing ${ctrl.batchProgress?.done ?? 0}/${ctrl.batchProgress?.total ?? 0}…`
            : 'Analyze Levels 1–10'}
          variant="primary"
          disabled={ctrl.batchStatus === 'running'}
          onPress={() => ctrl.runBatch(LEVEL_DEFINITIONS)}
        />
        {ctrl.batchStatus === 'running' ? <StudioButton label="Cancel" compact onPress={ctrl.cancelBatch} /> : null}
      </View>

      {ctrl.batchStatus === 'cancelled' ? <Text style={styles.note}>Cancelled — showing {rows.length} completed.</Text> : null}

      {rows.length > 0 ? (
        <>
          <View style={styles.filters}>
            {(['all', 'mismatch', 'unsolvable', 'warnings'] as RowFilter[]).map((f) => (
              <StudioButton key={f} label={f} compact variant={rowFilter === f ? 'primary' : 'default'} onPress={() => setRowFilter(f)} />
            ))}
          </View>
          <View style={styles.filters}>
            {['all', ...LEVEL_DIFFICULTIES].map((d) => (
              <StudioButton key={d} label={d} compact variant={diffFilter === d ? 'primary' : 'default'} onPress={() => setDiffFilter(d)} />
            ))}
          </View>

          <ScrollView horizontal>
            <View>
              <View style={[styles.tr, styles.head]}>
                <Text style={[styles.th, { width: 96 }]}>title</Text>
                <Text style={[styles.th, { width: 88 }]}>auth→sug</Text>
                <Text style={[styles.th, { width: 52 }]}>spam</Text>
                {COLS.map((c) => (
                  <Pressable key={c.key} onPress={() => toggleSort(c.key)} style={{ width: c.width }}>
                    <Text style={styles.th}>{c.label}{sort.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</Text>
                  </Pressable>
                ))}
              </View>
              <ScrollView style={styles.body}>
                {shown.map((r) => (
                  <View key={r.levelId} style={styles.tr}>
                    <Text style={[styles.td, { width: 96 }]} numberOfLines={1}>{r.title}</Text>
                    <Text style={[styles.td, { width: 88 }, r.authoredDifficulty !== r.suggestedDifficulty && styles.mismatch]}>
                      {r.authoredDifficulty.slice(0, 4)}→{r.suggestedDifficulty.slice(0, 4)}
                    </Text>
                    <Text style={[styles.td, { width: 52 }, r.antiSpamOutcome === 'won' && styles.mismatch]}>
                      {r.antiSpamOutcome ?? '—'}
                    </Text>
                    {COLS.map((c) => (
                      <Text key={c.key} style={[styles.td, { width: c.width }, c.key === 'warningCount' && r.warningCount > 0 && styles.mismatch]}>
                        {typeof c.get(r) === 'number' ? (c.get(r) as number).toLocaleString() : c.get(r)}
                      </Text>
                    ))}
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
          <Text style={styles.note}>{shown.length} of {rows.length} rows</Text>
        </>
      ) : (
        <Text style={styles.note}>Run the batch to audit the campaign.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: studioSpace.sm },
  controls: { flexDirection: 'row', gap: studioSpace.sm, alignItems: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  note: { color: studioTheme.textFaint, fontSize: 11, fontFamily: studioTheme.mono },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: studioTheme.border },
  head: { borderBottomWidth: 1, borderBottomColor: studioTheme.borderStrong },
  body: { maxHeight: 320 },
  th: { color: studioTheme.textDim, fontSize: 9, fontWeight: '700', fontFamily: studioTheme.mono, textTransform: 'uppercase' },
  td: { color: studioTheme.text, fontSize: 10, fontFamily: studioTheme.mono },
  mismatch: { color: studioTheme.warning, fontWeight: '700' },
});
