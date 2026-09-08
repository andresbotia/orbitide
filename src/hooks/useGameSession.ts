import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { createGame } from '@/game/engine/createGame';
import { resolveLaunch } from '@/game/engine/resolveLaunch';
import type { Charge, GameState } from '@/game/engine/types';
import { feedback } from '@/game/feedback';
import { requireLevel } from '@/game/levels/levels';
import { buildLaunchScript } from '@/game/presentation/buildScript';
import type { FlightPass, PresentationEvent } from '@/game/presentation/events';
import { palette } from '@/theme/colors';

export interface TrayCue {
  signal: number;
  index: number;
  kind: 'land' | 'lift';
}

export interface GameSession {
  /** The *presented* state — what every UI element renders. Lags engine truth
   *  while a launch is being staged. */
  state: GameState;
  /** Ground truth (used by the debug overlay). */
  engineState: GameState;
  /** True while a launch is being presented; tunnel taps are gated on it. */
  locked: boolean;
  launch: (tunnelId: string) => void;
  restart: () => void;

  flightSignal: number;
  flightPass: FlightPass | null;
  flyingCapacity: number | null;

  pulseSignal: number;
  pulseColor: string;

  trayCue: TrayCue;
}

interface Options {
  onWin?: () => void;
  onLose?: () => void;
}

function advanceTunnel(state: GameState, tunnelIndex: number): GameState {
  return {
    ...state,
    tunnels: state.tunnels.map((t, i) =>
      i === tunnelIndex ? { ...t, queue: t.queue.slice(1) } : t,
    ),
  };
}

function markCleared(state: GameState, pixelId: string): GameState {
  return {
    ...state,
    pixels: state.pixels.map((p) =>
      p.id === pixelId ? { ...p, cleared: true } : p,
    ),
  };
}

function addHeld(state: GameState, charge: Charge): GameState {
  return { ...state, holding: [...state.holding, charge] };
}

function removeHeld(state: GameState, chargeId: string): GameState {
  return { ...state, holding: state.holding.filter((c) => c.id !== chargeId) };
}

interface PulseState {
  signal: number;
  color: string;
}
const REST_PULSE: PulseState = { signal: 0, color: palette.coreGlow };

