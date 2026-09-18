import { isCoreV2 } from '@/game/engine/ruleset';
import type { LaunchOutcome } from '@/game/engine/resolveLaunch';
import type { Encounter } from '@/game/engine/pass';
import { holdingWarnAt } from '@/game/engine/selectors';
import type { Charge, GameState, Pixel } from '@/game/engine/types';
import { CORE_V2_ORBIT_DURATION_MS, FEEL } from './constants';
import type { FlightPass, FlightTerminal, Point, PresentationScript, PlaybackEvent, Shot } from './events';

/**
 * The one terminal a charge's latest resolution implies against reconciled
 * truth. `slot` is the charge's index in truth Holding — the only slot model.
 */
export function terminalFor(chargeId: string, remainingCapacity: number, truth: Pick<GameState, 'holding'>, target?: Point): FlightTerminal {
  if (remainingCapacity <= 0) return { kind: 'consumed' };
  const slot = truth.holding.findIndex((c) => c.id === chargeId);
  if (slot < 0) return { kind: 'reject' };
  return target ? { kind: 'toHolding', slot, target } : { kind: 'toHolding', slot };
}

/** An untimed shot (times are filled in by the base schedule or the convoy). */
export function shotFromEncounter(encounter: Encounter, pixels: readonly Pixel[]): Shot {
  const target = pixels.find((p) => p.id === encounter.pixelId);
  if (!target) throw new Error(`Unknown target ${encounter.pixelId}`);
  const linkedClearTargets = encounter.linkedClearedPixelIds?.map((pixelId) => {
    const pixel = pixels.find((candidate) => candidate.id === pixelId);
    if (!pixel) throw new Error(`Unknown linked target ${pixelId}`);
    return { pixelId, x: pixel.x, y: pixel.y, color: pixel.color };
  });
  return { ...encounter, target: { x: target.x, y: target.y }, anticipateAt: 0, fireAt: 0, impactAt: 0, clearAt: 0,
    frozenBreak: encounter.frozenBreak === true,
    shieldBreak: encounter.shieldBreak === true,
    linkedPrime: encounter.linkedPrime === true,
    linkedGroupClear: encounter.linkedGroupClear === true,
    ...(linkedClearTargets ? { linkedClearTargets } : {}) };
}

/** Time a shot that starts its anticipation at `anticipateAt`. */
export function timedShot(shot: Shot, anticipateAt: number): Shot {
  const fireAt = anticipateAt + FEEL.ANTICIPATION_DURATION;
  const impactAt = fireAt + FEEL.ENERGY_TRAVEL_DURATION;
  return { ...shot, anticipateAt, fireAt, impactAt, clearAt: impactAt + FEEL.IMPACT_DURATION };
}

/** A shot that could never be the picture-completing clear (it leaves the pixel standing). */
export function isNonClearingShot(shot: Shot): boolean {
  return !!(shot.frozenBreak || shot.shieldBreak || shot.linkedPrime);
}

function shotEvent(s: Shot, final: boolean): PlaybackEvent {
  return {
    kind: s.frozenBreak ? 'frozenHit'
      : s.shieldBreak ? 'shieldHit'
        : s.linkedPrime ? 'linkPrime'
          : s.linkedGroupClear ? 'linkGroupClear'
            : 'pixelClear',
    at: s.clearAt, pixelId: s.pixelId, remaining: s.remaining,
    ...(s.linkedClearedPixelIds ? { pixelIds: s.linkedClearedPixelIds } : {}),
    ...(s.linkedGroupId ? { groupId: s.linkedGroupId } : {}),
    final,
  };
}

/**
 * Derive `events` and `totalMs` from a pass's shots, terminal, timing, cue and
 * result. The ONLY place a playback event list is built, so a re-scripted pass
 * reproduces its already-presented prefix byte for byte.
 */
export function finalizePass(pass: Omit<FlightPass, 'events' | 'totalMs'>): FlightPass {
  const landsInHolding = pass.terminal.kind === 'toHolding';
  const last = pass.shots.length - 1;
  const events: PlaybackEvent[] = [
    { kind: 'orbitEnter', at: pass.liftMs },
    ...pass.shots.map((s, i) => shotEvent(s, i === last && pass.finalClearPixelId === s.pixelId)),
    { kind: landsInHolding ? 'holdingLanded' : 'chargeConsumed', at: landsInHolding ? pass.landingAt : pass.orbitEndAt },
  ];
  if (landsInHolding && pass.holdingCue === 'critical') events.push({ kind: 'holdingCritical', at: pass.landingAt });
  if (landsInHolding && pass.holdingCue === 'full') events.push({ kind: 'holdingFull', at: pass.landingAt });
  const resultAt = pass.landingAt + (pass.result === 'win' ? FEEL.WIN_DELAY : FEEL.FAIL_DELAY);
  if (pass.result) events.push({ kind: pass.result, at: resultAt });
  const totalMs = (pass.result ? resultAt : pass.landingAt) + 20;
  events.push({ kind: 'complete', at: totalMs });
  events.sort((a, b) => a.at - b.at);
  return { ...pass, events, totalMs };
}

