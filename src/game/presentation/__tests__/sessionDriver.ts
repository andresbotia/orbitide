/**
 * Deterministic session driver + permanent presentation invariants.
 *
 * Drives the real `useGameSession` with a controlled wall clock (jest modern
 * fake timers mock `Date.now`). Every live flight is presented exactly as the
 * UI-thread clock would: `presentThrough(passId, eventCountAt(pass, now - launchedAt))`.
 *
 * Not a test file (no `.test.ts`); the importing test must declare the same
 * `jest.mock`s as `session.test.ts` (react-native, feedback, hapticArbiter).
 */
import { act, createElement, useEffect, type ReactElement } from 'react';
import { useGameSession, type GameSession } from '@/hooks/useGameSession';
import type { ActiveCharge, Charge, GameState, LevelDefinition } from '@/game/engine/types';
import type { FlightPass, Point } from '../events';
import { eventCountAt, progressAt } from '../motion';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as { create: (element: ReactElement) => { unmount: () => void } };

/** Explicit, on-screen Holding slot points so no flight ever needs a fallback target. */
export const SLOT_POINTS: Point[] = [{ x: 101, y: 901 }, { x: 165, y: 901 }, { x: 229, y: 901 }, { x: 293, y: 901 }];

export type TerminalView =
  | { kind: 'consumed' }
  | { kind: 'toHolding'; slot: number | undefined; target: Point | undefined }
  | { kind: 'reject' };

type AnyPass = FlightPass & {
  terminal?: { kind: 'consumed' | 'toHolding' | 'reject'; slot?: number; target?: Point };
  endKind?: 'burst' | 'toHolding'; holdingSlotIndex?: number; holdingTarget?: Point;
};

/**
 * The flight's single terminal outcome. Reads `pass.terminal`; on the pre-fix
 * shape it derives the same thing from `endKind` so regressions fail on
 * behaviour, not on a missing field.
 */
export function terminalOf(pass: FlightPass): TerminalView {
  const p = pass as AnyPass;
  if (p.terminal) {
    return p.terminal.kind === 'toHolding'
      ? { kind: 'toHolding', slot: p.terminal.slot, target: p.terminal.target }
      : { kind: p.terminal.kind };
  }
  if (p.endKind === 'toHolding') return { kind: 'toHolding', slot: p.holdingSlotIndex, target: p.holdingTarget };
  return p.endProgress < 1 && p.shots.length > 0 ? { kind: 'consumed' } : { kind: 'reject' };
}

let current: GameSession | null = null;
function Probe({ id, level }: { id: number; level?: LevelDefinition }) {
  const s = useGameSession(id, { level });
  useEffect(() => { current = s; });
  return null;
}

export function mountSession(level: LevelDefinition): { get: () => GameSession; unmount: () => void } {
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(createElement(Probe, { id: level.id, level })); });
  return { get: () => current!, unmount: () => act(() => root.unmount()) };
}

/** One tap: a tunnel front, or a held Pal by charge id. */
export interface DriveLaunch { at: number; tunnel?: string; held?: string }

export interface Divergence { chargeId: string; atMs: number; presentedMs: number; detail: string }

export interface DriveLog {
  /** chargeId -> every terminal observed when its flight was removed (must be exactly one). */
  terminals: Map<string, TerminalView[]>;
  launched: string[];
  /** Observable-history audit at each accepted join (§5). */
  divergences: Divergence[];
  /** Invariant violations seen while flights were in the air. */
  violations: string[];
  /** view vs truth just before the last flight's `complete` (i.e. before settleAll). */
  preSettle?: { view: GameState; truth: GameState };
  /** Presented Holding at every change, with truth alongside. */
  holdingTimeline: { atMs: number; view: string[]; truth: string[] }[];
  /** First presented 'lost'/'won' time, and whether the carrying Pal had visibly reached its terminal. */
  statusAtMs?: number;
  /** chargeId -> presented Holding right before/after its reject burst. */
  rejectHolding: Map<string, { before: string[]; after: string[] }>;
  /** Final terminal pass per chargeId (last snapshot before removal). */
  lastPass: Map<string, FlightPass>;
  /** DEV boundary asserts / history warnings the session raised (`[PA_…]`). */
  devMessages: string[];
}

const label = (c: Charge) => `${c.id}:${c.capacity}`;
const clearedIds = (s: GameState) => new Set(s.pixels.filter((p) => p.cleared).map((p) => p.id));

/**
 * Pure observable-history comparison (§3.1(b)): for one flight at presentation
 * time `t`, compare everything already shown against the charge's new
 * resolution. Returns human-readable divergences (empty when history holds).
 */
