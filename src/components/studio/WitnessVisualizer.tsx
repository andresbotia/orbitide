import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Trace } from '@/game/engine/trace';
import { StudioButton } from './StudioButton';
import { TraceBoard } from './TraceBoard';
import { studioSpace, studioTheme } from './theme';

interface WitnessVisualizerProps {
  trace: Trace | null;
  kind: 'win' | 'fail';
  /** Shown when there is no trace. */
  emptyMessage: string;
}

const PLAY_INTERVAL_MS = 900;

/**
 * Step through a real witness trace. Every board shown is an actual engine
 * frame (`trace.frames[i]`) — nothing is reconstructed here.
 *
 * `cursor` 0 = the initial board; `cursor` k (1..steps) = the board after step k,
 * highlighting that step's cleared (amber) and newly-exposed (green) pixels.
 */
export function WitnessVisualizer({ trace, kind, emptyMessage }: WitnessVisualizerProps) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = trace ? trace.steps.length : 0;

  const stop = useCallback(() => {
    setPlaying(false);
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) { stop(); return; }
    setCursor((c) => (c >= total ? 0 : c));
    setPlaying(true);
  }, [playing, total, stop]);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setCursor((c) => {
        if (c >= total) { stop(); return c; }
        return c + 1;
      });
    }, PLAY_INTERVAL_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, total, stop]);

  const step = cursor > 0 && trace ? trace.steps[cursor - 1] ?? null : null;
  const frame = useMemo(() => {
    if (!trace) return null;
    return trace.frames[Math.min(cursor, trace.frames.length - 1)] ?? trace.frames[0]!;
  }, [trace, cursor]);

  if (!trace || total === 0) return <Text style={styles.note}>{emptyMessage}</Text>;

  return (
    <View style={styles.wrap}>
      <View style={styles.controls}>
        <StudioButton label="⟲ Restart" compact onPress={() => { stop(); setCursor(0); }} disabled={cursor === 0} />
        <StudioButton label="‹ Prev" compact onPress={() => { stop(); setCursor((c) => Math.max(0, c - 1)); }} disabled={cursor === 0} />
        <StudioButton label="Next ›" compact onPress={() => { stop(); setCursor((c) => Math.min(total, c + 1)); }} disabled={cursor >= total} />
        <StudioButton
          label={playing ? '❚❚ Pause' : '▶ Play Through'}
          compact
          variant={playing ? 'default' : 'primary'}
          onPress={togglePlay}
        />
        <Text style={styles.progress}>{cursor} / {total}</Text>
      </View>

      <View style={styles.boards}>
        {frame ? (
          <TraceBoard
            frame={frame}
            cleared={step?.clearedPixelIds ?? []}
            exposed={step?.newlyExposedPixelIds ?? []}
          />
        ) : null}
        <View style={styles.legend}>
          <Text style={[styles.legendItem, { color: studioTheme.warning }]}>▊ cleared this step</Text>
          <Text style={[styles.legendItem, { color: studioTheme.ok }]}>▊ newly exposed</Text>
        </View>
      </View>

      <ScrollView style={styles.detail} contentContainerStyle={styles.detailInner}>
        {cursor === 0 ? (
          <Text style={styles.note}>Initial board. Press Next or Play Through.</Text>
        ) : step ? (
          <>
            <Kv k="step" v={`${step.index} of ${total}`} />
            <Kv k="action" v={`${step.actionLabel}${step.joined ? '  (joined epoch)' : ''}`} />
            <Kv k="source" v={step.source.kind === 'tunnel' ? `Tunnel ${String.fromCharCode(65 + step.source.tunnelIndex)}` : `Holding ${step.source.id}`} />
            {step.charge ? (
              <>
                <Kv k="charge" v={`${step.charge.color}  cap ${step.charge.startingCapacity} → ${step.charge.remainingCapacity}  (${step.charge.landed})`} />
              </>
            ) : null}
            <Kv k="accepted" v={step.accepted ? 'yes' : `NO — ${step.rejection}`} />
            <Kv k="active charges" v={String(step.activeCount)} />
            <Kv k="Holding" v={`${step.holdingBefore.map((c) => `${c.color}:${c.capacity}`).join(', ') || '—'}  →  ${step.holdingAfter.map((c) => `${c.color}:${c.capacity}`).join(', ') || '—'}`} />
            <Kv k="cleared" v={step.clearedPixelIds.length ? step.clearedPixelIds.join(' ') : '—'} />
            <Kv k="newly exposed" v={step.newlyExposedPixelIds.length ? step.newlyExposedPixelIds.join(' ') : '—'} />
            <Kv k="pixels left" v={String(step.remainingPixels)} />
            <Kv k="status" v={step.status} />
          </>
        ) : null}

        {cursor >= total ? (
          <View style={styles.summary}>
            <Kv k="outcome" v={trace.outcome.toUpperCase()} />
            {kind === 'fail' ? (
              <>
                <Kv k="pixels remaining" v={String(trace.frames[trace.frames.length - 1]!.pixels.filter((p) => !p.cleared).length)} />
                <Kv k="unused charges" v={trace.unusedChargeIds.length ? trace.unusedChargeIds.join(', ') : '—'} />
                <Kv k="why stuck" v={reasonStuck(trace)} />
              </>
            ) : (
              <>
                <Kv k="unused charges" v={trace.unusedChargeIds.length ? trace.unusedChargeIds.join(', ') : '—'} />
                <Kv k="unused capacity" v={String(trace.unusedCapacity)} />
              </>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function reasonStuck(trace: Trace): string {
  const last = trace.steps[trace.steps.length - 1];
  if (!last) return 'no moves';
  if (last.rejection) return `last action rejected (${last.rejection})`;
  if (trace.finalStatus === 'lost') return 'no admitted tunnel launch and no useful held charge remains';
  return 'line ended before a terminal state';
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: studioSpace.sm },
  note: { color: studioTheme.textFaint, fontSize: 11, fontFamily: studioTheme.mono },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  progress: { color: studioTheme.textDim, fontSize: 11, fontFamily: studioTheme.mono, marginLeft: 4 },
  boards: { flexDirection: 'row', gap: studioSpace.md, alignItems: 'flex-start' },
  legend: { gap: 4 },
  legendItem: { fontSize: 10, fontFamily: studioTheme.mono },
  detail: { maxHeight: 240, borderWidth: 1, borderColor: studioTheme.border, borderRadius: 5, backgroundColor: studioTheme.bg },
  detailInner: { padding: studioSpace.sm, gap: 2 },
  summary: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: studioTheme.border, gap: 2 },
  kv: { flexDirection: 'row', gap: studioSpace.sm },
  k: { color: studioTheme.textFaint, fontSize: 10, fontFamily: studioTheme.mono, width: 110, textTransform: 'uppercase' },
  v: { color: studioTheme.text, fontSize: 11, fontFamily: studioTheme.mono, flex: 1 },
});
