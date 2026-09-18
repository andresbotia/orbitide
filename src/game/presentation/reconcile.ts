import type { ActiveCharge, GameState, Pixel } from '@/game/engine/types';
import { finalizePass, holdingCueFor, isNonClearingShot, landingDelay, shotFromEncounter, terminalFor } from './buildScript';
import { pickLeader, scheduleRail, type RailResume } from './convoy';
import type { FlightPass, FlightTerminal, Point } from './events';
import { progressAt } from './motion';

/**
 * Presentation reconciliation under concurrent epoch joins.
 *
 * A join re-resolves every charge in the epoch, so an in-flight Pal's future
 * (later hits, capacity labels, terminal, Holding slot) can change after it
 * launched. On every accepted launch this rebuilds ONLY the unplayed tail of
 * each still-flying pass from the new resolution; everything already presented
 * (shots whose anticipation began, dwells in progress, rail travelled) is kept
 * byte-identical. Cost: O(flights × tail events), once per accepted launch.
 */

export interface LiveFlight { pass: FlightPass; cursor: number }

/** A presented-history contradiction the engine introduced (see §5 report). */
export interface HistoryDivergence { chargeId: string; presentedMs: number; detail: string }

export interface ReconcileInput {
  /** Every flight on the rail, including the just-launched one (cursor 0). */
  flights: readonly LiveFlight[];
  /** passId of the just-launched pass (already base-scripted, not yet convoyed). */
  freshPassId: number;
  truth: GameState;
  /** The epoch's per-charge resolution after this launch. */
  resolutions: readonly ActiveCharge[];
  /** Pixel coordinates lookup (positions never change). */
  pixels: readonly Pixel[];
  now: number;
  slotPoints: readonly (Point | undefined)[];
  convoy: boolean;
}

export interface ReconcileResult { passes: FlightPass[]; divergences: HistoryDivergence[] }

/** Pass-clock time now, clamped at 0. */
export function passTime(pass: FlightPass, now: number): number {
  return Math.max(0, now - pass.launchedAtMs);
}

/**
 * Pure §3.1(b) comparison: everything visibly presented by `t` against the
 * charge's new resolution. Empty when observable history holds.
 */
export function presentedDivergences(pass: FlightPass, t: number, res: ActiveCharge): string[] {
  const out: string[] = [];
  const rail = t < pass.liftMs ? 0 : progressAt(pass, t);
  let shown = 0;
  for (const s of pass.shots) {
    if (s.anticipateAt > t) break;
    const e = res.encounters[shown];
    if (!e || e.pixelId !== s.pixelId || e.remaining !== s.remaining) {
      out.push(`shot#${shown} shown ${s.pixelId} (left ${s.remaining}) but truth now ${e ? `${e.pixelId} (left ${e.remaining})` : 'has no such hit'}`);
    }
    shown += 1;
  }
  for (let i = shown; i < res.encounters.length; i += 1) {
    const e = res.encounters[i]!;
    if (e.progress < rail - 1e-9) out.push(`truth hit#${i} ${e.pixelId}@${e.progress.toFixed(3)} is behind presented rail ${rail.toFixed(3)}`);
  }
  if (t >= pass.orbitEndAt && (pass.terminal.kind === 'consumed') !== (res.landed === 'consumed')) {
    out.push(`terminal shown ${pass.terminal.kind} but truth now ${res.landed}`);
  }
  return out;
}

function sameTerminal(a: FlightTerminal, b: FlightTerminal): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind !== 'toHolding' || b.kind !== 'toHolding') return true;
  return a.slot === b.slot && a.target?.x === b.target?.x && a.target?.y === b.target?.y;
}

function sameShots(pass: FlightPass, res: ActiveCharge): boolean {
  if (pass.shots.length !== res.encounters.length) return false;
  return pass.shots.every((s, i) => {
    const e = res.encounters[i]!;
    return e.pixelId === s.pixelId && e.remaining === s.remaining && e.progress === s.progress;
  });
}

/** First pass-clock instant not yet presented, and the rail progress there. */
function resumePoint(pass: FlightPass, t: number): RailResume {
  if (t < pass.liftMs) return { t: pass.liftMs, p: 0 };
  for (const s of pass.shots) {
    if (s.anticipateAt > t) break;
    if (t <= s.clearAt) return { t: s.clearAt, p: s.progress };
  }
  for (const h of pass.convoyHolds) {
    if (h.startAt > t) break;
    if (t <= h.endAt) return { t: h.endAt, p: h.progress };
  }
  return { t, p: progressAt(pass, t) };
}