export function auditPresentedHistory(pass: FlightPass, t: number, resolution: ActiveCharge | undefined): string[] {
  if (!resolution) return [];
  const out: string[] = [];
  const rail = t < pass.liftMs ? 0 : progressAt(pass, t);
  const shown = pass.shots.filter((s) => s.anticipateAt <= t);
  shown.forEach((s, i) => {
    const e = resolution.encounters[i];
    if (!e || e.pixelId !== s.pixelId || e.remaining !== s.remaining) {
      out.push(`shot#${i} shown ${s.pixelId} (left ${s.remaining}) but truth now ${e ? `${e.pixelId} (left ${e.remaining})` : 'has no such hit'}`);
    }
  });
  resolution.encounters.forEach((e, i) => {
    if (i >= shown.length && e.progress < rail - 1e-9) {
      out.push(`truth hit#${i} ${e.pixelId}@${e.progress.toFixed(3)} is behind presented rail ${rail.toFixed(3)} and was never shown`);
    }
  });
  if (t >= pass.orbitEndAt) {
    const kind = terminalOf(pass).kind;
    const truthKind = resolution.landed === 'consumed' ? 'consumed' : 'holding';
    if ((kind === 'consumed') !== (truthKind === 'consumed')) out.push(`terminal shown ${kind} but truth now ${resolution.landed}`);
  }
  return out;
}

/**
 * Run a launch schedule on the real session with a controlled clock until every
 * flight has completed. Records terminals, invariant violations, the
 * observable-history audit and the pre-settle snapshot.
 */
export function drive(get: () => GameSession, launches: DriveLaunch[], opts: { stepMs?: number; maxMs?: number } = {}): DriveLog {
  const stepMs = opts.stepMs ?? 16;
  const maxMs = opts.maxMs ?? 120_000;
  const log: DriveLog = {
    terminals: new Map(), launched: [], divergences: [], violations: [], holdingTimeline: [],
    rejectHolding: new Map(), lastPass: new Map(), devMessages: [],
  };
  const g = globalThis as { __DEV__?: boolean };
  const prevDev = g.__DEV__;
  g.__DEV__ = true;
  const capture = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('[PA_')) log.devMessages.push(args.map(String).join(' '));
  };
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(capture);
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(capture);
  try {
    runDrive();
  } finally {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    g.__DEV__ = prevDev;
  }
  return log;

  function runDrive() {
  const launchedAt = new Map<number, number>();
  const pending = [...launches].sort((a, b) => a.at - b.at);
  const seenCleared = new Set<string>();
  const seenViolation = new Set<string>();
  const violate = (now: number, msg: string) => {
    if (seenViolation.has(msg)) return;
    seenViolation.add(msg);
    log.violations.push(`@${now} ${msg}`);
  };
  let lastHolding = '';
  let started = false;

  const record = (now: number) => {
    const s = get();
    const v = s.state.holding.map(label);
    const key = v.join(',');
    if (key !== lastHolding) {
      lastHolding = key;
      log.holdingTimeline.push({ atMs: now, view: v, truth: s.engineState.holding.map(label) });
    }
  };

  const checkInvariants = (now: number) => {
    const s = get();
    const view = s.state;
    const truth = s.engineState;
    // Presented Holding: a prefix of truth (ids AND capacities, same order).
    view.holding.forEach((c, i) => {
      const t = truth.holding[i];
      if (!t || t.id !== c.id || t.capacity !== c.capacity) {
        violate(now, `presented Holding[${i}]=${label(c)} but truth[${i}]=${t ? label(t) : 'empty'} (truth ${truth.holding.map(label).join(',')})`);
      }
    });
    // Pixels: presented clears never contradict truth and never reappear.
    const vc = clearedIds(view);
    const tc = clearedIds(truth);
    for (const id of vc) if (!tc.has(id)) violate(now, `pixel ${id} shown cleared but standing in truth`);
    for (const id of seenCleared) if (!vc.has(id)) violate(now, `pixel ${id} reappeared`);
    for (const id of vc) seenCleared.add(id);
    // Flights: one terminal each; toHolding has a unique valid slot + real target.
    const slots = new Map<number, string>();
    for (const pass of s.flights) {
      const term = terminalOf(pass);
      if (term.kind !== 'toHolding') continue;
      const slot = term.slot;
      if (typeof slot !== 'number' || slot < 0 || slot >= truth.holdingCapacity) {
        violate(now, `${pass.charge.id} toHolding without a valid slot (${String(slot)})`);
        continue;
      }
      const owner = slots.get(slot);
      if (owner) violate(now, `slot ${slot} shared by ${owner} and ${pass.charge.id}`);
      slots.set(slot, pass.charge.id);
      const target = term.target;
      if (!target || target.x !== SLOT_POINTS[slot]!.x || target.y !== SLOT_POINTS[slot]!.y) {
        violate(now, `${pass.charge.id} slot ${slot} flies to ${JSON.stringify(target)} not the slot point`);
      }
    }
    if (view.status !== 'playing' && log.statusAtMs === undefined) log.statusAtMs = now;
  };

  for (let now = 0; now <= maxMs; now += stepMs) {
    jest.setSystemTime(now);
    while (pending.length && pending[0]!.at <= now) {
      const next = pending.shift()!;
      const s = get();
      const before = s.flights.map((p) => ({ pass: p, t: now - launchedAt.get(p.passId)! }));
      let ok = false;
      act(() => {
        ok = next.held ? s.launchHeld(next.held, undefined, SLOT_POINTS) : s.launch(next.tunnel!, undefined, SLOT_POINTS);
      });
      if (!ok) { violate(now, `launch ${next.held ?? next.tunnel} rejected`); continue; }
      started = true;
      const after = get();
      const fresh = after.flights.reduce((m, p) => (p.passId > m.passId ? p : m));
      launchedAt.set(fresh.passId, now);
      log.launched.push(fresh.charge.id);
      for (const { pass, t } of before) {
        const res = after.engineState.activeCharges.find((c) => c.id === pass.charge.id);
        for (const detail of auditPresentedHistory(pass, t, res)) {
          log.divergences.push({ chargeId: pass.charge.id, atMs: now, presentedMs: t, detail });
        }
      }
    }
    if (!started) continue;
    const s = get();
    for (const pass of [...s.flights]) {
      const t = now - launchedAt.get(pass.passId)!;
      const count = eventCountAt(pass, t);
      const live = get();
      const passNow = live.flights.find((f) => f.passId === pass.passId);
      if (!passNow) continue;
      log.lastPass.set(passNow.charge.id, passNow);
      const isReject = terminalOf(passNow).kind === 'reject';
      const burstIdx = passNow.events.findIndex((e) => e.at >= passNow.orbitEndAt);
      const holdingBefore = live.state.holding.map(label);
      const completes = count >= passNow.events.length && passNow.events.length > 0;
      if (completes && live.flights.length === 1) {
        act(() => { live.presentThrough(passNow.passId, passNow.events.length - 1); });
        const g = get();
        log.preSettle = { view: g.state, truth: g.engineState };
      }
      act(() => { live.presentThrough(passNow.passId, count); });
      if (isReject && burstIdx >= 0 && count > burstIdx && !log.rejectHolding.has(passNow.charge.id)) {
        log.rejectHolding.set(passNow.charge.id, { before: holdingBefore, after: get().state.holding.map(label) });
      }
      if (!get().flights.some((f) => f.passId === passNow.passId)) {
        const list = log.terminals.get(passNow.charge.id) ?? [];
        list.push(terminalOf(passNow));
        log.terminals.set(passNow.charge.id, list);
      }
    }
    record(now);
    if (get().flights.length > 0) checkInvariants(now);
    // A result carrier completes on its result beat, so the presented loss/win
    // can arrive in the same step that retires the last flight.
    if (get().state.status !== 'playing' && log.statusAtMs === undefined) log.statusAtMs = now;
    if (pending.length === 0 && get().flights.length === 0) break;
  }
  }
}

