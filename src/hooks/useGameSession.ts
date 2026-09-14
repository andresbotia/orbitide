import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { DEFAULT_ACTIVE_CAPACITY } from '@/game/engine/concurrency';
import { createGame } from '@/game/engine/createGame';
import { epochHasCapacity } from '@/game/engine/epoch';
import { resolveAction, type LaunchOutcome } from '@/game/engine/resolveLaunch';
import { isCoreV2 } from '@/game/engine/ruleset';
import type { GameAction } from '@/game/engine/actions';
import type { Charge, GameState, LevelDefinition } from '@/game/engine/types';
import { feedback } from '@/game/feedback';
import { cancelHits, registerHit } from '@/game/hapticArbiter';
import { requireLevel } from '@/game/levels/levels';
import { buildLaunchScript } from '@/game/presentation/buildScript';
import { applyCoreV2Convoy } from '@/game/presentation/convoy';
import type { FlightPass, Point } from '@/game/presentation/events';
import { reserveHoldingSlot } from '@/game/presentation/holdingSlot';
import {
  applyTutorialEvent,
  catchUpTutorial,
  createTutorial,
  isTutorialActionAllowed,
  syncTutorialCompletion,
  toTutorialView,
  type TutorialEvent,
  type TutorialState,
  type TutorialView,
} from '@/game/tutorial';

interface Options {
  onWin?: () => void;
  onLose?: () => void;
  /**
   * Explicit level definition to run instead of looking `levelId` up in the
   * campaign. Used by the dev-only Level Studio playtest to run an unsaved,
   * in-memory level through the real session/engine. Pass a stable reference.
   */
  level?: LevelDefinition;
  /**
   * Completed tutorial ids from persistence. `null`/`undefined` means “not
   * loaded yet” — the core tutorial stays inactive so it cannot flash on for a
   * returning player. Pass an empty iterable to run it in tests.
   */
  completedTutorials?: Iterable<string> | null;
  onTutorialComplete?: (id: string) => void;
}

interface ActiveFlight { pass: FlightPass; outcome: LaunchOutcome; cursor: number }

/** True once this flight has presented its own Holding arrival beat. */
function hasPresentedHoldingLanding(flight: ActiveFlight): boolean {
  if (flight.pass.endKind !== 'toHolding') return false;
  const at = flight.pass.events.findIndex((event) => event.kind === 'holdingLanded');
  return at >= 0 && flight.cursor > at;
}

/** Append one Pal to presented Holding; never copy the whole engine tray. */
function appendPresentedHolding(holding: Charge[], landed: Charge | null): Charge[] {
  if (!landed || holding.some((charge) => charge.id === landed.id)) return holding;
  return [...holding, landed];
}

export interface GameSession {
  state: GameState; engineState: GameState; locked: boolean;
  /** Every charge currently on the rail. */
  flights: FlightPass[];
  /** Back-compat single-flight accessor — the most recent launch. */
  flightPass: FlightPass | null;
  /** Whether another launch would be accepted right now. */
  canLaunch: boolean;
  /** Visible in-flight occupancy (for ACTIVE X/Y). */
  activeCount: number;
  /** Engine concurrent-pass capacity (for ACTIVE X/Y). */
  activeCapacity: number;
  message: string;
  /** M5.4B UI contract. Presentation-only consumers must not drive engine truth. */
  tutorial: TutorialView;
  launch: (tunnelId: string, from?: Point, holdingSlots?: (Point | undefined)[]) => void;
  launchHeld: (chargeId: string, from?: Point, holdingSlots?: (Point | undefined)[]) => void;
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
  const [tutorial, setTutorial] = useState<TutorialState>(() =>
    createTutorial(level, options.completedTutorials));
  const tutorialRef = useRef(tutorial);
  tutorialRef.current = tutorial;
  useEffect(() => { optionsRef.current = options; });

  const commitTutorial = useCallback((next: TutorialState) => {
    const prev = tutorialRef.current;
    if (prev === next) return;
    tutorialRef.current = next;
    setTutorial(next);
    if (!prev.completed && next.completed) {
      optionsRef.current.onTutorialComplete?.(next.id);
    }
  }, []);

  const advanceTutorial = useCallback((event: TutorialEvent) => {
    commitTutorial(applyTutorialEvent(tutorialRef.current, event));
  }, [commitTutorial]);

