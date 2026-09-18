import { isCoreV2 } from '@/game/engine/ruleset';
import type { LaunchOutcome } from '@/game/engine/resolveLaunch';
import { holdingWarnAt } from '@/game/engine/selectors';
import type { GameState } from '@/game/engine/types';
import { CORE_V2_ORBIT_DURATION_MS, FEEL } from './constants';
import type { FlightPass, Point, PresentationScript, PlaybackEvent } from './events';

export function buildLaunchScript(outcome: LaunchOutcome, prevState: GameState,
  passId = 1, from?: Point, holdingTarget?: Point): PresentationScript {
  if (!outcome.accepted || !outcome.pass || !outcome.launchedCharge) throw new Error('Cannot present a rejected action');
  const chargePass = outcome.pass;
  // M5.3 §6 — Core V2 gets the slower, readable perimeter pass; Legacy V1's
  // pacing is untouched. Resolved once here so nothing downstream re-derives it.
  const orbitMs = isCoreV2(prevState.ruleset) ? CORE_V2_ORBIT_DURATION_MS : FEEL.ORBIT_DURATION;
  const shots = chargePass.encounters.map((encounter, i) => {
    const target = prevState.pixels.find((p) => p.id === encounter.pixelId);
    if (!target) throw new Error(`Unknown target ${encounter.pixelId}`);
    const anticipateAt = FEEL.LAUNCH_DURATION + encounter.progress * orbitMs + i * FEEL.PIXEL_CLEAR_INTERVAL;
    const fireAt = anticipateAt + FEEL.ANTICIPATION_DURATION;
    const impactAt = fireAt + FEEL.ENERGY_TRAVEL_DURATION;
    const linkedClearTargets = encounter.linkedClearedPixelIds?.map((pixelId) => {
      const pixel = prevState.pixels.find((candidate) => candidate.id === pixelId);
      if (!pixel) throw new Error(`Unknown linked target ${pixelId}`);
      return { pixelId, x: pixel.x, y: pixel.y, color: pixel.color };
    });
    return { ...encounter, target: { x: target.x, y: target.y }, anticipateAt, fireAt, impactAt,
      clearAt: impactAt + FEEL.IMPACT_DURATION,
      frozenBreak: encounter.frozenBreak === true,
      shieldBreak: encounter.shieldBreak === true,
      linkedPrime: encounter.linkedPrime === true,
      linkedGroupClear: encounter.linkedGroupClear === true,
      ...(linkedClearTargets ? { linkedClearTargets } : {}) };
  });
  const fitsInHolding = outcome.state.holding.some((c) => c.id === outcome.launchedCharge?.id);
  const landsInHolding = !!outcome.heldCharge && fitsInHolding;

  // Holding always completes a full visual lap to the bottom-center exit
  // (progress 1) before departing. An unresolved Pal that overflows Holding
  // also completes its full lap to the Holding-entry / terminal point before bursting.
  // Burst ends at the last contact only when all charges were consumed.
  const isConsumed = !outcome.heldCharge && shots.length > 0;
  const endProgress = isConsumed ? chargePass.progress : 1;
  const orbitEndAt = isConsumed
    ? shots[shots.length - 1]!.clearAt
    : FEEL.LAUNCH_DURATION + endProgress * orbitMs + shots.length * FEEL.PIXEL_CLEAR_INTERVAL;
  const landingAt = orbitEndAt + (landsInHolding ? FEEL.HOLDING_TRAVEL_DURATION : FEEL.BURST_DURATION);
  const won = outcome.state.status === 'won';
  const lastShot = shots[shots.length - 1];
  // The clear that completes the picture gets a stronger presentation beat (a
  // Frozen crack can never be that clear).
  const finalClearPixelId = won && lastShot && !lastShot.frozenBreak && !lastShot.shieldBreak && !lastShot.linkedPrime
    ? lastShot.pixelId : undefined;
  const events: PlaybackEvent[] = [
    { kind: 'orbitEnter', at: FEEL.LAUNCH_DURATION },
    ...shots.map((s, i) => ({
      kind: s.frozenBreak ? ('frozenHit' as const)
        : s.shieldBreak ? ('shieldHit' as const)
          : s.linkedPrime ? ('linkPrime' as const)
            : s.linkedGroupClear ? ('linkGroupClear' as const)
              : ('pixelClear' as const),
      at: s.clearAt, pixelId: s.pixelId, remaining: s.remaining,
      ...(s.linkedClearedPixelIds ? { pixelIds: s.linkedClearedPixelIds } : {}),
      ...(s.linkedGroupId ? { groupId: s.linkedGroupId } : {}),
      final: !s.frozenBreak && !s.shieldBreak && !s.linkedPrime && won && i === shots.length - 1,
    })),
    { kind: landsInHolding ? 'holdingLanded' : 'chargeConsumed', at: landsInHolding ? landingAt : orbitEndAt },
  ];
  if (landsInHolding) {
    const before = prevState.holding.length - (outcome.action.kind === 'holding' ? 1 : 0);
    const after = outcome.state.holding.length;
    // Returning to the same occupancy is not a new pressure warning.
    const cap = outcome.state.holdingCapacity;
    const warnAt = holdingWarnAt(cap);
    if (after > prevState.holding.length && after === warnAt && before < warnAt) events.push({ kind: 'holdingCritical', at: landingAt });
    if (after > prevState.holding.length && after === cap && outcome.state.status !== 'lost') events.push({ kind: 'holdingFull', at: landingAt });
  }
  const resultAt = landingAt + (won ? FEEL.WIN_DELAY : FEEL.FAIL_DELAY);
  if (outcome.state.status !== 'playing') events.push({ kind: outcome.state.status === 'won' ? 'win' : 'fail', at: resultAt });
  const totalMs = (outcome.state.status === 'playing' ? landingAt : resultAt) + 20;
  events.push({ kind: 'complete', at: totalMs });
  events.sort((a, b) => a.at - b.at);
  const pass: FlightPass = { passId, origin: outcome.action.kind, sourceIndex: outcome.sourceIndex,
    from, holdingTarget: landsInHolding ? holdingTarget : undefined, charge: outcome.launchedCharge, shots, liftMs: FEEL.LAUNCH_DURATION,
    orbitDurationMs: orbitMs, orbitEndAt, endProgress, landingAt, totalMs,
    endKind: landsInHolding ? 'toHolding' : 'burst', events, finalClearPixelId,
    launchedAtMs: 0, convoyHolds: [] };
  return { pass, totalMs };
}
