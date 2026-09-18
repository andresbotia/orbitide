import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DIFFICULTY_WEIGHTS } from '@/game/studio/analysis';
import type { LevelAnalysis } from '@/game/studio/analysis';
import type { LevelAnalysisController } from '@/hooks/useLevelAnalysis';
import { StudioButton } from './StudioButton';
import { studioSpace, studioTheme } from './theme';

export function AnalysisPanel({ ctrl, exportable }: { ctrl: LevelAnalysisController; exportable: boolean }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.controls}>
        <StudioButton
          label={ctrl.status === 'running' ? `Analysing… (${ctrl.phase ?? 'start'})` : 'Analyze Level'}
          variant="primary"
          disabled={ctrl.status === 'running' || !exportable}
          onPress={ctrl.run}
        />
        {ctrl.status === 'running' ? <StudioButton label="Cancel" compact onPress={ctrl.cancel} /> : null}
      </View>
      {!exportable ? <Text style={styles.note}>Fix validation errors first.</Text> : null}
      {ctrl.status === 'cancelled' ? <Text style={styles.note}>Cancelled.</Text> : null}
      {ctrl.status === 'error' ? <Text style={[styles.note, styles.err]}>Analysis error: {ctrl.error}</Text> : null}
      {ctrl.stale ? <Text style={styles.note}>Level changed since the last analysis — run again.</Text> : null}

      {ctrl.analysis ? <Report a={ctrl.analysis} /> : null}
    </View>
  );
}