  useEffect(() => {
    commitTutorial(syncTutorialCompletion(
      tutorialRef.current,
      options.completedTutorials,
      level,
    ));
  }, [options.completedTutorials, commitTutorial, level]);

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
    commitTutorial(catchUpTutorial(tutorialRef.current, truth.current));
    reportResult();
  }, [reportResult, commitTutorial]);

  useEffect(() => {
    const flights = active.current;
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') { feedback.cancelPending(); cancelHits(); if (flights.size) settleAll(); }
    });
    return () => { sub.remove(); flights.clear(); feedback.cancelPending(); cancelHits(); };
  }, [settleAll]);

  const holdingSlotsRef = useRef<(Point | undefined)[]>([]);

  const perform = useCallback((action: GameAction, from?: Point, holdingSlots?: (Point | undefined)[]) => {
    if (truth.current.status !== 'playing') return;
    if (!isTutorialActionAllowed(tutorialRef.current, action)) {
      feedback.emit('denied');
      return;
    }
    const cap = truth.current.activeCapacity || DEFAULT_ACTIVE_CAPACITY;
    // Visible flights occupy Active slots until they land. Deny with no mutation.
    if (action.kind === 'holding') {
      for (const flight of active.current.values()) {
        if (flight.pass.charge.id === action.id && !hasPresentedHoldingLanding(flight)) {
          feedback.emit('denied');
          return;
        }
      }
    }
    if (active.current.size >= cap) {
      setMessage('Rail is full — wait for a charge to land.');
      feedback.emit('denied');
      return;
    }
    const joining = active.current.size > 0 && epochHasCapacity(truth.current);
    // Acknowledge the touch before resolving the pure engine action.
    feedback.emit(action.kind === 'holding' ? 'heldRelaunch' : 'select');
    const before = truth.current;
    const outcome = resolveAction(before, { ...action, join: joining });
    if (!outcome.accepted) {
      if (outcome.rejection === 'activeSlotsFull') {
        setMessage('Rail is full — wait for a charge to land.');
        feedback.emit('denied');
        return;
      }
      setMessage(outcome.rejection === 'noTargets' ? 'No exposed matching pixels yet.' :
        outcome.rejection === 'holdingFull' ? 'Free a Holding slot first.' : 'That charge is no longer available.');
      return;
    }
    setMessage('');
    feedback.emit('launch', { haptic: false });
    truth.current = outcome.state;
    if (holdingSlots) holdingSlotsRef.current = holdingSlots;
    if (outcome.launchedCharge) {
      advanceTutorial({
        type: 'launchAccepted',
        action: { kind: action.kind, id: action.id },
        chargeId: outcome.launchedCharge.id,
        capacity: outcome.launchedCharge.capacity,
      });
    }
    setEngineState(outcome.state);
    let presentedHolding = view.current.holding;
    if (action.kind === 'holding') {
      presentedHolding = view.current.holding.filter((charge) => charge.id !== action.id);
      const pending = [...active.current.values()]
        .filter((flight) => flight.pass.endKind === 'toHolding' && !hasPresentedHoldingLanding(flight))
        .sort((a, b) => a.pass.passId - b.pass.passId);
      pending.forEach((flight, index) => {
        const slot = presentedHolding.length + index;
        const target = holdingSlotsRef.current[slot];
        flight.pass = {
          ...flight.pass,
          holdingSlotIndex: slot,
          ...(target ? { holdingTarget: target } : {}),
        };
      });
    }
    let pass = buildLaunchScript(outcome, before, ++serial.current, from).pass;
    if (isCoreV2(before.ruleset)) {
      pass = {
        ...pass,
        launchedAtMs: Date.now(),
      };
      pass = applyCoreV2Convoy(pass, [...active.current.values()].map((f) => f.pass));
    }
    if (pass.endKind === 'toHolding') {
      const pending = [...active.current.values()]
        .filter((flight) => flight.pass.endKind === 'toHolding' && !hasPresentedHoldingLanding(flight))
        .map((flight) => flight.pass);
      const slot = reserveHoldingSlot(presentedHolding, pending, outcome.state.holdingCapacity);
      const target = holdingSlotsRef.current[slot];
      pass = {
        ...pass,
        holdingSlotIndex: slot,
        ...(target ? { holdingTarget: target } : {}),
      };
    }
    active.current.set(pass.passId, { pass, outcome, cursor: 0 });
    // Show the source consumption immediately; keep the board itself lagged.
    view.current = {
      ...view.current,
      movesApplied: outcome.state.movesApplied,
      tunnels: outcome.state.tunnels,
      holding: presentedHolding,
    };
    setState(view.current);
    publishFlights();
  }, [publishFlights, advanceTutorial]);

  const presentThrough = useCallback((passId: number, count: number) => {
    const flight = active.current.get(passId);
    if (!flight) return;
    const end = Math.min(count, flight.pass.events.length);
    for (; flight.cursor < end; flight.cursor++) {
      const event = flight.pass.events[flight.cursor]!;
      if (event.kind === 'pixelClear') {
        view.current = { ...view.current, pixels: view.current.pixels.map((p) =>
          p.id === event.pixelId ? { ...p, cleared: true } : p) };
        if (typeof event.remaining === 'number') {
          advanceTutorial({
            type: 'hitResolved',
            chargeId: flight.pass.charge.id,
            remaining: event.remaining,
          });
        }
      } else if (event.kind === 'linkGroupClear') {
        const cleared = new Set(event.pixelIds ?? []);
        view.current = { ...view.current, pixels: view.current.pixels.map((p) =>
          cleared.has(p.id) ? { ...p, cleared: true } : p) };
      } else if (event.kind === 'frozenHit' || event.kind === 'linkPrime') {
        // The ice cracked — mirror the engine's updated modifier; the pixel stays.
        const truthPixel = truth.current.pixels.find((p) => p.id === event.pixelId);
        if (truthPixel) {
          view.current = { ...view.current, pixels: view.current.pixels.map((p) =>
            p.id === event.pixelId ? { ...p, modifier: truthPixel.modifier } : p) };
        }
      } else if (event.kind === 'shieldHit') {
        const truthPixel = truth.current.pixels.find((p) => p.id === event.pixelId);
        if (truthPixel) {
          view.current = { ...view.current, pixels: view.current.pixels.map((p) =>
            p.id === event.pixelId ? { ...p, modifier: truthPixel.modifier } : p) };
        }
      } else if (event.kind === 'holdingLanded') {
        // Engine truth already parked every remaining-capacity charge in the
        // epoch. Presentation Holding occupies a slot only after THIS Pal's
        // own landing beat — convoy-delayed trailers stay off the tray.
        view.current = {
          ...view.current,
          holding: appendPresentedHolding(view.current.holding, flight.outcome.heldCharge),
        };
        if (truth.current.status === 'playing') setMessage('Tap a held charge to launch it again.');
        advanceTutorial({ type: 'holdingEntered', chargeId: flight.pass.charge.id });
      } else if (event.kind === 'win' || event.kind === 'fail') {
        view.current = { ...truth.current, holding: view.current.holding };
        if (event.kind === 'win') advanceTutorial({ type: 'levelWon' });
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
      } else if (event.kind === 'frozenHit') {
        feedback.emit('iceCrack', { haptic: !replacedImpact, voice: 'shot' });
      } else if (event.kind === 'shieldHit') {
        feedback.emit('shieldBreak', { haptic: !replacedImpact, voice: 'shot' });
      } else if (event.kind === 'linkPrime') {
        feedback.emit('linkPrime', { haptic: !replacedImpact, voice: 'shot' });
      } else if (event.kind === 'linkGroupClear') {
        feedback.emit(event.final ? 'finalClear' : 'linkClear', { haptic: !replacedImpact, voice: 'shot' });
      } else {
        const soundEvent = event.kind === 'holdingLanded' ? 'holdingLand' : event.kind;
        feedback.emit(soundEvent, { haptic: event.kind === 'win' ? false : !replacedImpact });
      }
    }
    setState(view.current);
  }, [reportResult, settleAll, publishFlights, advanceTutorial]);

  const restart = useCallback(() => {
    active.current.clear();
    feedback.cancelPending();
    cancelHits();
    const fresh = createGame(level);
    truth.current = fresh; view.current = fresh; reported.current = false;
    setState(fresh); setEngineState(fresh); setFlights([]); setMessage('');
    commitTutorial(
      tutorialRef.current.completed
        ? tutorialRef.current
        : createTutorial(level, optionsRef.current.completedTutorials),
    );
  }, [level, commitTutorial]);

  const launch = useCallback((id: string, from?: Point, holdingSlots?: (Point | undefined)[]) => {
    perform({ kind: 'tunnel', id }, from, holdingSlots);
  }, [perform]);
  const launchHeld = useCallback((id: string, from?: Point, holdingSlots?: (Point | undefined)[]) => {
    perform({ kind: 'holding', id }, from, holdingSlots);
  }, [perform]);

  const cap = engineState.activeCapacity || DEFAULT_ACTIVE_CAPACITY;
  return {
    state, engineState, locked: flights.length >= cap,
    flights, flightPass: flights[flights.length - 1] ?? null,
    canLaunch: state.status === 'playing' && flights.length < cap,
    activeCount: flights.length,
    activeCapacity: cap,
    message,
    tutorial: toTutorialView(tutorial),
    launch,
    launchHeld,
    presentThrough, restart,
  };
}
