import type { LaunchOutcome } from '@/game/engine/resolveLaunch';
import type { GameState } from '@/game/engine/types';
import { FEEL } from './constants';
import type { FlightPass, Point, PresentationScript, PlaybackEvent } from './events';

export function buildLaunchScript(outcome: LaunchOutcome, prevState: GameState,
  passId = 1, from?: Point, holdingTarget?: Point): PresentationScript {
  if (!outcome.accepted || !outcome.pass || !outcome.launchedCharge) throw new Error('Cannot present a rejected action');
  const chargePass = outcome.pass;
  const shots = chargePass.encounters.map((encounter, i) => {
    const target = prevState.pixels.find((p) => p.id === encounter.pixelId);
    if (!target) throw new Error(`Unknown target ${encounter.pixelId}`);
    const anticipateAt = FEEL.LAUNCH_DURATION + encounter.progress * FEEL.ORBIT_DURATION + i * FEEL.PIXEL_CLEAR_INTERVAL;
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
  const orbitEndAt = chargePass.charge.capacity === 0 && shots.length > 0
    ? shots[shots.length - 1]!.clearAt
    : FEEL.LAUNCH_DURATION + chargePass.progress * FEEL.ORBIT_DURATION + shots.length * FEEL.PIXEL_CLEAR_INTERVAL;
  const landingAt = orbitEndAt + (outcome.heldCharge ? FEEL.HOLDING_TRAVEL_DURATION : FEEL.BURST_DURATION);
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
    { kind: outcome.heldCharge ? 'holdingLanded' : 'chargeConsumed', at: outcome.heldCharge ? landingAt : orbitEndAt },
  ];
  if (outcome.heldCharge) {
    const before = prevState.holding.length - (outcome.action.kind === 'holding' ? 1 : 0);
    const after = outcome.state.holding.length;
    // Returning to the same occupancy is not a new pressure warning.
    if (after > prevState.holding.length && after === 2 && before < 2) events.push({ kind: 'holdingCritical', at: landingAt });
    if (after > prevState.holding.length && after === 3 && outcome.state.status !== 'lost') events.push({ kind: 'holdingFull', at: landingAt });
  }
  const resultAt = landingAt + (won ? FEEL.WIN_DELAY : FEEL.FAIL_DELAY);
  if (outcome.state.status !== 'playing') events.push({ kind: outcome.state.status === 'won' ? 'win' : 'fail', at: resultAt });
  const totalMs = (outcome.state.status === 'playing' ? landingAt : resultAt) + 20;
  events.push({ kind: 'complete', at: totalMs });
  events.sort((a, b) => a.at - b.at);
  const pass: FlightPass = { passId, origin: outcome.action.kind, sourceIndex: outcome.sourceIndex,
    from, holdingTarget, charge: outcome.launchedCharge, shots, liftMs: FEEL.LAUNCH_DURATION,
    orbitEndAt, endProgress: chargePass.progress, landingAt, totalMs,
    endKind: outcome.heldCharge ? 'toHolding' : 'burst', events, finalClearPixelId };
  return { pass, totalMs };
}
