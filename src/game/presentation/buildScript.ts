import { pixelAngleFraction } from '@/game/engine/pixels';
import type { LaunchOutcome } from '@/game/engine/resolveLaunch';
import type { Charge, GameState, OrbColor } from '@/game/engine/types';

import { FEEL, TUNNEL_ENTRY_FRACTION } from './constants';
import type { FlightPass, PresentationEvent, PresentationScript } from './events';

function tunnelIndexOf(tunnelId: string | undefined): number {
  const n = Number.parseInt((tunnelId ?? '').replace('tunnel-', ''), 10);
  return Number.isFinite(n) ? n : 0;
}

const HELD_ENTRY_FRACTION = 0.5; // held charges rise from the tray (bottom)
const BURST_MS = 190;

interface PassInput {
  startAt: number;
  origin: 'tunnel' | 'holding';
  tunnelIndex: number;
  entryFraction: number;
  liftMs: number;
  color: OrbColor;
  startCapacity: number;
  clearedPixelIds: string[];
  consumed: boolean;
}

interface PassOutput {
  events: PresentationEvent[];
  /** When this pass (including any holding landing) is fully done. */
  endAt: number;
  /** Clock time the orbit portion ends (used to place the next thing). */
  orbitEndAt: number;
}

/** Clockwise distance from `from` to `to` as a fraction in [0, 1). */
function clockwiseGap(from: number, to: number): number {
  return ((to - from) % 1 + 1) % 1;
}

function schedulePass(
  input: PassInput,
  state: Pick<GameState, 'width' | 'height' | 'pixels'>,
  passId: number,
): PassOutput {
  const events: PresentationEvent[] = [];
  const orbitStartAt = input.startAt + input.liftMs;

  // Order the pixels the way the charge actually sweeps past them: clockwise
  // from the entry point. (Which pixels clear is fixed by the engine; only the
  // pop order/timing is cosmetic.)
  const byArrival = input.clearedPixelIds
    .map((id) => {
      const pixel = state.pixels.find((p) => p.id === id);
      const frac = pixel ? pixelAngleFraction(state, pixel) : 0;
      return { id, offset: clockwiseGap(input.entryFraction, frac) };
    })
    .sort((a, b) => a.offset - b.offset);

  let lastPopAt = orbitStartAt;
  byArrival.forEach((entry, k) => {
    const wanted = orbitStartAt + entry.offset * FEEL.ORBIT_DURATION;
    const spaced = k === 0 ? orbitStartAt : lastPopAt + FEEL.PIXEL_CLEAR_INTERVAL;
    const at = Math.max(wanted, spaced);
    lastPopAt = at;
    events.push({
      kind: 'pixelClear',
      at,
      pixelId: entry.id,
      remaining: input.startCapacity - (k + 1),
    });
  });

  const minOrbitEnd = orbitStartAt + FEEL.ORBIT_DURATION;
  const coastEnd =
    (byArrival.length > 0 ? lastPopAt : orbitStartAt) +
    FEEL.ORBIT_DURATION * FEEL.ORBIT_TAIL_FRACTION;
  const cap = orbitStartAt + FEEL.ORBIT_DURATION * FEEL.MAX_ORBIT_LAPS;
  const orbitEndAt = Math.min(Math.max(minOrbitEnd, coastEnd), cap);
  const orbitMs = orbitEndAt - orbitStartAt;

  const pass: FlightPass = {
    passId,
    origin: input.origin,
    tunnelIndex: input.tunnelIndex,
    entryFraction: input.entryFraction,
    liftMs: input.liftMs,
    orbitMs,
    sweepTurns: Math.max(1, orbitMs / FEEL.ORBIT_DURATION),
    endKind: input.consumed ? 'burst' : 'toHolding',
    color: input.color,
    startCapacity: input.startCapacity,
  };
  events.push({ kind: 'flightStart', at: input.startAt, pass });
  events.push({ kind: 'orbitEnter', at: orbitStartAt });

  let endAt: number;
  if (input.consumed) {
    events.push({ kind: 'chargeConsumed', at: orbitEndAt });
    endAt = orbitEndAt + BURST_MS;
  } else {
    events.push({ kind: 'moveToHolding', at: orbitEndAt });
    endAt = orbitEndAt + FEEL.HOLDING_TRAVEL_DURATION;
  }

  return { events, endAt, orbitEndAt };
}