/** Terminal beat after leaving the rail: travel into the slot, or burst in place. */
export function landingDelay(terminal: FlightTerminal): number {
  return terminal.kind === 'toHolding' ? FEEL.HOLDING_TRAVEL_DURATION : FEEL.BURST_DURATION;
}

/** Holding-pressure cue for a Pal landing into `slot` (occupancy becomes slot + 1). */
export function holdingCueFor(terminal: FlightTerminal, origin: FlightPass['origin'], capacity: number, lost: boolean): FlightPass['holdingCue'] {
  // A held Pal re-parking returns to an occupancy the player already saw.
  if (terminal.kind !== 'toHolding' || origin === 'holding') return undefined;
  const after = terminal.slot + 1;
  if (after === capacity) return lost ? undefined : 'full';
  return after === holdingWarnAt(capacity) ? 'critical' : undefined;
}

export function buildLaunchScript(outcome: LaunchOutcome, prevState: GameState,
  passId = 1, from?: Point, holdingTarget?: Point): PresentationScript {
  if (!outcome.accepted || !outcome.pass || !outcome.launchedCharge) throw new Error('Cannot present a rejected action');
  const chargePass = outcome.pass;
  // M5.3 §6 — Core V2 gets the slower, readable perimeter pass; Legacy V1's
  // pacing is untouched. Resolved once here so nothing downstream re-derives it.
  const orbitMs = isCoreV2(prevState.ruleset) ? CORE_V2_ORBIT_DURATION_MS : FEEL.ORBIT_DURATION;
  const shots = chargePass.encounters.map((encounter, i) => timedShot(
    shotFromEncounter(encounter, prevState.pixels),
    FEEL.LAUNCH_DURATION + encounter.progress * orbitMs + i * FEEL.PIXEL_CLEAR_INTERVAL,
  ));
  const launched: Charge = outcome.launchedCharge;
  const terminal = terminalFor(launched.id, outcome.heldCharge?.capacity ?? 0, outcome.state, holdingTarget);

  // toHolding and reject both complete a full visual lap to GateTerminal
  // (progress 1). Only a consumed Pal ends early, at its last contact.
  const isConsumed = terminal.kind === 'consumed';
  const endProgress = isConsumed ? chargePass.progress : 1;
  const orbitEndAt = isConsumed
    ? shots[shots.length - 1]!.clearAt
    : FEEL.LAUNCH_DURATION + endProgress * orbitMs + shots.length * FEEL.PIXEL_CLEAR_INTERVAL;
  const landingAt = orbitEndAt + landingDelay(terminal);
  const won = outcome.state.status === 'won';
  const lastShot = shots[shots.length - 1];
  // The clear that completes the picture gets a stronger presentation beat (a
  // Frozen crack can never be that clear).
  const finalClearPixelId = won && lastShot && !isNonClearingShot(lastShot) ? lastShot.pixelId : undefined;
  const pass = finalizePass({ passId, origin: outcome.action.kind, sourceIndex: outcome.sourceIndex,
    from, terminal, charge: launched, shots, liftMs: FEEL.LAUNCH_DURATION,
    orbitDurationMs: orbitMs, orbitEndAt, endProgress, landingAt,
    holdingCue: launchHoldingCue(outcome, prevState, terminal),
    ...(outcome.state.status !== 'playing' ? { result: won ? 'win' as const : 'fail' as const } : {}),
    finalClearPixelId, launchedAtMs: 0, convoyHolds: [] });
  return { pass, totalMs: pass.totalMs };
}

/** Standalone (single-launch) pressure cue: relative to the tray before this launch. */
function launchHoldingCue(outcome: LaunchOutcome, prevState: GameState, terminal: FlightTerminal): FlightPass['holdingCue'] {
  if (terminal.kind !== 'toHolding') return undefined;
  const before = prevState.holding.length - (outcome.action.kind === 'holding' ? 1 : 0);
  const after = outcome.state.holding.length;
  // Returning to the same occupancy is not a new pressure warning.
  const cap = outcome.state.holdingCapacity;
  const warnAt = holdingWarnAt(cap);
  if (after > prevState.holding.length && after === cap && outcome.state.status !== 'lost') return 'full';
  if (after > prevState.holding.length && after === warnAt && before < warnAt) return 'critical';
  return undefined;
}
