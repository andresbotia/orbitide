import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { MAX_ACTIVE_CHARGES } from '@/game/engine/concurrency';
import { createGame } from '@/game/engine/createGame';
import { resolveAction, type LaunchOutcome } from '@/game/engine/resolveLaunch';
import type { GameAction } from '@/game/engine/actions';
import type { GameState, LevelDefinition } from '@/game/engine/types';
import { feedback } from '@/game/feedback';
import { cancelHits, registerHit } from '@/game/hapticArbiter';
import { requireLevel } from '@/game/levels/levels';
import { buildLaunchScript } from '@/game/presentation/buildScript';
import type { FlightPass, Point } from '@/game/presentation/events';

interface Options {
  onWin?: () => void;
  onLose?: () => void;
  /**
   * Explicit level definition to run instead of looking `levelId` up in the
   * campaign. Used by the dev-only Level Studio playtest to run an unsaved,
   * in-memory level through the real session/engine. Pass a stable reference.
   */
  level?: LevelDefinition;
}

interface ActiveFlight { pass: FlightPass; outcome: LaunchOutcome; cursor: number }

export interface GameSession {
  state: GameState; engineState: GameState; locked: boolean;
  /** Every charge currently on the rail (M2B: up to MAX_ACTIVE_CHARGES). */
  flights: FlightPass[];
  /** Back-compat single-flight accessor — the most recent launch. */
  flightPass: FlightPass | null;
  /** Whether another launch would be accepted right now. */
  canLaunch: boolean;
  activeCount: number;
  message: string;
  launch: (tunnelId: string, from?: Point, holdingTarget?: Point) => void;
  launchHeld: (chargeId: string, from?: Point, holdingTarget?: Point) => void;
  presentThrough: (passId: number, eventCount: number) => void;
  restart: () => void;
}

export function useGameSession(levelId: number, options: Options = {}): GameSession {
  const level = useMemo(
    () => options.level ?? requireLevel(levelId),
    [levelId, options.level],
  );
  const [state, setState] = useState(() => createGame(level));
  const [engineState, setEngineState] = useState(state);
  const [flights, setFlights] = useState<FlightPass[]>([]);
  const [message, setMessage] = useState('');
  const truth = useRef(state);
  const view = useRef(state);
  const serial = useRef(0);
  const active = useRef(new Map<number, ActiveFlight>());
  const optionsRef = useRef(options);
  const reported = useRef(false);
  useEffect(() => { optionsRef.current = options; });

  const publishFlights = useCallback(() => {
    setFlights([...active.current.values()].map((f) => f.pass));
  }, []);

  const reportResult = useCallback(() => {
    if (reported.current || truth.current.status === 'playing') return;
    reported.current = true;
    if (truth.current.status === 'won') optionsRef.current.onWin?.();
    else optionsRef.current.onLose?.();
  }, []);

  const settleAll = useCallback(() => {
    active.current.clear();
    cancelHits();
    setFlights([]);
    view.current = truth.current;
    setState(truth.current);
    reportResult();
  }, [reportResult]);

  useEffect(() => {
    const flights = active.current;
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') { feedback.cancelPending(); cancelHits(); if (flights.size) settleAll(); }
    });
    return () => { sub.remove(); flights.clear(); feedback.cancelPending(); cancelHits(); };
  }, [settleAll]);

  const perform = useCallback((action: GameAction, from?: Point, holdingTarget?: Point) => {
    if (truth.current.status !== 'playing') return;
    // Five charges already on the rail — deny cleanly, no state or queue mutation (spec §19).
    if (active.current.size >= MAX_ACTIVE_CHARGES) {
      setMessage('Rail is full — wait for a charge to land.');
      feedback.emit('denied');
      return;
    }
    const joining = active.current.size > 0;
    // Acknowledge the touch before resolving the pure engine action.
    feedback.emit(action.kind === 'holding' ? 'heldRelaunch' : 'select');
    const before = truth.current;
    const outcome = resolveAction(before, { ...action, join: joining });
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
    active.current.set(pass.passId, { pass, outcome, cursor: 0 });
    // Show the source consumption immediately; keep the board itself lagged.
    view.current = {
      ...view.current,
      movesApplied: outcome.state.movesApplied,
      tunnels: outcome.state.tunnels,
      holding: action.kind === 'holding'
        ? view.current.holding.filter((c) => c.id !== action.id)
        : view.current.holding,
    };
    setState(view.current);
    publishFlights();
  }, [publishFlights]);

  const presentThrough = useCallback((passId: number, count: number) => {
    const flight = active.current.get(passId);
    if (!flight) return;
    const end = Math.min(count, flight.pass.events.length);
    for (; flight.cursor < end; flight.cursor++) {
      const event = flight.pass.events[flight.cursor]!;
      if (event.kind === 'pixelClear') {
        view.current = { ...view.current, pixels: view.current.pixels.map((p) =>
          p.id === event.pixelId ? { ...p, cleared: true } : p) };
      } else if (event.kind === 'holdingLanded') {
        view.current = { ...view.current, holding: truth.current.holding };
        if (truth.current.status === 'playing') setMessage('Tap a held charge to launch it again.');
      } else if (event.kind === 'win' || event.kind === 'fail') {
        view.current = truth.current;
        reportResult();
      } else if (event.kind === 'complete') {
        active.current.delete(passId);
        if (active.current.size === 0) { settleAll(); return; }
        publishFlights();
        continue;
      }
      // Sound keeps a hook per event; the haptic for routine pixel hits is
      // coalesced across charges by the arbiter. Coincident cues still collapse
      // to one impact as in M1.
      const replacedImpact = flight.pass.events.some((e) => e.at === event.at && (
        (event.kind === 'holdingLanded' && (e.kind === 'holdingCritical' || e.kind === 'holdingFull')) ||
        (event.kind === 'pixelClear' && !event.final && e.kind === 'chargeConsumed') ||
        (event.kind === 'chargeConsumed' && e.kind === 'pixelClear' && e.final)
      ));
      if (event.kind === 'pixelClear') {
        feedback.emit(event.final ? 'finalClear' : 'pixelPop', { haptic: false, voice: 'shot' });
        if (!replacedImpact) registerHit({ final: event.final });
      } else {
        const soundEvent = event.kind === 'holdingLanded' ? 'holdingLand' : event.kind;
        feedback.emit(soundEvent, { haptic: event.kind === 'win' ? false : !replacedImpact });
      }
    }
    setState(view.current);
  }, [reportResult, settleAll, publishFlights]);

  const restart = useCallback(() => {
    active.current.clear();
    feedback.cancelPending();
    cancelHits();
    const fresh = createGame(level);
    truth.current = fresh; view.current = fresh; reported.current = false;
    setState(fresh); setEngineState(fresh); setFlights([]); setMessage('');
  }, [level]);

  return {
    state, engineState, locked: flights.length >= MAX_ACTIVE_CHARGES,
    flights, flightPass: flights[flights.length - 1] ?? null,
    canLaunch: state.status === 'playing' && flights.length < MAX_ACTIVE_CHARGES,
    activeCount: flights.length,
    message,
    launch: (id, from, target) => perform({ kind: 'tunnel', id }, from, target),
    launchHeld: (id, from, target) => perform({ kind: 'holding', id }, from, target),
    presentThrough, restart,
  };
}