/** §3.3 — presented Holding / pixels / status equal engine truth. */
export function expectConverged(view: GameState, truth: GameState): void {
  expect(view.holding.map((c) => ({ id: c.id, color: c.color, capacity: c.capacity })))
    .toEqual(truth.holding.map((c) => ({ id: c.id, color: c.color, capacity: c.capacity })));
  expect(view.pixels.map((p) => ({ id: p.id, cleared: p.cleared, modifier: p.modifier ?? null })))
    .toEqual(truth.pixels.map((p) => ({ id: p.id, cleared: p.cleared, modifier: p.modifier ?? null })));
  expect(view.status).toBe(truth.status);
}

/** §3.4 — lifecycle: each flight carries exactly one valid terminal, nothing is represented twice. */
export function expectLifecycleValid(session: GameSession): void {
  const view = session.state;
  const truth = session.engineState;
  const flightIds = session.flights.map((f) => f.charge.id);
  expect(new Set(flightIds).size).toBe(flightIds.length);
  const holdingIds = view.holding.map((c) => c.id);
  expect(new Set(holdingIds).size).toBe(holdingIds.length);
  view.holding.forEach((c, i) => {
    expect(truth.holding[i]).toMatchObject({ id: c.id, capacity: c.capacity });
  });
  const slots = new Set<number>();
  for (const pass of session.flights) {
    const term = terminalOf(pass);
    expect(['consumed', 'toHolding', 'reject']).toContain(term.kind);
    if (term.kind === 'toHolding') {
      expect(typeof term.slot).toBe('number');
      expect(term.slot!).toBeGreaterThanOrEqual(0);
      expect(term.slot!).toBeLessThan(truth.holdingCapacity);
      expect(slots.has(term.slot!)).toBe(false);
      slots.add(term.slot!);
      expect(truth.holding[term.slot!]?.id).toBe(pass.charge.id);
    }
    if (term.kind === 'reject') expect(truth.holding.some((c) => c.id === pass.charge.id)).toBe(false);
  }
}