function Report({ a }: { a: LevelAnalysis }) {
  return (
    <ScrollView style={styles.report} contentContainerStyle={styles.reportInner}>
      {!a.complete ? (
        <View style={styles.limitations}>
          {a.limitations.map((l, i) => <Text key={i} style={styles.limitation}>⚠ {l}</Text>)}
        </View>
      ) : null}

      <Section title="Verdict">
        <Kv k="solvable" v={String(a.solvable).toUpperCase()} strong={a.solvable === true ? 'ok' : 'err'} />
        <Kv k="authored" v={a.authoredDifficulty} />
        <Kv k="suggested" v={a.suggestedDifficulty} strong={a.difficulty.mismatch ? 'warn' : undefined} />
        <Kv k="score" v={`${a.difficultyScore} / 100`} />
      </Section>

      <Section title="Difficulty factors (points of 100)">
        {Object.keys(DIFFICULTY_WEIGHTS).map((key) => (
          <Bar key={key} label={key} value={a.difficulty.contributions[key] ?? 0} max={(DIFFICULTY_WEIGHTS as Record<string, number>)[key]! * 100} />
        ))}
      </Section>

      <Section title={`First moves (${a.viableFirstMoves}/${a.totalFirstMoves} viable)`}>
        {a.firstMoveAnalysis.length === 0 ? <Text style={styles.note}>unavailable (truncated run)</Text> : null}
        {a.firstMoveAnalysis.map((m, i) => (
          <View key={i} style={styles.fmRow}>
            <Text style={[styles.fmClass, fmColor(m.classification)]}>{m.classification}</Text>
            <Text style={styles.fmLabel}>{m.label} · {m.color} {m.startingCapacity}</Text>
            <Text style={styles.fmMetrics}>
              {m.solvableAfter ? `win+${m.remainingWinLength} · peak ${m.peakHolding} · loss ${m.lossAfter.toFixed(2)}` : m.reasons[0]}
            </Text>
            {m.reasons.length > 0 && m.solvableAfter ? (
              <Text style={styles.fmReason}>{m.reasons.join('; ')}</Text>
            ) : null}
          </View>
        ))}
      </Section>

      {/* One search over logical choices: joining Pals on the rail is presentation, not a solver branch. */}
      <Section title="Solver (logical choices)">
        <Kv k="win length" v={String(a.solveResult.length)} />
        <Kv k="min peak Holding" v={String(a.solveResult.minWinningPeak)} />
        <Kv k="viable first moves" v={`${a.solveResult.viableFirstMoves}/${a.solveResult.totalFirstMoves}`} />
        <Kv k="loss probability" v={a.solveResult.lossProbability.toFixed(3)} />
        <Kv k="avg branching" v={a.solveResult.avgBranching.toFixed(2)} />
        <Kv k="explored states" v={a.solveResult.nodes.toLocaleString()} />
      </Section>

      <Section title="Holding pressure (winning line)">
        <Text style={styles.strip}>
          {a.holdingPressure.timeline.map((v) => `${v}/${a.holdingPressure.holdingCapacity}`).join('  ') || '—'}
        </Text>
        <Kv k="max Holding" v={String(a.holdingPressure.maxHolding)} />
        <Kv k="steps at 2/3+" v={`${a.holdingPressure.stepsAtOrAbove2} (${Math.round(a.holdingPressure.fractionAtOrAbove2 * 100)}%)`} />
        <Kv k="manual relaunches" v={String(a.holdingPressure.manualRelaunches)} />
        <Kv k="charges into Holding" v={String(a.holdingPressure.chargesEnteringHolding)} />
        <Kv k="longest held (steps)" v={String(a.holdingPressure.longestHeldDurationSteps)} />
      </Section>

      <Section title="Board">
        <Kv k="grid" v={`${a.boardMetrics.cols}×${a.boardMetrics.rows}`} />
        <Kv k="occupied" v={`${a.boardMetrics.occupiedCells}/${a.boardMetrics.totalCells}`} />
        <Kv k="density" v={a.boardMetrics.density.toFixed(2)} />
        <Kv k="colours" v={`${a.boardMetrics.uniqueColors} unique · dominant ${a.boardMetrics.dominantColors.join(', ') || '—'}`} />
      </Section>

      <Section title="Queues">
        <Kv k="tunnels" v={String(a.queueMetrics.tunnelCount)} />
        <Kv k="charges" v={String(a.queueMetrics.totalCharges)} />
        <Kv k="depths" v={a.queueMetrics.perTunnelDepth.join(' / ') || '—'} />
        <Kv k="min–max depth" v={`${a.queueMetrics.minTunnelDepth}–${a.queueMetrics.maxTunnelDepth}`} />
      </Section>

      <Section title={`Geometry (${a.directionalGeometry.mode})`}>
        <Kv k="initially exposed" v={String(a.directionalGeometry.initiallyExposed)} />
        <Kv k="buried" v={String(a.directionalGeometry.buried)} />
        <Kv k="layer depth" v={`max ${a.directionalGeometry.maxLayerDepth} · avg ${a.directionalGeometry.averageLayerDepth.toFixed(2)}`} />
        <Kv k="single / multi-side" v={`${a.directionalGeometry.singleSideExposed} / ${a.directionalGeometry.multiSideExposed}`} />
      </Section>

      <Section title="Choices (winning line)">
        <Kv k="decision states" v={String(a.choiceMetrics.totalDecisionStates)} />
        <Kv k="forced" v={String(a.choiceMetrics.forcedStates)} />
        <Kv k="multi-option" v={String(a.choiceMetrics.multiOptionStates)} />
        <Kv k="multi-winning" v={String(a.choiceMetrics.statesWithMultipleWinningOptions)} />
        <Kv k="trap states" v={String(a.choiceMetrics.statesWithTrapOptions)} />
      </Section>

      <Section title="Resource pressure">
        <Kv k="Holding util" v={`${(a.resourcePressure.holdingUtilization * 100).toFixed(0)}%  (${a.resourcePressure.maxHolding}/${a.resourcePressure.holdingCapacity})`} />
        <Kv k="manual relaunches" v={String(a.resourcePressure.manualRelaunches)} />
        <Kv k="into Holding" v={String(a.resourcePressure.chargesEnteringHolding)} />
      </Section>

      <Section title="Anti-spam (round-robin)">
        <Kv k="outcome" v={a.antiSpam.outcome.toUpperCase()} strong={a.antiSpam.outcome === 'won' ? 'warn' : 'ok'} />
        <Kv k="steps" v={String(a.antiSpam.steps)} />
        <Kv k="peak Holding" v={String(a.antiSpam.peakHolding)} />
        <Kv k="Holding entries" v={String(a.antiSpam.holdingEntries)} />
        <Kv k="manual relaunches" v={String(a.antiSpam.manualRelaunches)} />
      </Section>

      <Section title={`Warnings (${a.warnings.length})`}>
        {a.warnings.length === 0 ? <Text style={styles.note}>none</Text> : null}
        {a.warnings.map((w, i) => (
          <View key={i} style={styles.warn}>
            <Text style={[styles.warnCode, w.severity === 'warn' ? styles.warnW : styles.warnI]}>
              {w.severity === 'warn' ? '■' : '▲'} {w.code}
            </Text>
            <Text style={styles.warnMsg}>{w.message}</Text>
            {w.detail ? <Text style={styles.warnDetail}>{w.detail}</Text> : null}
          </View>
        ))}
      </Section>
    </ScrollView>
  );
}

