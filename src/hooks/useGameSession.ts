import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createGame } from '@/game/engine/createGame';
import { resolveAction, type LaunchOutcome } from '@/game/engine/resolveLaunch';
import type { GameAction } from '@/game/engine/actions';
import type { GameState } from '@/game/engine/types';
import { feedback } from '@/game/feedback';
import { requireLevel } from '@/game/levels/levels';
import { buildLaunchScript } from '@/game/presentation/buildScript';
import type { FlightPass, Point } from '@/game/presentation/events';

interface Options { onWin?: () => void; onLose?: () => void }
export interface GameSession {
  state: GameState; engineState: GameState; locked: boolean;
  flightPass: FlightPass | null;
  message: string;
  launch: (tunnelId: string, from?: Point, holdingTarget?: Point) => void;
  launchHeld: (chargeId: string, from?: Point, holdingTarget?: Point) => void;
  presentThrough: (passId: number, eventCount: number) => void;
  restart: () => void;
}
export function useGameSession(levelId: number, options: Options = {}): GameSession {
  const level = useMemo(() => requireLevel(levelId), [levelId]);
  const [state, setState] = useState(() => createGame(level));
  const [engineState, setEngineState] = useState(state);
  const [flightPass, setFlight] = useState<FlightPass | null>(null);
  const [message, setMessage] = useState('');
  const truth = useRef(state);
  const view = useRef(state);
  const serial = useRef(0);
  const active = useRef<{ pass: FlightPass; outcome: LaunchOutcome; cursor: number } | null>(null);
  const optionsRef = useRef(options);
  const reported = useRef(false);
  useEffect(() => { optionsRef.current = options; });
  const reportResult = useCallback(() => {
    if (reported.current || truth.current.status === 'playing') return;
    reported.current = true;
    if (truth.current.status === 'won') optionsRef.current.onWin?.();
    else optionsRef.current.onLose?.();
  }, []);
  const settle = useCallback(() => {
    active.current = null;
    setFlight(null);
    view.current = truth.current;
    setState(truth.current);
    reportResult();
  }, [reportResult]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') { feedback.cancelPending(); if (active.current) settle(); }
    });
    return () => { sub.remove(); active.current = null; feedback.cancelPending(); };
  }, [settle]);
  const perform = useCallback((action: GameAction, from?: Point, holdingTarget?: Point) => {
    if (active.current || truth.current.status !== 'playing') return;
    // Acknowledge touch before resolving the pure engine action. One haptic, no duplicate launch tick.
    feedback.emit(action.kind === 'holding' ? 'heldRelaunch' : 'select');
    const before = truth.current;
    const outcome = resolveAction(before, action);
    if (!outcome.accepted) {
      setMessage(outcome.rejection === 'noTargets' ? 'No exposed matching pixels yet.' :
        outcome.rejection === 'holdingFull' ? 'Free a Holding slot first.' : 'That charge is no longer available.');
      return;
    }
    setMessage('');
    feedback.emit('launch', { haptic: false });
    truth.current = outcome.state;
    setEngineState(outcome.state);
    const pass = buildLaunchScript(outcome, before, ++serial.current, from, holdingTarget).pass;
    active.current = { pass, outcome, cursor: 0 };
    view.current = { ...before, movesApplied: outcome.state.movesApplied,
      tunnels: action.kind === 'tunnel' ? outcome.state.tunnels : before.tunnels,
      holding: action.kind === 'holding' ? before.holding.filter((c) => c.id !== action.id) : before.holding };
    setState(view.current);
    setFlight(pass);
  }, []);
  const presentThrough = useCallback((passId: number, count: number) => {
    const current = active.current;
    if (!current || current.pass.passId !== passId) return;
    const end = Math.min(count, current.pass.events.length);
    for (; current.cursor < end; current.cursor++) {
      const event = current.pass.events[current.cursor]!;
      if (event.kind === 'pixelClear') {
        view.current = { ...view.current, pixels: view.current.pixels.map((p) =>
          p.id === event.pixelId ? { ...p, cleared: true } : p) };
      } else if (event.kind === 'holdingLanded') {
        view.current = { ...view.current, holding: current.outcome.state.holding };
        setMessage('Tap a held charge to launch it again.');
      } else if (event.kind === 'win' || event.kind === 'fail') {
        view.current = truth.current;
        reportResult();
      } else if (event.kind === 'complete') {
        settle();
        return;
      }
      // Keep every semantic sound hook, but use one impact when cues coincide.
      const replacedImpact = current.pass.events.some((e) => e.at === event.at && (
        event.kind === 'holdingLanded' && (e.kind === 'holdingCritical' || e.kind === 'holdingFull') ||
        event.kind === 'pixelClear' && e.kind === 'chargeConsumed'
      ));
      feedback.emit(event.kind === 'holdingLanded' ? 'holdingLand' :
        event.kind === 'pixelClear' ? 'pixelPop' : event.kind, { haptic: !replacedImpact });
    }
    setState(view.current);
  }, [reportResult, settle]);
  const restart = useCallback(() => {
    active.current = null;
    feedback.cancelPending();
    const fresh = createGame(level);
    truth.current = fresh; view.current = fresh; reported.current = false;
    setState(fresh); setEngineState(fresh); setFlight(null); setMessage('');
  }, [level]);
  return { state, engineState, locked: !!flightPass, flightPass, message,
    launch: (id, from, target) => perform({ kind: 'tunnel', id }, from, target),
    launchHeld: (id, from, target) => perform({ kind: 'holding', id }, from, target),
    presentThrough, restart };
}