/**
 * Translate an already-committed {@link LaunchOutcome} into a timed
 * {@link PresentationScript}. Pure and deterministic — no rendering imports, no
 * side effects — so it is unit-testable on its own.
 */
export function buildLaunchScript(
  outcome: LaunchOutcome,
  prevState: GameState,
): PresentationScript {
  let passId = 0;
  const nextPassId = () => (passId += 1);
  const events: PresentationEvent[] = [];
  const post = outcome.state;
  const capacity = prevState.holdingCapacity;

  const tunnelIndex = tunnelIndexOf(outcome.tunnelId);
  events.push({ kind: 'launch', at: 0, tunnelIndex });

  let heldCount = prevState.holding.length;
  const bumpHeld = (delta: number, at: number) => {
    heldCount += delta;
    if (delta > 0 && heldCount === capacity - 1) {
      events.push({ kind: 'holdingCritical', at: at + 40 });
    }
  };

  // --- primary pass ---
  const launched = outcome.launchedCharge;
  const primary = schedulePass(
    {
      startAt: 0,
      origin: 'tunnel',
      tunnelIndex,
      entryFraction: TUNNEL_ENTRY_FRACTION[tunnelIndex] ?? 0.5,
      liftMs: FEEL.LAUNCH_DURATION,
      color: launched?.color ?? 'white',
      startCapacity: launched?.capacity ?? 0,
      clearedPixelIds: outcome.primaryClearedPixelIds,
      consumed: outcome.primaryConsumed,
    },
    post,
    nextPassId(),
  );
  events.push(...primary.events);

  let cursor = primary.endAt;
  if (!outcome.primaryConsumed && outcome.heldCharge) {
    const landed: Charge = { ...outcome.heldCharge };
    events.push({ kind: 'holdingLanded', at: primary.endAt, charge: landed });
    bumpHeld(1, primary.endAt);
  }

  // --- held-charge auto-resolutions, one at a time ---
  for (const ar of outcome.autoResolutions) {
    const startAt = cursor + FEEL.HELD_RELAUNCH_GAP;
    events.push({ kind: 'heldReactivate', at: startAt, chargeId: ar.chargeId });
    bumpHeld(-1, startAt);

    const before = ar.remainingCapacity + ar.clearedPixelIds.length;
    const pass = schedulePass(
      {
        startAt,
        origin: 'holding',
        tunnelIndex: 0,
        entryFraction: HELD_ENTRY_FRACTION,
        liftMs: FEEL.HELD_LIFT_DURATION,
        color: ar.color,
        startCapacity: before,
        clearedPixelIds: ar.clearedPixelIds,
        consumed: ar.consumed,
      },
      post,
      nextPassId(),
    );
    events.push(...pass.events);
    cursor = pass.endAt;

    if (!ar.consumed) {
      const returned: Charge = {
        id: ar.chargeId,
        color: ar.color,
        capacity: ar.remainingCapacity,
      };
      events.push({ kind: 'heldReturn', at: pass.endAt, charge: returned });
      bumpHeld(1, pass.endAt);
    }
  }

  // --- resolution ---
  let totalMs: number;
  if (post.status === 'won') {
    events.push({ kind: 'win', at: cursor + FEEL.WIN_DELAY });
    totalMs = cursor + FEEL.WIN_DELAY + 120;
  } else if (post.status === 'lost') {
    events.push({ kind: 'fail', at: cursor + FEEL.FAIL_DELAY });
    totalMs = cursor + FEEL.FAIL_DELAY + 120;
  } else {
    totalMs = cursor + 80;
  }

  events.sort((a, b) => a.at - b.at);

  const deferredPixelIds = [
    ...outcome.primaryClearedPixelIds,
    ...outcome.autoResolutions.flatMap((r) => r.clearedPixelIds),
  ];

  return { events, totalMs, deferredPixelIds };
}
