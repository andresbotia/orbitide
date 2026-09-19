/**
 * A Pal already flying Gate → Holding whose slot moves (e.g. a held Pal was
 * relaunched) keeps its visible path: reconcile records a retarget instead of
 * swapping the target out from under it. Slot ownership still follows truth.
 */
import { createGame } from '@/game/engine/createGame';
import { resolveLaunch } from '@/game/engine/resolveLaunch';
import type { GameState, LevelDefinition } from '@/game/engine/types';
import { buildLaunchScript } from '../buildScript';
import type { FlightPass } from '../events';
import { reconcileFlights } from '../reconcile';

const level: LevelDefinition = {
  id: 9761, title: 'retarget', themeId: 'test', difficulty: 'easy', holdingCapacity: 3, ruleset: 'coreV2',
  pixelArt: ['WWW', 'WBW', 'WWW'],
  tunnels: [[{ color: 'blue', capacity: 1 }], [], [], []],
};
const SLOTS = [{ x: 100, y: 500 }, { x: 170, y: 500 }, { x: 240, y: 500 }];

function flyingToSlot1(): { pass: FlightPass; truth: GameState } {
  const state = createGame(level);
  const out = resolveLaunch(state, 'tunnel-0');
  const base = buildLaunchScript(out, state).pass;
  const pass: FlightPass = { ...base, launchedAtMs: 1000, terminal: { kind: 'toHolding', slot: 1, target: SLOTS[1] } };
  // Truth now keeps this Pal in slot 0 (the Pal ahead of it was relaunched).
  return { pass, truth: out.state };
}

function reconcileAt(pass: FlightPass, truth: GameState, t: number): FlightPass {
  return reconcileFlights({
    flights: [{ pass, cursor: 0 }], freshPassId: -1, truth, resolutions: [], pixels: truth.pixels,
    now: pass.launchedAtMs + t, slotPoints: SLOTS, convoy: true,
  }).passes[0]!;
}

test('mid-landing: new slot + target, and the abandoned target is kept as a retarget at that instant', () => {
  const { pass, truth } = flyingToSlot1();
  const t = pass.orbitEndAt + 120;
  const next = reconcileAt(pass, truth, t);
  expect(next.terminal).toEqual({ kind: 'toHolding', slot: 0, target: SLOTS[0], retargets: [{ at: t, target: SLOTS[1] }] });
  // Logical timing untouched.
  expect(next.landingAt).toBe(pass.landingAt);
  expect(next.events).toEqual(pass.events);
});

test('still on the rail: the slot simply changes — no retarget needed', () => {
  const { pass, truth } = flyingToSlot1();
  const next = reconcileAt(pass, truth, pass.orbitEndAt - 500);
  expect(next.terminal.kind === 'toHolding' && next.terminal.retargets).toBeFalsy();
  expect(next.terminal).toMatchObject({ kind: 'toHolding', slot: 0, target: SLOTS[0] });
});