/** Rebuild the unplayed tail of `pass` from `res`, keeping the presented prefix. */
function rescriptTail(pass: FlightPass, res: ActiveCharge, terminal: FlightTerminal, t: number,
  leader: FlightPass | undefined, pixels: readonly Pixel[]): FlightPass {
  const resume = resumePoint(pass, t);
  const prefix = pass.shots.filter((s) => s.anticipateAt <= t);
  const holds = pass.convoyHolds.filter((h) => h.startAt <= t);
  // Consistent case: the tail is exactly the resolution after the prefix. If a
  // join contradicted history, hits behind the rail can no longer be shown.
  const tail = res.encounters.slice(prefix.length)
    .filter((e) => e.progress >= resume.p - 1e-9)
    .map((e) => shotFromEncounter(e, pixels));
  const endProgress = terminal.kind === 'consumed'
    ? (tail.length ? tail[tail.length - 1]!.progress : prefix[prefix.length - 1]?.progress ?? resume.p)
    : 1;
  const base = { ...pass, terminal, endProgress };
  const sched = scheduleRail(base, tail, leader, resume);
  let orbitEndAt = sched.orbitEndAt;
  if (terminal.kind === 'consumed' && tail.length === 0) {
    orbitEndAt = Math.max(resume.t, prefix[prefix.length - 1]?.clearAt ?? resume.t);
  }
  return finalizePass({
    ...base,
    shots: [...prefix, ...sched.shots],
    convoyHolds: [...holds, ...sched.holds],
    orbitEndAt,
    landingAt: orbitEndAt + landingDelay(terminal),
    finalClearPixelId: undefined,
    result: undefined,
  });
}

/**
 * Reconcile every flight with the latest truth. Returns the updated passes in
 * passId order plus any observable-history divergences (§5).
 */
export function reconcileFlights(input: ReconcileInput): ReconcileResult {
  const { truth, now, pixels, slotPoints } = input;
  const byId = new Map<string, ActiveCharge>();
  for (const r of input.resolutions) byId.set(r.id, r);
  const ordered = [...input.flights].sort((a, b) => a.pass.passId - b.pass.passId);
  const divergences: HistoryDivergence[] = [];
  const out: FlightPass[] = [];
  const retimed = new Set<number>();
  const frozen = new Set<number>();

  for (const { pass, cursor } of ordered) {
    const t = passTime(pass, now);
    const fresh = pass.passId === input.freshPassId;
    const landed = pass.events.findIndex((e) => e.kind === 'holdingLanded');
    // Its terminal beat is already on screen: nothing about it may change.
    if (t >= pass.landingAt || (landed >= 0 && cursor > landed)) {
      frozen.add(pass.passId);
      out.push(pass);
      continue;
    }
    const res = byId.get(pass.charge.id);
    const remaining = res ? res.remainingCapacity
      : pass.terminal.kind === 'consumed' ? 0 : pass.charge.capacity;
    const slotOf = truth.holding.findIndex((c) => c.id === pass.charge.id);
    const target = slotOf >= 0 ? slotPoints[slotOf] : undefined;
    const terminal = res || pass.terminal.kind !== 'consumed'
      ? terminalFor(pass.charge.id, remaining, truth, target)
      : pass.terminal;
    if (res && !fresh) {
      for (const detail of presentedDivergences(pass, t, res)) {
        divergences.push({ chargeId: pass.charge.id, presentedMs: t, detail });
      }
    }
    // Already off the rail (travelling to its slot / bursting): only the slot
    // it flies to may follow truth order.
    if (t >= pass.orbitEndAt) {
      frozen.add(pass.passId);
      out.push(terminal.kind === 'toHolding' && pass.terminal.kind === 'toHolding' && !sameTerminal(terminal, pass.terminal)
        ? { ...pass, terminal } : pass);
      continue;
    }
    const leader = input.convoy ? pickLeader(out, pass) : undefined;
    const leaderMoved = leader !== undefined && retimed.has(leader.passId);
    let next = pass;
    if (fresh) {
      const withTerminal = sameTerminal(terminal, pass.terminal) ? pass : { ...pass, terminal };
      next = leader ? rescriptTail(withTerminal, res ?? toResolution(pass), terminal, t, leader, pixels) : withTerminal;
      retimed.add(pass.passId);
    } else if ((res && !sameShots(pass, res)) || terminal.kind !== pass.terminal.kind || leaderMoved) {
      next = rescriptTail(pass, res ?? toResolution(pass), terminal, t, leader, pixels);
      retimed.add(pass.passId);
    } else if (!sameTerminal(terminal, pass.terminal)) {
      next = { ...pass, terminal };
    }
    out.push(next);
  }

  gateLandingOrder(out, frozen, now);
  return { passes: out.map((p) => withCueAndResult(p, frozen, truth)), divergences };
}