export function useGameSession(levelId: number, options: Options = {}): GameSession {
  const level = useMemo(() => requireLevel(levelId), [levelId]);

  const [presented, setPresented] = useState<GameState>(() => createGame(level));
  const [engineState, setEngineState] = useState<GameState>(presented);
  const [locked, setLocked] = useState(false);
  const [flight, setFlight] = useState<{ signal: number; pass: FlightPass | null }>({
    signal: 0,
    pass: null,
  });
  const [flyingCapacity, setFlyingCapacity] = useState<number | null>(null);
  const [pulse, setPulse] = useState<PulseState>(REST_PULSE);
  const [trayCue, setTrayCue] = useState<TrayCue>({ signal: 0, index: 0, kind: 'land' });

  const engineRef = useRef(presented);
  const workingRef = useRef(presented);
  const lockedRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const clearTimers = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }, []);

  const setLockedBoth = useCallback((value: boolean) => {
    lockedRef.current = value;
    setLocked(value);
  }, []);

  const bumpPulse = useCallback((color: string) => {
    setPulse((p) => ({ signal: p.signal + 1, color }));
  }, []);

  const settleToTruth = useCallback(() => {
    clearTimers();
    workingRef.current = engineRef.current;
    setPresented(engineRef.current);
    setFlight((f) => ({ signal: f.signal, pass: null }));
    setFlyingCapacity(null);
    setLockedBoth(false);
  }, [clearTimers, setLockedBoth]);

  // Stop staged animation cleanly if the app backgrounds mid-launch.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && lockedRef.current) settleToTruth();
    });
    return () => sub.remove();
  }, [settleToTruth]);

  useEffect(() => clearTimers, [clearTimers]);

  const applyEvent = useCallback(
    (event: PresentationEvent) => {
      const w = workingRef.current;
      switch (event.kind) {
        case 'launch': {
          const next = advanceTunnel(w, event.tunnelIndex);
          workingRef.current = next;
          setPresented(next);
          feedback.emit('launch');
          break;
        }
        case 'flightStart': {
          setFlight((f) => ({ signal: f.signal + 1, pass: event.pass }));
          setFlyingCapacity(event.pass.startCapacity);
          break;
        }
        case 'orbitEnter': {
          feedback.emit('orbitEnter');
          break;
        }
        case 'pixelClear': {
          const next = markCleared(w, event.pixelId);
          workingRef.current = next;
          setPresented(next);
          setFlyingCapacity(Math.max(0, event.remaining));
          feedback.emit('pixelPop');
          break;
        }
        case 'chargeConsumed': {
          feedback.emit('chargeConsumed');
          bumpPulse(palette.coreGlow);
          break;
        }
        case 'moveToHolding':
          break;
        case 'holdingLanded': {
          const next = addHeld(w, event.charge);
          workingRef.current = next;
          setPresented(next);
          feedback.emit('holdingLand');
          setTrayCue((c) => ({
            signal: c.signal + 1,
            index: next.holding.length - 1,
            kind: 'land',
          }));
          break;
        }
        case 'heldReactivate': {
          const index = w.holding.findIndex((c) => c.id === event.chargeId);
          const next = removeHeld(w, event.chargeId);
          workingRef.current = next;
          setPresented(next);
          feedback.emit('heldRelaunch');
          setTrayCue((c) => ({
            signal: c.signal + 1,
            index: Math.max(0, index),
            kind: 'lift',
          }));
          break;
        }
        case 'heldReturn': {
          const next = addHeld(w, event.charge);
          workingRef.current = next;
          setPresented(next);
          setTrayCue((c) => ({
            signal: c.signal + 1,
            index: next.holding.length - 1,
            kind: 'land',
          }));
          break;
        }
        case 'holdingCritical': {
          feedback.emit('holdingCritical');
          break;
        }
        case 'win': {
          workingRef.current = engineRef.current;
          setPresented(engineRef.current);
          feedback.emit('win');
          bumpPulse(palette.success);
          optionsRef.current.onWin?.();
          break;
        }
        case 'fail': {
          workingRef.current = engineRef.current;
          setPresented(engineRef.current);
          feedback.emit('fail');
          bumpPulse(palette.danger);
          optionsRef.current.onLose?.();
          break;
        }
      }
    },
    [bumpPulse],
  );

  const launch = useCallback(
    (tunnelId: string) => {
      if (lockedRef.current) return;
      const current = engineRef.current;
      if (current.status !== 'playing') return;

      const outcome = resolveLaunch(current, tunnelId);
      if (!outcome.accepted) return;

      engineRef.current = outcome.state;
      setEngineState(outcome.state);
      feedback.emit('select');

      const script = buildLaunchScript(outcome, current);

      // Presented state stays at the pre-move snapshot; the player walks it
      // forward event by event and converges back to truth at the end.
      clearTimers();
      workingRef.current = current;
      setPresented(current);
      setLockedBoth(true);

      for (const event of script.events) {
        timers.current.push(setTimeout(() => applyEvent(event), event.at));
      }
      timers.current.push(setTimeout(() => settleToTruth(), script.totalMs));
    },
    [applyEvent, clearTimers, setLockedBoth, settleToTruth],
  );

  const restart = useCallback(() => {
    clearTimers();
    const fresh = createGame(level);
    engineRef.current = fresh;
    workingRef.current = fresh;
    setEngineState(fresh);
    setPresented(fresh);
    setFlight({ signal: 0, pass: null });
    setFlyingCapacity(null);
    setPulse(REST_PULSE);
    setTrayCue({ signal: 0, index: 0, kind: 'land' });
    setLockedBoth(false);
  }, [level, clearTimers, setLockedBoth]);

  return {
    state: presented,
    engineState,
    locked,
    launch,
    restart,
    flightSignal: flight.signal,
    flightPass: flight.pass,
    flyingCapacity,
    pulseSignal: pulse.signal,
    pulseColor: pulse.color,
    trayCue,
  };
}
