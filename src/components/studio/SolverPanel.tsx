import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { analyzeStudioLevel, describeAction, type StudioAnalysis } from '@/game/studio/analyze';
import type { StudioLevel } from '@/game/studio/types';
import { StudioButton } from './StudioButton';
import { studioSpace, studioTheme } from './theme';

/**
 * SOLVE / ANALYZE. Runs the ONE shared solver (`engine/solver.ts`) against the
 * current level via `analyzeStudioLevel`. It is deliberately manual (never on a
 * brush stroke), runs off the UI thread's next tick so the busy state paints,
 * and supports cooperative cancellation.
 *
 * M3A surfaces the solver data that is already cheap. The full analytics
 * dashboard is M3B.
 */
export function SolverPanel({ level, exportable }: { level: StudioLevel; exportable: boolean }) {
  const [busy, setBusy] = useState(false);
  // Tag the result with the exact level it was computed for, so a later edit
  // makes it stale (and hidden) without a state-syncing effect.
  const [analysis, setAnalysis] = useState<{ forLevel: StudioLevel; data: StudioAnalysis } | null>(null);
  const signal = useRef<{ cancelled: boolean } | null>(null);

  useEffect(() => () => { if (signal.current) signal.current.cancelled = true; }, []);

  const run = useCallback(() => {
    if (busy) return;
    setBusy(true);
    setAnalysis(null);
    const mySignal = { cancelled: false };
    signal.current = mySignal;
    // Yield so the "Solving…" state renders before the synchronous search runs.
    setTimeout(() => {
      const data = analyzeStudioLevel(level, { signal: mySignal });
      if (!mySignal.cancelled) setAnalysis({ forLevel: level, data });
      if (signal.current === mySignal) signal.current = null;
      setBusy(false);
    }, 16);
  }, [busy, level]);

  const cancel = useCallback(() => {
    if (signal.current) signal.current.cancelled = true;
  }, []);

  return (
    <View style={styles.wrap}>
      <View style={styles.controls}>
        <StudioButton
          label={busy ? 'Solving…' : 'Solve / Analyze'}
          variant="primary"
          disabled={busy || !exportable}
          onPress={run}
        />
        {busy ? <StudioButton label="Cancel" compact onPress={cancel} /> : null}
        {busy ? <ActivityIndicator color={studioTheme.accent} /> : null}
      </View>
      {!exportable ? <Text style={styles.note}>Fix validation errors first.</Text> : null}

      {analysis && analysis.forLevel === level ? <Result analysis={analysis.data} /> : null}
      {analysis && analysis.forLevel !== level && !busy ? (
        <Text style={styles.note}>Level changed since the last analysis — run again.</Text>
      ) : null}
    </View>
  );
}

function Result({ analysis }: { analysis: StudioAnalysis }) {
  if (analysis.status === 'cancelled') return <Text style={styles.note}>Cancelled.</Text>;
  if (analysis.status === 'error') {
    return <Text style={[styles.note, styles.err]}>Solver error: {analysis.error}</Text>;
  }
  const r = analysis.result!;
  const witness = analysis.status === 'solved' ? r.moves : r.failPath;
  return (
    <View style={styles.result}>
      <View style={styles.row}>
        <Text style={styles.k}>SOLVABLE</Text>
        <Text style={[styles.v, analysis.solvable ? styles.yes : styles.no]}>
          {analysis.solvable ? 'YES' : 'NO'}
        </Text>
      </View>
      <Line k="explored nodes" v={`${r.nodes.toLocaleString()} (${analysis.elapsedMs} ms)`} />
      <Line k="viable first moves" v={`${r.viableFirstMoves} / 3`} />
      {analysis.solvable ? (
        <>
          <Line k="shortest win" v={`${r.length} moves`} />
          <Line k="peak Holding (witness)" v={String(r.peakHolding)} />
          <Line k="min possible peak Holding" v={Number.isFinite(r.minWinningPeak) ? String(r.minWinningPeak) : '—'} />
          <Line k="held relaunches on witness" v={String(r.heldLaunches)} />
          <Line k="max active charges (witness)" v={String(r.maxActiveOnWitness)} />
        </>
      ) : null}
      <Line k="max active charges (any line)" v={String(r.maxActive)} />
      <Line k="max Holding (any line)" v={String(r.maxHolding)} />
      <Line k="loss probability (uniform play)" v={r.lossProbability.toFixed(3)} />
      {r.failPath ? <Line k="fail witness" v={`${r.failPath.length} moves`} /> : <Line k="fail witness" v="none reachable" />}

      {witness && witness.length > 0 ? (
        <>
          <Text style={[styles.k, styles.witnessHeader]}>
            {analysis.solvable ? 'REPRESENTATIVE WINNING LINE' : 'FAIL LINE'}
          </Text>
          <Text style={styles.witness}>
            {witness.map((a, i) => `${i + 1}. ${describeAction(a)}`).join('\n')}
          </Text>
        </>
      ) : null}
    </View>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: studioSpace.sm },
  controls: { flexDirection: 'row', alignItems: 'center', gap: studioSpace.sm },
  note: { color: studioTheme.textFaint, fontSize: 11, fontFamily: studioTheme.mono },
  err: { color: studioTheme.error },
  result: { gap: 3, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: studioSpace.sm },
  k: { color: studioTheme.textFaint, fontSize: 10, fontFamily: studioTheme.mono, textTransform: 'uppercase' },
  v: { color: studioTheme.text, fontSize: 11, fontFamily: studioTheme.mono, textAlign: 'right', flexShrink: 1 },
  yes: { color: studioTheme.ok, fontWeight: '800' },
  no: { color: studioTheme.error, fontWeight: '800' },
  witnessHeader: { marginTop: 6 },
  witness: { color: studioTheme.textDim, fontSize: 10, lineHeight: 14, fontFamily: studioTheme.mono },
});
