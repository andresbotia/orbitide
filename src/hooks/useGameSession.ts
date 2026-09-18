import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { DEFAULT_ACTIVE_CAPACITY } from '@/game/engine/concurrency';
import { createGame } from '@/game/engine/createGame';
import { epochHasCapacity } from '@/game/engine/epoch';
import { resolveAction } from '@/game/engine/resolveLaunch';
import { isCoreV2 } from '@/game/engine/ruleset';
import type { GameAction } from '@/game/engine/actions';
import type { GameState, LevelDefinition } from '@/game/engine/types';
import { feedback } from '@/game/feedback';
import { cancelHits, registerHit } from '@/game/hapticArbiter';
import { requireLevel } from '@/game/levels/levels';
import { buildLaunchScript } from '@/game/presentation/buildScript';
import type { FlightPass, Point } from '@/game/presentation/events';
import { commitLandings, holdingSlotFor, terminalProblem } from '@/game/presentation/holdingSlot';
import { assignResult, reconcileFlights } from '@/game/presentation/reconcile';
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

/**
 * One Pal on the rail. `pass` is re-scripted (unplayed tail only) on every
 * accepted launch, so it always reflects the latest reconciled truth.
 */
interface ActiveFlight { pass: FlightPass; cursor: number }

/** True once this flight has presented its own Holding arrival beat. */
function hasPresentedHoldingLanding(flight: ActiveFlight): boolean {
  if (flight.pass.terminal.kind !== 'toHolding') return false;
  const at = flight.pass.events.findIndex((event) => event.kind === 'holdingLanded');
  return at >= 0 && flight.cursor > at;
}