/** The pass's own shots as a resolution (used when the epoch no longer lists it). */
function toResolution(pass: FlightPass): ActiveCharge {
  const last = pass.shots[pass.shots.length - 1];
  return {
    id: pass.charge.id, source: pass.origin, originId: '', color: pass.charge.color, capacity: pass.charge.capacity,
    remainingCapacity: last ? last.remaining : pass.charge.capacity, insertionTime: 0, launchSequence: 0, passCount: 1,
    phase: 'finished', finishTime: 1, landed: pass.terminal.kind === 'consumed' ? 'consumed' : 'holding',
    encounters: pass.shots.map((s) => ({ pixelId: s.pixelId, time: s.progress, progress: s.progress, remaining: s.remaining })),
  };
}

/**
 * Presented Holding is compact and ordered like truth, so Pals must land in
 * slot order. A Pal that would reach its slot before a lower slot's Pal waits
 * at GateTerminal (it has not left the rail yet, so nothing presented moves).
 */
function gateLandingOrder(passes: FlightPass[], frozen: ReadonlySet<number>, now: number): void {
  const toHolding = passes
    .map((pass, index) => ({ pass, index }))
    .filter(({ pass }) => pass.terminal.kind === 'toHolding')
    .sort((a, b) => (a.pass.terminal as { slot: number }).slot - (b.pass.terminal as { slot: number }).slot);
  let prevLandAbs = Number.NEGATIVE_INFINITY;
  for (const { pass, index } of toHolding) {
    const landAbs = pass.launchedAtMs + pass.landingAt;
    const need = prevLandAbs + LANDING_GAP_MS - landAbs;
    if (need > 0 && !frozen.has(pass.passId) && passTime(pass, now) < pass.orbitEndAt) {
      passes[index] = finalizePass({ ...pass, orbitEndAt: pass.orbitEndAt + need, landingAt: pass.landingAt + need });
    }
    prevLandAbs = Math.max(prevLandAbs, passes[index]!.launchedAtMs + passes[index]!.landingAt);
  }
}

/** Minimum spacing between two consecutive Holding arrivals (one frame and a bit). */
const LANDING_GAP_MS = 24;

/** Recompute the pressure cue from the truth slot; strip any stale result. */
function withCueAndResult(pass: FlightPass, frozen: ReadonlySet<number>, truth: GameState): FlightPass {
  if (frozen.has(pass.passId)) return pass;
  const cue = holdingCueFor(pass.terminal, pass.origin, truth.holdingCapacity, truth.status === 'lost');
  if (cue === pass.holdingCue && pass.result === undefined) return pass;
  return finalizePass({ ...pass, holdingCue: cue, result: undefined });
}

/**
 * Put the level result on the Pal whose beat is visibly last, so the modal
 * never outruns the board: a loss on the latest-bursting reject (else the
 * latest-finishing Pal), a win on the Pal with the latest clear (marked as the
 * picture-completing clear).
 */
export function assignResult(passes: FlightPass[], status: GameState['status'], now: number): FlightPass[] {
  if (status === 'playing' || passes.length === 0) return passes;
  const live = passes.filter((p) => passTime(p, now) < p.landingAt);
  const pool = live.length ? live : passes;
  const abs = (p: FlightPass, at: number) => p.launchedAtMs + at;
  let carrier: FlightPass;
  if (status === 'lost') {
    const rejects = pool.filter((p) => p.terminal.kind === 'reject');
    const from = rejects.length ? rejects : pool;
    carrier = from.reduce((a, b) => (abs(b, b.landingAt) >= abs(a, a.landingAt) ? b : a));
  } else {
    carrier = pool.reduce((a, b) => {
      const la = a.shots.length ? abs(a, a.shots[a.shots.length - 1]!.clearAt) : Number.NEGATIVE_INFINITY;
      const lb = b.shots.length ? abs(b, b.shots[b.shots.length - 1]!.clearAt) : Number.NEGATIVE_INFINITY;
      return lb >= la ? b : a;
    });
  }
  return passes.map((p) => {
    if (p !== carrier) return p;
    const last = p.shots[p.shots.length - 1];
    const finalClear = status === 'won' && last && !isNonClearingShot(last) && last.clearAt > passTime(p, now)
      ? last.pixelId : undefined;
    return finalizePass({ ...p, result: status === 'won' ? 'win' : 'fail', finalClearPixelId: finalClear });
  });
}
