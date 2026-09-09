import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { LevelDefinition } from '@/game/engine/types';
import { LEVEL_DIFFICULTIES } from '@/game/studio/constants';
import {
  buildBrowserRows, filterRows, sortRows,
  type BrowserAnalysisSlice, type BrowserFilter, type BrowserSortKey,
} from '@/game/studio/browser';
import type { CampaignManifest } from '@/game/studio/campaign/types';
import { Thumbnail } from './Thumbnail';
import { StudioButton } from './StudioButton';
import { studioSpace, studioTheme } from './theme';

interface LevelBrowserProps {
  defs: LevelDefinition[];
  manifest?: CampaignManifest;
  analyses?: Map<number, BrowserAnalysisSlice>;
  onOpen: (id: number) => void;
  onDuplicate: (id: number) => void;
  onNew: () => void;
}

/**
 * Campaign-scale level browser. Rows are built without the solver (cheap enough
 * for hundreds / thousands of levels); an analysis slice merges in on demand.
 */
export function LevelBrowser({ defs, manifest, analyses, onOpen, onDuplicate, onNew }: LevelBrowserProps) {
  const [filter, setFilter] = useState<BrowserFilter>({ status: 'all', difficulty: 'all' });
  const [sort, setSort] = useState<{ key: BrowserSortKey; dir: 'asc' | 'desc' }>({ key: 'id', dir: 'asc' });

  const rows = useMemo(() => buildBrowserRows(defs, manifest, analyses), [defs, manifest, analyses]);
  const view = useMemo(
    () => sortRows(filterRows(rows, filter), sort.key, sort.dir),
    [rows, filter, sort],
  );

  const toggleSort = (key: BrowserSortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  return (
    <View style={styles.wrap}>
      <View style={styles.controls}>
        <TextInput
          value={filter.query ?? ''}
          onChangeText={(t) => setFilter((f) => ({ ...f, query: t }))}
          placeholder="Search id / title / theme / world"
          placeholderTextColor={studioTheme.textFaint}
          style={styles.search}
        />
        <StudioButton label="+ New level" compact variant="primary" onPress={onNew} />
      </View>

      <View style={styles.filterRow}>
        <StudioButton label="all" compact variant={filter.difficulty === 'all' ? 'primary' : 'default'} onPress={() => setFilter((f) => ({ ...f, difficulty: 'all' }))} />
        {LEVEL_DIFFICULTIES.map((d) => (
          <StudioButton key={d} label={d} compact variant={filter.difficulty === d ? 'primary' : 'default'} onPress={() => setFilter((f) => ({ ...f, difficulty: d }))} />
        ))}
      </View>
      <View style={styles.filterRow}>
        {(['all', 'ok', 'error', 'warnings', 'mismatch'] as const).map((s) => (
          <StudioButton key={s} label={s} compact variant={filter.status === s ? 'primary' : 'default'} onPress={() => setFilter((f) => ({ ...f, status: s }))} />
        ))}
      </View>
      <View style={styles.filterRow}>
        {(['id', 'title', 'difficulty', 'world', 'pixels', 'warnings', 'status'] as BrowserSortKey[]).map((k) => (
          <StudioButton key={k} label={`${k}${sort.key === k ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}`} compact onPress={() => toggleSort(k)} />
        ))}
      </View>

      <Text style={styles.count}>{view.length} / {rows.length} levels</Text>

      <ScrollView style={styles.list}>
        {view.map((r) => {
          const def = defs.find((d) => d.id === r.id)!;
          return (
            <View key={r.id} style={styles.row}>
              <Thumbnail level={def} size={52} />
              <View style={styles.meta}>
                <Text style={styles.title}>#{r.id} · {r.title}</Text>
                <Text style={styles.sub}>
                  {r.authoredDifficulty}
                  {r.suggestedDifficulty ? ` → ${r.suggestedDifficulty}` : ''}
                  {' · '}{r.worldTitle ?? 'unassigned'}
                  {' · '}{r.pixelCount}px
                  {r.specialCount ? ` · ${r.specialCount} special` : ''}
                  {r.hasReveal ? ' · reveal' : ''}
                </Text>
                <Text style={[styles.status, r.status === 'error' ? styles.err : r.warningCount ? styles.warn : styles.ok]}>
                  {r.status === 'error' ? `${r.errorCount} error(s)` : r.warningCount ? `${r.warningCount} warning(s)` : 'ok'}
                  {r.difficultyMismatch ? ' · difficulty mismatch' : ''}
                  {r.solvable === false ? ' · UNSOLVABLE' : ''}
                </Text>
              </View>
              <View style={styles.rowActions}>
                <StudioButton label="Open" compact onPress={() => onOpen(r.id)} />
                <StudioButton label="Duplicate" compact onPress={() => onDuplicate(r.id)} />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: studioSpace.sm },
  controls: { flexDirection: 'row', gap: studioSpace.sm, alignItems: 'center' },
  search: {
    flex: 1, borderWidth: 1, borderColor: studioTheme.border, backgroundColor: studioTheme.bg,
    color: studioTheme.text, paddingHorizontal: studioSpace.sm, paddingVertical: 6, borderRadius: 5, fontSize: 13,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  count: { color: studioTheme.textFaint, fontSize: 10, fontFamily: studioTheme.mono },
  list: { maxHeight: 460 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: studioSpace.sm,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: studioTheme.border,
  },
  meta: { flex: 1, gap: 1 },
  title: { color: studioTheme.text, fontSize: 12, fontWeight: '700' },
  sub: { color: studioTheme.textDim, fontSize: 10, fontFamily: studioTheme.mono },
  status: { fontSize: 10, fontFamily: studioTheme.mono },
  ok: { color: studioTheme.ok },
  warn: { color: studioTheme.warning },
  err: { color: studioTheme.error },
  rowActions: { gap: 3 },
});
