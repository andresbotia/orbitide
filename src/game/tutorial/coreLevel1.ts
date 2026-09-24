import { createGame } from '@/game/engine/createGame';
import { resolveLaunch } from '@/game/engine/resolveLaunch';
import { isCoreV2 } from '@/game/engine/ruleset';
import type { GameState, LevelDefinition } from '@/game/engine/types';
import {
  TUTORIAL_IDS,
  type TutorialAction,
  type TutorialActivationInput,
  type TutorialEvent,
  type TutorialFlags,
  type TutorialGating,
  type TutorialHighlight,
  type TutorialId,
  type TutorialInteraction,
  type TutorialStage,
  type TutorialView,
} from './types';

export { TUTORIAL_IDS };
export type { TutorialView };

/**
 * M5.7 authoring contract for the Core V2 Level 1 tutorial. Campaign Level 1
 * is still Legacy V1; do not convert it in this milestone. When M5.7 authors
 * Core V2 Level 1, `inspectCoreLevel1TutorialFit` must return `ok: true`.
 */
export const CORE_LEVEL1_TUTORIAL_AUTHORING = {
  tutorialId: TUTORIAL_IDS.coreLevel1,
  levelId: 1,
  ruleset: 'coreV2',
  tunnelCount: 3,
  holdingCapacity: 3,
  requirements: [
    'ruleset must be coreV2 (Legacy V1 never runs this tutorial)',
    'exactly 3 tunnels, holdingCapacity 3',
    'the intended first tunnel launch must hit at least one front-visible matching pixel',
    'that pass must finish a full lap with remaining capacity > 0 and enter Holding',
    'the level must still be playing after that first pass (not already won)',
    'no Frozen / Shielded / Linked / other special mechanics on Level 1',
  ],
} as const;

export interface TutorialState {
  id: TutorialId;
  active: boolean;
  completed: boolean;
  stage: TutorialStage;
  intendedTunnelId: string | null;
  teachingChargeId: string | null;
  launchedCapacity: number;
  heldChargeId: string | null;
  flags: TutorialFlags;
}

const EMPTY_FLAGS: TutorialFlags = {
  sawLaunch: false,
  sawHit: false,
  sawCountDecrement: false,
  sawHolding: false,
  sawRelaunch: false,
};

function emptyFlags(): TutorialFlags {
  return { ...EMPTY_FLAGS };
}

function completedSet(
  completed: Iterable<string> | null | undefined,
): Set<string> | null {
  if (completed == null) return null;
  return completed instanceof Set ? completed : new Set(completed);
}

export function shouldActivateCoreLevel1Tutorial(
  input: TutorialActivationInput,
): boolean {
  const completed = completedSet(input.completed);
  if (completed == null) return false;
  if (input.levelId !== 1) return false;
  if (!isCoreV2(input.ruleset)) return false;
  if (completed.has(TUTORIAL_IDS.coreLevel1)) return false;
  return true;
}

export interface IntendedTutorialLaunch {
  tunnelId: string;
  chargeId: string;
  capacity: number;
}

/**
 * Ask the engine which tunnel actually teaches hit → remainder → Holding.
 * Does not reimplement targeting; it observes `resolveLaunch`.
 */