function fmColor(c: string) {
  return c === 'VIABLE' ? { color: studioTheme.ok }
    : c === 'DANGEROUS' ? { color: studioTheme.warning }
      : { color: studioTheme.error };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Kv({ k, v, strong }: { k: string; v: string; strong?: 'ok' | 'warn' | 'err' }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.k}>{k}</Text>
      <Text style={[styles.v, strong === 'ok' && { color: studioTheme.ok }, strong === 'warn' && { color: studioTheme.warning }, strong === 'err' && { color: studioTheme.error }]}>{v}</Text>
    </View>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
      </View>
      <Text style={styles.barValue}>{value.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: studioSpace.sm },
  controls: { flexDirection: 'row', gap: studioSpace.sm, alignItems: 'center' },
  note: { color: studioTheme.textFaint, fontSize: 11, fontFamily: studioTheme.mono },
  err: { color: studioTheme.error },
  report: { maxHeight: 560 },
  reportInner: { gap: studioSpace.sm, paddingBottom: studioSpace.md },
  limitations: { borderWidth: 1, borderColor: studioTheme.warning, borderRadius: 5, padding: 6, gap: 3 },
  limitation: { color: studioTheme.warning, fontSize: 10, fontFamily: studioTheme.mono },
  section: { borderWidth: 1, borderColor: studioTheme.border, borderRadius: 6, padding: studioSpace.sm, gap: 3, backgroundColor: studioTheme.bg },
  sectionTitle: { color: studioTheme.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: studioSpace.sm },
  k: { color: studioTheme.textFaint, fontSize: 10, fontFamily: studioTheme.mono, textTransform: 'uppercase' },
  v: { color: studioTheme.text, fontSize: 11, fontFamily: studioTheme.mono, textAlign: 'right', flexShrink: 1 },
  strip: { color: studioTheme.textDim, fontSize: 11, fontFamily: studioTheme.mono },
  fmRow: { paddingVertical: 3, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: studioTheme.border, gap: 1 },
  fmClass: { fontSize: 10, fontWeight: '800', fontFamily: studioTheme.mono },
  fmLabel: { color: studioTheme.text, fontSize: 11 },
  fmMetrics: { color: studioTheme.textDim, fontSize: 10, fontFamily: studioTheme.mono },
  fmReason: { color: studioTheme.warning, fontSize: 9, fontFamily: studioTheme.mono },
  warn: { paddingVertical: 3, gap: 1 },
  warnCode: { fontSize: 10, fontWeight: '700', fontFamily: studioTheme.mono },
  warnW: { color: studioTheme.error },
  warnI: { color: studioTheme.warning },
  warnMsg: { color: studioTheme.text, fontSize: 11 },
  warnDetail: { color: studioTheme.textFaint, fontSize: 9, fontFamily: studioTheme.mono },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barLabel: { color: studioTheme.textFaint, fontSize: 9, fontFamily: studioTheme.mono, width: 120 },
  barTrack: { flex: 1, height: 8, backgroundColor: studioTheme.panelAlt, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: studioTheme.accent },
  barValue: { color: studioTheme.textDim, fontSize: 9, fontFamily: studioTheme.mono, width: 32, textAlign: 'right' },
});