// DEV-only lifecycle asserts at boundaries (launch, re-script, landing,
// complete). Read at call time: ts-jest has no RN-injected `__DEV__`.
const isDev = () => typeof __DEV__ !== 'undefined' && __DEV__;
function lifecycleProblem(message: string): void {
  if (isDev()) console.error('[PA_LIFECYCLE]', message);
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
  /** Returns whether the tap was accepted — the tapped element uses this for local denied feedback. */
  launch: (tunnelId: string, from?: Point, holdingSlots?: (Point | undefined)[]) => boolean;
  launchHeld: (chargeId: string, from?: Point, holdingSlots?: (Point | undefined)[]) => boolean;
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
  /** Pals that reached their slot but wait for a lower slot's Pal to land first. */
  const landedIds = useRef(new Set<string>());
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
    viewFlushQueued.current = false;
    active.current.clear();
    landedIds.current.clear();
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
  /** Coalesce multi-flight `presentThrough` commits so 5 Pals clearing in
   *  one frame don't each force a full GameScreen render. */
  const viewFlushQueued = useRef(false);
  const queueViewFlush = useCallback(() => {
    if (process.env.NODE_ENV === 'test') {
      setState(view.current);
      return;
    }
    if (viewFlushQueued.current) return;
    viewFlushQueued.current = true;
    requestAnimationFrame(() => {
      viewFlushQueued.current = false;
      setState(view.current);
    });
  }, []);

  /** Extend presented Holding with landed Pals, strictly in truth slot order. */
  const commitHolding = useCallback((): string[] => {
    const { holding, committed } = commitLandings(view.current.holding, truth.current.holding, landedIds.current);
    if (committed.length) view.current = { ...view.current, holding };
    return committed;
  }, []);

  const perform = useCallback((action: GameAction, from?: Point, holdingSlots?: (Point | undefined)[]): boolean => {
    if (truth.current.status !== 'playing') return false;
    if (!isTutorialActionAllowed(tutorialRef.current, action)) {
      feedback.emit('denied');
      return false;
    }
    const cap = truth.current.activeCapacity || DEFAULT_ACTIVE_CAPACITY;
    // Visible flights occupy Active slots until they land. Deny with no mutation.
    if (action.kind === 'holding') {
      for (const flight of active.current.values()) {
        if (flight.pass.charge.id === action.id && !hasPresentedHoldingLanding(flight)) {
          feedback.emit('denied');
          return false;
        }
      }
    }
    if (active.current.size >= cap) {
      setMessage('Rail is full — wait for a Pal to land.');
      feedback.emit('denied');
      return false;
    }
    const joining = active.current.size > 0 && epochHasCapacity(truth.current);
    const before = truth.current;
    const outcome = resolveAction(before, { ...action, join: joining });
    if (!outcome.accepted) {
      if (outcome.rejection === 'activeSlotsFull') {
        setMessage('Rail is full — wait for a Pal to land.');
      } else if (outcome.rejection === 'noTargets') {
        setMessage('No exposed matching pixels yet.');
      } else {
        setMessage('That Pal is no longer available.');
      }
      feedback.emit('denied');
      return false;
    }
    setMessage('');
    // Light/selection haptic immediately on accepted Pal interaction.
    feedback.emit(action.kind === 'holding' ? 'heldRelaunch' : 'select');
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
      presentedHolding = presentedHolding.filter((charge) => charge.id !== action.id);
    }
    const now = Date.now();
    const fresh: FlightPass = { ...buildLaunchScript(outcome, before, ++serial.current, from).pass, launchedAtMs: now };
    // Reconcile every flight with the new truth: unplayed tails, terminals and
    // slots follow the latest resolution; presented prefixes never change.
    const { passes, divergences } = reconcileFlights({
      flights: [...active.current.values(), { pass: fresh, cursor: 0 }],
      freshPassId: fresh.passId,
      truth: outcome.state,
      resolutions: outcome.epochCharges ?? [],
      pixels: before.pixels,
      now,
      slotPoints: holdingSlotsRef.current,
      convoy: isCoreV2(before.ruleset),
    });
    for (const pass of assignResult(passes, outcome.state.status, now)) {
      const flight = active.current.get(pass.passId);
      if (flight) flight.pass = pass;
      else active.current.set(pass.passId, { pass, cursor: 0 });
      const problem = terminalProblem(pass, outcome.state.holdingCapacity);
      if (problem) lifecycleProblem(problem);
    }
    if (isDev() && divergences.length) {
      console.warn('[PA_HISTORY] a join changed already-presented history:',
        divergences.map((d) => `${d.chargeId}@${Math.round(d.presentedMs)}ms ${d.detail}`).join('; '));
    }
    // Show the source consumption immediately; keep the board itself lagged.
    view.current = {
      ...view.current,
      movesApplied: outcome.state.movesApplied,
      tunnels: outcome.state.tunnels,
      holding: presentedHolding,
    };
    commitHolding();
    setState(view.current);
    publishFlights();
    return true;
  }, [publishFlights, advanceTutorial, commitHolding]);

  const presentThrough = useCallback((passId: number, count: number) => {
    const flight = active.current.get(passId);
    if (!flight) return;
    const end = Math.min(count, flight.pass.events.length);
    let nextPixels = view.current.pixels;
    let pixelsDirty = false;
    for (; flight.cursor < end; flight.cursor++) {
      const event = flight.pass.events[flight.cursor]!;
      if (event.kind === 'pixelClear') {
        if (!pixelsDirty) { nextPixels = [...nextPixels]; pixelsDirty = true; }
        const idx = nextPixels.findIndex((p) => p.id === event.pixelId);
        if (idx !== -1) nextPixels[idx] = { ...nextPixels[idx]!, cleared: true };
        if (typeof event.remaining === 'number') {
          advanceTutorial({
            type: 'hitResolved',
            chargeId: flight.pass.charge.id,
            remaining: event.remaining,
          });
        }
      } else if (event.kind === 'linkGroupClear') {
        if (!pixelsDirty) { nextPixels = [...nextPixels]; pixelsDirty = true; }
        const cleared = new Set(event.pixelIds ?? []);
        for (let i = 0; i < nextPixels.length; i++) {
          if (cleared.has(nextPixels[i]!.id)) {
            nextPixels[i] = { ...nextPixels[i]!, cleared: true };
          }
        }
      } else if (event.kind === 'frozenHit' || event.kind === 'linkPrime' || event.kind === 'shieldHit') {
        // The ice/shield cracked — mirror the engine's updated modifier; the pixel stays.
        const truthPixel = truth.current.pixels.find((p) => p.id === event.pixelId);
        if (truthPixel) {
          if (!pixelsDirty) { nextPixels = [...nextPixels]; pixelsDirty = true; }
          const idx = nextPixels.findIndex((p) => p.id === event.pixelId);
          if (idx !== -1) nextPixels[idx] = { ...nextPixels[idx]!, modifier: truthPixel.modifier };
        }
      } else if (event.kind === 'holdingLanded') {
        // The pass was re-scripted against the latest truth, so this Pal is
        // one truth keeps, landing in its truth slot with truth's capacity.
        const id = flight.pass.charge.id;
        if (holdingSlotFor(truth.current.holding, id) < 0) lifecycleProblem(`${id} landed but truth Holding does not keep it`);
        landedIds.current.add(id);
        const committed = commitHolding();
        if (!committed.includes(id)) lifecycleProblem(`${id} landed ahead of a lower Holding slot`);
        if (committed.length && truth.current.status === 'playing') setMessage('Tap a held Pal to launch it again.');
        for (const chargeId of committed) advanceTutorial({ type: 'holdingEntered', chargeId });
      } else if (event.kind === 'win' || event.kind === 'fail') {
        // Status only: board and tray were presented beat by beat and already
        // agree with truth — no snap at the result modal.
        view.current = { ...view.current, status: truth.current.status };
        if (event.kind === 'win') advanceTutorial({ type: 'levelWon' });
        reportResult();
      } else if (event.kind === 'complete') {
        const id = flight.pass.charge.id;
        if (flight.pass.terminal.kind === 'toHolding' && !landedIds.current.has(id)
          && !view.current.holding.some((c) => c.id === id)) {
          lifecycleProblem(`${id} completed toHolding but is in neither Holding nor its landing queue`);
        }
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
    if (pixelsDirty) {
      view.current = { ...view.current, pixels: nextPixels };
    }
    queueViewFlush();
  }, [reportResult, settleAll, publishFlights, advanceTutorial, queueViewFlush, commitHolding]);

  const restart = useCallback(() => {
    active.current.clear();
    landedIds.current.clear();
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
    return perform({ kind: 'tunnel', id }, from, holdingSlots);
  }, [perform]);
  const launchHeld = useCallback((id: string, from?: Point, holdingSlots?: (Point | undefined)[]) => {
    return perform({ kind: 'holding', id }, from, holdingSlots);
  }, [perform]);

  const cap = engineState.activeCapacity || DEFAULT_ACTIVE_CAPACITY;
  return {
    state, engineState, locked: flights.length >= cap,
    flights, flightPass: flights[flights.length - 1] ?? null,
    canLaunch: state.status === 'playing' && truth.current.status === 'playing' && flights.length < cap,
    activeCount: flights.length,
    activeCapacity: cap,
    message,
    tutorial: toTutorialView(tutorial),
    launch,
    launchHeld,
    presentThrough, restart,
  };
}