export function pickIntendedTutorialLaunch(
  level: LevelDefinition,
): IntendedTutorialLaunch | null {
  if (level.id !== 1 || !isCoreV2(level.ruleset)) return null;
  try {
    const state = createGame(level);
    for (const tunnel of state.tunnels) {
      if (!tunnel.queue[0]) continue;
      const outcome = resolveLaunch(state, tunnel.id);
      if (!outcome.accepted || !outcome.launchedCharge || !outcome.pass) continue;
      const hits = outcome.pass.encounters.filter(
        (e) => !e.frozenBreak && !e.shieldBreak && !e.linkedPrime,
      );
      if (hits.length < 1) continue;
      if (!outcome.heldCharge || outcome.heldCharge.capacity <= 0) continue;
      if (outcome.state.status !== 'playing') continue;
      return {
        tunnelId: tunnel.id,
        chargeId: outcome.launchedCharge.id,
        capacity: outcome.launchedCharge.capacity,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export interface CoreLevel1TutorialFit {
  ok: boolean;
  intended: IntendedTutorialLaunch | null;
  reasons: string[];
}

export function inspectCoreLevel1TutorialFit(
  level: LevelDefinition,
): CoreLevel1TutorialFit {
  const reasons: string[] = [];
  if (level.id !== 1) reasons.push('levelId is not 1');
  if (!isCoreV2(level.ruleset)) reasons.push('ruleset is not coreV2');
  const intended = pickIntendedTutorialLaunch(level);
  if (!intended) reasons.push('no tunnel launch hits, keeps remainder, and parks in Holding');
  return { ok: reasons.length === 0 && intended != null, intended, reasons };
}

function inactiveState(completed: boolean): TutorialState {
  return {
    id: TUTORIAL_IDS.coreLevel1,
    active: false,
    completed,
    stage: completed ? 'completed' : 'inactive',
    intendedTunnelId: null,
    teachingChargeId: null,
    launchedCapacity: 0,
    heldChargeId: null,
    flags: emptyFlags(),
  };
}

export function createTutorial(
  level: LevelDefinition,
  completed: Iterable<string> | null | undefined,
): TutorialState {
  const done = completedSet(completed);
  const already = done?.has(TUTORIAL_IDS.coreLevel1) === true;
  if (
    !shouldActivateCoreLevel1Tutorial({
      levelId: level.id,
      ruleset: level.ruleset,
      completed,
    })
  ) {
    return inactiveState(already);
  }
  const intended = pickIntendedTutorialLaunch(level);
  return {
    id: TUTORIAL_IDS.coreLevel1,
    active: true,
    completed: false,
    stage: 'launch',
    intendedTunnelId: intended?.tunnelId ?? firstLoadedTunnelId(level),
    teachingChargeId: null,
    launchedCapacity: 0,
    heldChargeId: null,
    flags: emptyFlags(),
  };
}

function firstLoadedTunnelId(level: LevelDefinition): string | null {
  try {
    const state = createGame(level);
    const tunnel = state.tunnels.find((t) => t.queue.length > 0);
    return tunnel?.id ?? 'tunnel-0';
  } catch {
    return 'tunnel-0';
  }
}

export function syncTutorialCompletion(
  state: TutorialState,
  completed: Iterable<string> | null | undefined,
  level: LevelDefinition,
): TutorialState {
  const done = completedSet(completed);
  if (done == null) return state;
  if (done.has(state.id) || state.completed) {
    if (state.completed && !state.active) return state;
    return inactiveState(true);
  }
  if (!state.active && shouldActivateCoreLevel1Tutorial({
    levelId: level.id,
    ruleset: level.ruleset,
    completed: done,
  })) {
    return createTutorial(level, done);
  }
  return state;
}

export function applyTutorialEvent(
  state: TutorialState,
  event: TutorialEvent,
): TutorialState {
  if (!state.active || state.completed) {
    if (event.type === 'levelWon' && state.active) return complete(state);
    return state;
  }

  switch (event.type) {
    case 'launchAccepted':
      return onLaunchAccepted(state, event);
    case 'hitResolved':
      return onHitResolved(state, event);
    case 'holdingEntered':
      return onHoldingEntered(state, event);
    case 'levelWon':
      return complete(state);
    default:
      return state;
  }
}

function onLaunchAccepted(
  state: TutorialState,
  event: Extract<TutorialEvent, { type: 'launchAccepted' }>,
): TutorialState {
  if (state.stage === 'launch') {
    if (event.action.kind !== 'tunnel') return state;
    if (state.intendedTunnelId && event.action.id !== state.intendedTunnelId) {
      return state;
    }
    return {
      ...state,
      stage: 'observeHit',
      teachingChargeId: event.chargeId,
      launchedCapacity: event.capacity,
      flags: { ...state.flags, sawLaunch: true },
    };
  }
  if (state.stage === 'observeHolding' || state.stage === 'relaunchHeld') {
    if (event.action.kind !== 'holding') return state;
    if (state.heldChargeId && event.action.id !== state.heldChargeId) return state;
    return {
      ...state,
      stage: 'freePlay',
      flags: { ...state.flags, sawRelaunch: true },
    };
  }
  return state;
}

function onHitResolved(
  state: TutorialState,
  event: Extract<TutorialEvent, { type: 'hitResolved' }>,
): TutorialState {
  if (state.stage !== 'observeHit') return state;
  if (state.teachingChargeId && event.chargeId !== state.teachingChargeId) {
    return state;
  }
  const decremented =
    state.launchedCapacity > 0 && event.remaining < state.launchedCapacity;
  if (!decremented && event.remaining >= state.launchedCapacity) return state;
  const sawCountDecrement = state.flags.sawCountDecrement || decremented;
  // Every pixel hit of a multi-hit charge reaches here once sawHit/sawCountDecrement
  // are already true — bail instead of allocating a same-valued object every time,
  // so commitTutorial's `prev === next` check skips the no-op re-render.
  if (state.flags.sawHit && state.flags.sawCountDecrement === sawCountDecrement) return state;
  return {
    ...state,
    flags: {
      ...state.flags,
      sawHit: true,
      sawCountDecrement,
    },
  };
}

function onHoldingEntered(
  state: TutorialState,
  event: Extract<TutorialEvent, { type: 'holdingEntered' }>,
): TutorialState {
  if (state.stage !== 'observeHit') return state;
  if (state.teachingChargeId && event.chargeId !== state.teachingChargeId) {
    return state;
  }
  if (!state.flags.sawHit) return state;
  return {
    ...state,
    stage: 'relaunchHeld',
    heldChargeId: event.chargeId,
    flags: { ...state.flags, sawHolding: true },
  };
}

function complete(state: TutorialState): TutorialState {
  return {
    ...state,
    active: false,
    completed: true,
    stage: 'completed',
    intendedTunnelId: state.intendedTunnelId,
    teachingChargeId: state.teachingChargeId,
    heldChargeId: state.heldChargeId,
    flags: { ...state.flags },
  };
}

/**
 * When presentation is skipped (background settle), catch up from engine
 * truth so gating cannot trap the player in `observeHit`.
 */
export function catchUpTutorial(
  state: TutorialState,
  game: GameState,
): TutorialState {
  if (!state.active || state.completed) {
    if (game.status === 'won' && state.active) return complete(state);
    return state;
  }
  let next = state;
  if (next.stage === 'observeHit' && next.teachingChargeId) {
    const held = game.holding.find((c) => c.id === next.teachingChargeId);
    if (held) {
      if (next.launchedCapacity > 0 && held.capacity < next.launchedCapacity) {
        next = applyTutorialEvent(next, {
          type: 'hitResolved',
          chargeId: held.id,
          remaining: held.capacity,
        });
      }
      next = applyTutorialEvent(next, {
        type: 'holdingEntered',
        chargeId: held.id,
      });
    }
  }
  if (game.status === 'won') next = applyTutorialEvent(next, { type: 'levelWon' });
  return next;
}

/**
 * Tutorial guidance is advisory only — engine legality determines whether an action
 * is allowed. Legal actions (tunnel launches and held-Pal relaunches) are never
 * blocked by the tutorial state machine.
 */
export function isTutorialActionAllowed(
  _state: TutorialState,
  _action: TutorialAction,
): boolean {
  return true;
}

function gatingFor(state: TutorialState): TutorialGating {
  if (!state.active || state.completed) {
    return { tunnelIds: 'all', holdingIds: 'all' };
  }
  switch (state.stage) {
    case 'launch':
      return {
        tunnelIds: state.intendedTunnelId ? [state.intendedTunnelId] : 'all',
        holdingIds: 'none',
      };
    case 'observeHit':
      return { tunnelIds: 'none', holdingIds: 'none' };
    case 'observeHolding':
    case 'relaunchHeld':
      return {
        tunnelIds: 'none',
        holdingIds: state.heldChargeId ? [state.heldChargeId] : 'none',
      };
    default:
      return { tunnelIds: 'all', holdingIds: 'all' };
  }
}

function highlightFor(state: TutorialState): TutorialHighlight {
  if (!state.active) return { kind: 'none' };
  if (state.stage === 'launch' && state.intendedTunnelId) {
    return { kind: 'tunnel', tunnelId: state.intendedTunnelId };
  }
  if (
    (state.stage === 'observeHolding' || state.stage === 'relaunchHeld')
    && state.heldChargeId
  ) {
    return { kind: 'heldCharge', chargeId: state.heldChargeId };
  }
  return { kind: 'none' };
}

function interactionFor(state: TutorialState): TutorialInteraction {
  if (!state.active) return 'none';
  switch (state.stage) {
    case 'launch':
      return 'launchTunnel';
    case 'observeHit':
      return 'watch';
    case 'observeHolding':
    case 'relaunchHeld':
      return 'relaunchHeld';
    case 'freePlay':
      return 'freePlay';
    default:
      return 'none';
  }
}

export function toTutorialView(state: TutorialState): TutorialView {
  return {
    id: state.id,
    active: state.active,
    completed: state.completed,
    stage: state.stage,
    highlight: highlightFor(state),
    interaction: interactionFor(state),
    gating: gatingFor(state),
    flags: { ...state.flags },
  };
}

export const INACTIVE_TUTORIAL_VIEW: TutorialView = toTutorialView(
  inactiveState(false),
);
