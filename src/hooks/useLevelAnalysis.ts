import { useCallback, useEffect, useRef, useState } from 'react';

import type { LevelDefinition } from '@/game/engine/types';
import { SolverCancelled } from '@/game/engine/solver';
import {
  analyzeBatch, analyzeLevel, type AnalysisPhase, type BatchResult, type LevelAnalysis,
} from '@/game/studio/analysis';
import { toLevelDefinition } from '@/game/studio/serialize';
import type { StudioLevel } from '@/game/studio/types';

type Status = 'idle' | 'running' | 'done' | 'error' | 'cancelled';

export interface LevelAnalysisController {
  status: Status;
  /** Increments on every completed analysis — a stable remount key for viewers. */
  runId: number;
  /** The analysis, only while it matches the current level. */
  analysis: LevelAnalysis | null;
  /** `true` when an analysis exists but the level has since been edited. */
  stale: boolean;
  phase: AnalysisPhase | null;
  error: string | null;
  run: () => void;
  cancel: () => void;

  batchStatus: Status;
  batch: BatchResult | null;
  batchProgress: { done: number; total: number; levelId: number } | null;
  runBatch: (defs: LevelDefinition[]) => void;
  cancelBatch: () => void;
}

/**
 * Drives the Studio ANALYSIS / WIN PATH / FAIL PATH / BATCH tabs. Never runs on
 * an edit — always an explicit button. Cancellation is cooperative (a signal
 * ref checked every solver node and between analysis phases).
 */
export function useLevelAnalysis(level: StudioLevel, exportable: boolean): LevelAnalysisController {
  const [status, setStatus] = useState<Status>('idle');
  const [phase, setPhase] = useState<AnalysisPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ forLevel: StudioLevel; data: LevelAnalysis } | null>(null);
  const [runId, setRunId] = useState(0);
  const signal = useRef<{ cancelled: boolean } | null>(null);

  const [batchStatus, setBatchStatus] = useState<Status>('idle');
  const [batch, setBatch] = useState<BatchResult | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number; levelId: number } | null>(null);
  const batchSignal = useRef<{ cancelled: boolean } | null>(null);

  useEffect(() => () => {
    if (signal.current) signal.current.cancelled = true;
    if (batchSignal.current) batchSignal.current.cancelled = true;
  }, []);

  const run = useCallback(() => {
    if (status === 'running' || !exportable) return;
    const mySignal = { cancelled: false };
    signal.current = mySignal;
    setStatus('running');
    setError(null);
    setPhase(null);
    setResult(null);
    void (async () => {
      try {
        const data = await analyzeLevel(toLevelDefinition(level), {
          signal: mySignal,
          onPhase: (p) => { if (!mySignal.cancelled) setPhase(p); },
        });
        if (mySignal.cancelled) return;
        setResult({ forLevel: level, data });
        setRunId((n) => n + 1);
        setStatus('done');
      } catch (e) {
        if (mySignal.cancelled || e instanceof SolverCancelled) { setStatus('cancelled'); return; }
        setError((e as Error).message);
        setStatus('error');
      } finally {
        if (signal.current === mySignal) signal.current = null;
        setPhase(null);
      }
    })();
  }, [status, exportable, level]);

  const cancel = useCallback(() => {
    if (signal.current) signal.current.cancelled = true;
  }, []);

  const runBatch = useCallback((defs: LevelDefinition[]) => {
    if (batchStatus === 'running') return;
    const mySignal = { cancelled: false };
    batchSignal.current = mySignal;
    setBatchStatus('running');
    setBatch(null);
    setBatchProgress({ done: 0, total: defs.length, levelId: defs[0]?.id ?? 0 });
    void (async () => {
      try {
        const res = await analyzeBatch(defs, {
          signal: mySignal,
          onProgress: (done, total, levelId) => {
            if (!mySignal.cancelled) setBatchProgress({ done, total, levelId });
          },
        });
        setBatch(res);
        setBatchStatus(res.cancelled ? 'cancelled' : 'done');
      } catch (e) {
        if (e instanceof SolverCancelled) { setBatchStatus('cancelled'); return; }
        setBatchStatus('error');
      } finally {
        if (batchSignal.current === mySignal) batchSignal.current = null;
        setBatchProgress(null);
      }
    })();
  }, [batchStatus]);

  const cancelBatch = useCallback(() => {
    if (batchSignal.current) batchSignal.current.cancelled = true;
  }, []);

  const matches = result?.forLevel === level;
  return {
    status,
    runId,
    analysis: matches ? result!.data : null,
    stale: !!result && !matches,
    phase,
    error,
    run,
    cancel,
    batchStatus,
    batch,
    batchProgress,
    runBatch,
    cancelBatch,
  };
}
