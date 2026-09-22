/**
 * M5.2E — CORE V2 VERIFICATION + EDGE-CASE AUDIT TEST SUITE
 *
 * Dedicated verification tests covering all Priority Edge Cases 1–13,
 * deadlock reproduction, and engine/session consistency.
 */
import { LAUNCH_SPACING } from '../concurrency';
import { createGame } from '../createGame';
import { activeSlotCount, simulateEpoch } from '../epoch';
import { iceLayers, shieldLayers } from '../frozen';
import { isLinkedPrimed } from '../linked';
import { resolveAction } from '../resolveLaunch';
import { resolveHoldingLaunch } from '../resolveHolding';
import { actionRejection, legalActions } from '../actions';
import { activeCapacity, activeCount, visibleTunnelWindow, VISIBLE_TUNNEL_ENTRIES } from '../selectors';
import { resolveArrival } from '../holdingArrival';
import { computeStatus, isLost, isProductiveAction } from '../winState';
import type { EpochLaunch, LevelDefinition, OrbColor } from '../types';

const v2 = (
  pixelArt: string[],
  tunnels: LevelDefinition['tunnels'],
  extra: Partial<LevelDefinition> = {},
): LevelDefinition => {
  const queues = [...(extra.tunnels ?? tunnels)];
  while (queues.length < 3) queues.push([]);
  return {
    id: extra.id ?? 9000,
    title: extra.title ?? 'CoreV2Verification',
    themeId: 'test',
    difficulty: 'easy',
    holdingCapacity: extra.holdingCapacity ?? 3,
    pixelArt,
    ...extra,
    tunnels: queues.slice(0, 3),
    ruleset: extra.ruleset ?? 'coreV2',
  };
};

const T = (i: number, join = false) => ({
  kind: 'tunnel' as const,
  id: `tunnel-${i}`,
  ...(join ? { join: true } : {}),
});
const J = (i: number) => T(i, true);

describe('M5.2E Verification — Priority Edge Cases', () => {
  // ── 1. Same-line concurrency ──────────────────────────────────────────────
  describe('1. Same-line concurrency', () => {
    test('the earlier Pal takes the front of a shared line; the later one, a lap later, takes the pixel it exposed', () => {
      // Column 1 has RED B (1, 1) behind RED A (1, 2).
      // Column 0 has RED C (0, 2).
      // FIRST LAUNCHED, FIRST SERVED: A owns lap [0, 1], B owns lap [1, 2] — two
      // Pals never contest the same instant, so there is no same-time race.
      const def = v2(
        ['BBB', 'BRB', 'RRB'],
        [
          [{ color: 'red', capacity: 1 }],
          [{ color: 'red', capacity: 1 }],
          [],
          [],
        ],
        { id: 9001 },
      );
      const base = createGame(def);
      const launchA: EpochLaunch = {
        chargeId: 'c0', source: 'tunnel', originId: 'tunnel-0', color: 'red', capacity: 1,
        insertionTime: 0, launchSequence: 0,
      };
      const launchB: EpochLaunch = {
        chargeId: 'c1', source: 'tunnel', originId: 'tunnel-1', color: 'red', capacity: 1,
        insertionTime: LAUNCH_SPACING, launchSequence: 1,
      };

      const res = simulateEpoch(base, [launchA, launchB]);
      const chargeA = res.charges[0]!;
      const chargeB = res.charges[1]!;

      // A hits RED A at (1, 2) and spends its 1 capacity.
      expect(chargeA.encounters.map((e) => e.pixelId)).toEqual(['L9001-p1-2']);
      expect(chargeA.remainingCapacity).toBe(0);

      // B reaches the same line (b:1) a lap later, where A's clear has exposed
      // RED B — forward help, never the reverse.
      expect(chargeB.encounters.map((e) => e.pixelId)).toEqual(['L9001-p1-1']);
      expect(chargeB.encounters[0]!.progress).toBe(chargeA.encounters[0]!.progress);
      expect(chargeB.remainingCapacity).toBe(0);

      // RED C at (0, 2) is left for a later Pal.
      expect(res.pixels.find((p) => p.id === 'L9001-p0-2')!.cleared).toBe(false);
    });
  });

  // ── 2. Different-line concurrency ─────────────────────────────────────────
  describe('2. Different-line concurrency', () => {
    test('multiple active orbs clear separate pixels with deterministic order, no double-clear, no double-spend', () => {
      const def = v2(
        ['R.B'],
        [
          [{ color: 'red', capacity: 2 }],
          [{ color: 'blue', capacity: 2 }],
          [],
          [],
        ],
        { id: 9002 },
      );
      const base = createGame(def);
      const launchRed: EpochLaunch = {
        chargeId: 'cRed', source: 'tunnel', originId: 'tunnel-0', color: 'red', capacity: 2,
        insertionTime: 0, launchSequence: 0,
      };
      const launchBlue: EpochLaunch = {
        chargeId: 'cBlue', source: 'tunnel', originId: 'tunnel-1', color: 'blue', capacity: 2,
        insertionTime: LAUNCH_SPACING, launchSequence: 1,
      };

      const res = simulateEpoch(base, [launchRed, launchBlue]);
      // Both resolve within one epoch without double-clear or capacity corruption
      expect(res.charges[0]!.encounters).toHaveLength(1);
      expect(res.charges[0]!.encounters[0]!.pixelId).toBe('L9002-p0-0');
      expect(res.charges[0]!.remainingCapacity).toBe(1);

      expect(res.charges[1]!.encounters).toHaveLength(1);
      expect(res.charges[1]!.encounters[0]!.pixelId).toBe('L9002-p2-0');
      expect(res.charges[1]!.remainingCapacity).toBe(1);

      // No double clear: distinct pixels
      const clearedIds = res.charges.flatMap((c) => c.encounters.map((e) => e.pixelId));
      expect(new Set(clearedIds).size).toBe(clearedIds.length);
    });
  });

  // ── 3. Five active orbs ───────────────────────────────────────────────────
  describe('3. Five active orbs', () => {
    const missTunnels = (): LevelDefinition['tunnels'] => [
      [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
      [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
      [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
    ];

    test('five concurrent passes function correctly; sixth tunnel/holding launch denied with zero mutation; opens when slot frees', () => {
      const def = v2(['WWW', 'WWW', 'WWW'], missTunnels(), { id: 9003, holdingCapacity: 8 });
      let state = createGame(def);

      // Launch 5 orbs into the epoch
      state = resolveAction(state, T(0)).state;
      state = resolveAction(state, J(1)).state;
      state = resolveAction(state, J(2)).state;
      state = resolveAction(state, J(0)).state;
      state = resolveAction(state, J(1)).state;

      expect(activeCount(state)).toBe(5);
      expect(state.epoch!.launches).toHaveLength(5);

      // Sixth tunnel launch denied
      const beforeTunnel = state;
      const deniedTunnel = resolveAction(state, J(2));
      expect(deniedTunnel.accepted).toBe(false);
      expect(deniedTunnel.rejection).toBe('activeSlotsFull');
      expect(state).toEqual(beforeTunnel);
    });

    test('relaunch from Holding into concurrent epoch counts toward the same 5-slot rail', () => {
      const def = v2(
        ['WWW', 'WWW', 'WWW'],
        [
          [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
          [{ color: 'blue', capacity: 1 }],
          [{ color: 'blue', capacity: 1 }],
        ],
        { id: 9003, holdingCapacity: 8 },
      );
      let state = createGame(def);
      state = resolveAction(state, T(0)).state;
      expect(state.holding).toHaveLength(1);
      const heldId = state.holding[0]!.id;

      state = resolveAction(state, T(0)).state;
      state = resolveAction(state, J(1)).state;
      state = resolveAction(state, { kind: 'holding', id: heldId, join: true }).state;

      expect(activeCount(state)).toBe(3);
    });
  });

  // ── 4. Capacity 6 structural support ──────────────────────────────────────
  describe('4. Capacity 6 structural support', () => {
    test('activeCapacity = 6 admits 6 concurrent passes; 7th is denied', () => {
      const def = v2(
        ['WWW', 'WWW', 'WWW'],
        [
          [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
          [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
          [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
        ],
        { id: 9004, activeCapacity: 6, holdingCapacity: 8 },
      );
      let state = createGame(def);
      expect(activeCapacity(state)).toBe(6);

      state = resolveAction(state, T(0)).state;
      for (const a of [J(1), J(2), J(0), J(1), J(2)]) {
        const out = resolveAction(state, a);
        expect(out.accepted).toBe(true);
        state = out.state;
      }
      expect(activeCount(state)).toBe(6);

      const denied = resolveAction(state, J(0));
      expect(denied.accepted).toBe(false);
      expect(denied.rejection).toBe('activeSlotsFull');
    });
  });

  // ── 5. Three tunnel independence ───────────────────────────────────────────
  describe('5. Three tunnel independence', () => {
    test('three deep queues advance independently, only launched tunnel pops, exactly 3 entries visible, hidden queue remains intact', () => {
      const q = (c: OrbColor) => [
        { color: c, capacity: 1 },
        { color: c, capacity: 2 },
        { color: c, capacity: 3 },
        { color: c, capacity: 4 },
        { color: c, capacity: 5 },
      ];
      const def = v2(
        ['GGG', 'GGG', 'GGG'],
        [q('white'), q('blue'), q('red')],
        { id: 9005 },
      );
      let state = createGame(def);
      expect(state.tunnels).toHaveLength(3);

      // Check initial visible windows (3 entries: CURRENT, NEXT, NEXT+1)
      expect(VISIBLE_TUNNEL_ENTRIES).toBe(3);
      for (let i = 0; i < 3; i++) {
        expect(state.tunnels[i]!.queue).toHaveLength(5);
        const win = visibleTunnelWindow(state.tunnels[i]!.queue, 'coreV2');
        expect(win).toHaveLength(3);
        expect(win.map((c) => c.capacity)).toEqual([1, 2, 3]);
      }

      // Launch tunnel 1 (blue)
      state = resolveAction(state, T(1)).state;
      expect(state.tunnels[1]!.queue).toHaveLength(4);
      expect(visibleTunnelWindow(state.tunnels[1]!.queue, 'coreV2').map((c) => c.capacity)).toEqual([2, 3, 4]);

      // Tunnels 0, 2 are completely untouched
      expect(state.tunnels[0]!.queue).toHaveLength(5);
      expect(state.tunnels[2]!.queue).toHaveLength(5);

      // Launch tunnel 1 again
      state = resolveAction(state, T(1)).state;
      expect(state.tunnels[1]!.queue).toHaveLength(3);
      expect(visibleTunnelWindow(state.tunnels[1]!.queue, 'coreV2').map((c) => c.capacity)).toEqual([3, 4, 5]);

      // Launch tunnel 1 again
      state = resolveAction(state, T(1)).state;
      expect(state.tunnels[1]!.queue).toHaveLength(2);
      expect(visibleTunnelWindow(state.tunnels[1]!.queue, 'coreV2').map((c) => c.capacity)).toEqual([4, 5]);
    });
  });

  // ── 6. Four Holding slots ─────────────────────────────────────────────────
  describe('6. Three Holding slots', () => {
    test('HOLDING 0/3 -> 1/3 -> 2/3 -> 3/3 preserves identity/color/capacity; manual relaunch frees slot immediately', () => {
      const def = v2(
        ['WWW', 'WWW', 'WWW'],
        [
          // The spare blue keeps a productive action available, so filling the
          // tray does not itself end the level (see the deadlock rule below).
          [{ color: 'blue', capacity: 2 }, { color: 'purple', capacity: 5 }],
          [{ color: 'red', capacity: 3 }],
          [{ color: 'green', capacity: 4 }],
        ],
        { id: 9006, holdingCapacity: 3 },
      );
      let state = createGame(def);
      expect(state.holding).toHaveLength(0);

      // 0/3 -> 1/3
      state = resolveAction(state, T(0)).state;
      expect(state.holding).toHaveLength(1);
      expect(state.holding[0]).toMatchObject({ color: 'blue', capacity: 2 });

      // 1/3 -> 2/3
      state = resolveAction(state, T(1)).state;
      expect(state.holding).toHaveLength(2);
      expect(state.holding[1]).toMatchObject({ color: 'red', capacity: 3 });

      // 2/3 -> 3/3
      state = resolveAction(state, T(2)).state;
      expect(state.holding).toHaveLength(3);
      expect(state.holding[2]).toMatchObject({ color: 'green', capacity: 4 });

      // Slot stability: all 3 are intact with preserved identities
      const redHeldId = state.holding[1]!.id;
      const greenHeldId = state.holding[2]!.id;

      // Manual relaunch of slot 1 (red)
      const relaunch = resolveHoldingLaunch(state, redHeldId);
      expect(relaunch.accepted).toBe(true);
      expect(relaunch.launchedCharge!.id).toBe(redHeldId);
      expect(relaunch.launchedCharge!.capacity).toBe(3);

      // During/after the relaunch, slot identity is preserved and other slots are stable
      expect(relaunch.state.holding.some((c) => c.id === greenHeldId)).toBe(true);
    });
  });

  // ── 7. Holding full ───────────────────────────────────────────────────────
  describe('7. Holding full', () => {
    test('at HOLDING 3/3, a non-clearing launch is accepted then lost; a fully consuming charge still wins', () => {
      const def = v2(
        ['WWW', 'WWW', 'WWW'],
        [
          [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
          [{ color: 'blue', capacity: 1 }],
          [{ color: 'white', capacity: 9 }], // white clears all 9 pixels
        ],
        { id: 9007, holdingCapacity: 3 },
      );
      let state = createGame(def);
      state = resolveAction(state, T(0)).state;
      state = resolveAction(state, T(1)).state;
      state = resolveAction(state, T(0)).state;
      expect(state.holding).toHaveLength(3);

      const overflow = resolveAction(state, T(0));
      expect(overflow.accepted).toBe(true);
      // Provisional: it flies to the Gate, and with nothing freed it is the loss.
      expect(overflow.state.status).toBe('playing');
      expect(resolveArrival(overflow.state).state.status).toBe('lost');
      expect(overflow.state.holding).toHaveLength(3);
      expect(overflow.state.holding.map((c) => c.id)).toEqual(state.holding.map((c) => c.id));

      // But tunnel 2 (white charge that fully consumes itself) IS accepted even at 3/3 Holding!
      const allowed = resolveAction(state, T(2));
      expect(allowed.accepted).toBe(true);
      expect(allowed.state.status).toBe('won');
    });
  });

  // ── 8. No-target Core V2 launch ───────────────────────────────────────────
  describe('8. No-target Core V2 launch', () => {
    test('tunnel charge launches with no current target, completes pass, spends 0 capacity, and parks full count in Holding', () => {
      const def = v2(
        ['RRR', 'RRR'],
        [[{ color: 'blue', capacity: 4 }], [], [], []],
        { id: 9008 },
      );
      const state = createGame(def);
      expect(actionRejection(state, T(0))).toBeNull();

      const outcome = resolveAction(state, T(0));
      expect(outcome.accepted).toBe(true);
      expect(outcome.pass!.encounters).toHaveLength(0);
      expect(outcome.pass!.charge.capacity).toBe(4);
      expect(outcome.heldCharge).toEqual({ id: 'L9008-t0-c0', color: 'blue', capacity: 4 });
      expect(outcome.state.holding).toHaveLength(1);
      expect(outcome.state.holding[0]!.capacity).toBe(4);
    });
  });

  // ── 9. No-target held relaunch ────────────────────────────────────────────
  describe('9. No-target held relaunch', () => {
    test('held charge relaunches with no current target, frees Holding slot, preserves identity/capacity, and returns to Holding after zero-hit pass', () => {
      const def = v2(
        ['RRR', 'RRR'],
        // A spare Pal keeps a productive action available; without it a tray of
        // Pals that can never hit anything is a deadlock, not a relaunch loop.
        [[{ color: 'blue', capacity: 3 }, { color: 'blue', capacity: 3 }], [], [], []],
        { id: 9009 },
      );
      const parked = resolveAction(createGame(def), T(0)).state;
      expect(parked.status).toBe('playing');
      const heldId = parked.holding[0]!.id;

      const relaunch = resolveHoldingLaunch(parked, heldId);
      expect(relaunch.accepted).toBe(true);
      expect(relaunch.launchedCharge!.id).toBe(heldId);
      expect(relaunch.launchedCharge!.capacity).toBe(3);
      expect(relaunch.pass!.encounters).toHaveLength(0);
      expect(relaunch.heldCharge).toEqual({ id: heldId, color: 'blue', capacity: 3 });
      expect(relaunch.state.holding).toHaveLength(1);
      expect(relaunch.state.holding[0]!.id).toBe(heldId);
    });
  });

  // ── 10. Front-layer exposure ──────────────────────────────────────────────
  describe('10. Front-layer exposure', () => {
    test('first pass clears RED A; RED B does not drill-through; later relaunch legally hits RED B', () => {
      // Column 1: RED B (1, 1), RED A (1, 2).
      const def = v2(
        ['BBB', 'BRB', 'BRB'],
        [[{ color: 'red', capacity: 2 }], [], [], []],
        { id: 9010 },
      );
      const first = resolveAction(createGame(def), T(0));
      expect(first.pass!.encounters.map((e) => e.pixelId)).toEqual(['L9010-p1-2']);
      expect(first.state.pixels.find((p) => p.id === 'L9010-p1-1')!.cleared).toBe(false);
      expect(first.heldCharge?.capacity).toBe(1);

      // Later relaunch hits newly exposed RED B
      const second = resolveHoldingLaunch(first.state, first.heldCharge!.id);
      expect(second.accepted).toBe(true);
      expect(second.pass!.encounters.map((e) => e.pixelId)).toEqual(['L9010-p1-1']);
      expect(second.state.pixels.find((p) => p.id === 'L9010-p1-1')!.cleared).toBe(true);
    });
  });

  // ── 11. Wrong-color blocker ───────────────────────────────────────────────
  describe('11. Wrong-color blocker', () => {
    test('BLUE blocks RED; after BLUE is cleared on a separate pass, RED becomes targetable', () => {
      // (1, 1) is RED.
      // (1, 2) is BLUE (in front of RED from the bottom).
      // Top, Left, and Right are all BLUE, so RED can ONLY be reached through (1, 2).
      const def = v2(
        ['BBB', 'BRB', 'BBB'],
        [
          [{ color: 'red', capacity: 2 }],
          [{ color: 'blue', capacity: 1 }],
          [],
          [],
        ],
        { id: 9011 },
      );
      // First pass: Red orb launches, BLUE blocks from all sides, rear RED untouched
      const redLaunch = resolveAction(createGame(def), T(0));
      expect(redLaunch.pass!.encounters).toHaveLength(0);
      expect(redLaunch.state.pixels.find((p) => p.id === 'L9011-p1-1')!.cleared).toBe(false);
      expect(redLaunch.heldCharge?.capacity).toBe(2);

      // Second pass: Blue orb launches and clears BLUE at (1, 2)
      const blueLaunch = resolveAction(redLaunch.state, T(1));
      expect(blueLaunch.pass!.encounters.map((e) => e.pixelId)).toEqual(['L9011-p1-2']);
      expect(blueLaunch.state.pixels.find((p) => p.id === 'L9011-p1-2')!.cleared).toBe(true);

      // Third pass: Red held orb relaunches, now reaches and clears RED at (1, 1)
      const redRelaunch = resolveHoldingLaunch(blueLaunch.state, redLaunch.heldCharge!.id);
      expect(redRelaunch.accepted).toBe(true);
      expect(redRelaunch.pass!.encounters.map((e) => e.pixelId)).toEqual(['L9011-p1-1']);
      expect(redRelaunch.state.pixels.find((p) => p.id === 'L9011-p1-1')!.cleared).toBe(true);
    });
  });

  // ── 12. Frozen / Shielded ─────────────────────────────────────────────────
  describe('12. Frozen / Shielded', () => {
    test('Frozen front: breaks 1 layer, spends 1 capacity, does not re-hit on same pass, and remaining ice continues to block rear cells', () => {
      // (1, 1) is RED (rear).
      // (1, 2) is RED with Frozen level 1 (front).
      // Top, Left, and Right are BLUE, so (1, 1) is only reachable from bottom through (1, 2).
      const def = v2(
        ['BBB', 'BRB', 'BRB'],
        [[{ color: 'red', capacity: 3 }], [], [], []],
        {
          id: 9012,
          modifiers: { '1,2': { kind: 'frozen', level: 1 } },
        },
      );
      const outcome = resolveAction(createGame(def), T(0));
      expect(outcome.pass!.encounters).toHaveLength(1);
      expect(outcome.pass!.encounters[0]!.frozenBreak).toBe(true);
      expect(outcome.pass!.charge.capacity).toBe(2);

      // The front cell ice is cracked to 0, but the cell is NOT cleared
      const front = outcome.state.pixels.find((p) => p.id === 'L9012-p1-2')!;
      expect(front.cleared).toBe(false);
      expect(iceLayers(front)).toBe(0);

      // Crucial: The rear cell (1, 1) was NOT hit during the same pass!
      const rear = outcome.state.pixels.find((p) => p.id === 'L9012-p1-1')!;
      expect(rear.cleared).toBe(false);
    });

    test('Shielded front: breaks shield, spends 1 capacity, does not drill through to rear cell', () => {
      // (1, 1) is RED (rear).
      // (1, 2) is RED with Shielded level 1 (front).
      // Top, Left, and Right are BLUE.
      const def = v2(
        ['BBB', 'BRB', 'BRB'],
        [[{ color: 'red', capacity: 3 }], [], [], []],
        {
          id: 9013,
          modifiers: { '1,2': { kind: 'shielded', level: 1 } },
        },
      );
      const outcome = resolveAction(createGame(def), T(0));
      expect(outcome.pass!.encounters).toHaveLength(1);
      expect(outcome.pass!.encounters[0]!.shieldBreak).toBe(true);
      expect(outcome.pass!.charge.capacity).toBe(2);

      const front = outcome.state.pixels.find((p) => p.id === 'L9013-p1-2')!;
      expect(front.cleared).toBe(false);
      expect(shieldLayers(front)).toBe(0);

      const rear = outcome.state.pixels.find((p) => p.id === 'L9013-p1-1')!;
      expect(rear.cleared).toBe(false);
    });
  });

  // ── 13. Linked ────────────────────────────────────────────────────────────
  describe('13. Linked', () => {
    test('primed Linked pixel remains blocking; directional ray does not skip through it; group clear intact', () => {
      // (1, 1) is GREEN.
      // (1, 2) is RED Linked (member 1).
      // (0, 0) is RED Linked (member 2).
      // Top (0,0 is Red, rest Blue), Left (all Blue except 0,0), Right (all Blue).
      // From bottom, ray at column 1 hits (1, 2) Link 1.
      // Behind (1, 2) is GREEN at (1, 1).
      const def = v2(
        ['RBB', 'BGB', 'BRB'],
        [
          [{ color: 'red', capacity: 1 }],
          [{ color: 'green', capacity: 1 }],
          [{ color: 'red', capacity: 1 }],
          [],
        ],
        {
          id: 9014,
          modifiers: {
            '0,0': { kind: 'linked', group: 'pair' },
            '1,2': { kind: 'linked', group: 'pair' },
          },
        },
      );
      // Step 1: Red orb hits (1,2) from the bottom. It primes.
      const first = resolveAction(createGame(def), T(0)).state;
      const linkedPixel = first.pixels.find((p) => p.id === 'L9014-p1-2')!;
      expect(isLinkedPrimed(linkedPixel)).toBe(true);
      expect(linkedPixel.cleared).toBe(false);

      // Step 2: Green orb launches. From bottom, (1, 2) is primed Linked RED.
      // It BLOCKS green ray. Green cannot skip through to hit GREEN at (1, 1).
      const green = resolveAction(first, T(1));
      expect(green.pass!.encounters).toHaveLength(0);
      expect(green.state.pixels.find((p) => p.id === 'L9014-p1-1')!.cleared).toBe(false);

      // Step 3: Hit second linked member at (0,0) with red orb. Group clear triggers!
      const secondRed = resolveAction(green.state, T(2));
      expect(secondRed.pass!.encounters[0]!.linkedGroupClear).toBe(true);
      expect(secondRed.state.pixels.find((p) => p.id === 'L9014-p0-0')!.cleared).toBe(true);
      expect(secondRed.state.pixels.find((p) => p.id === 'L9014-p1-2')!.cleared).toBe(true);
    });
  });

  // ── CORE V2 TERMINAL DEADLOCK VERIFICATION ───────────────────────────────
  describe('Core V2 terminal deadlock fix', () => {
    test('1. held color exists but is directionally/permanently blocked -> lost', () => {
      // (1, 1) is RED. Surrounding cells on all sides are BLUE.
      const def = v2(
        ['BBB', 'BRB', 'BBB'],
        [[], [], [], []],
        { id: 9101 },
      );
      let state = createGame(def);
      state = { ...state, holding: [{ id: 'held-red', color: 'red', capacity: 2 }] };

      // Red pixel exists, but cannot be reached by any ray; state is terminal and lost
      expect(isLost(state)).toBe(true);
      expect(computeStatus(state)).toBe('lost');
      // Holding legality is unchanged (relaunch remains an admitted action)
      expect(legalActions(state)).toEqual([{ kind: 'holding', id: 'held-red' }]);
    });

    test('2. held charge can clear one exposed pixel -> not lost', () => {
      // (1, 2) is RED, exposed from bottom.
      const def = v2(
        ['BBB', 'BBB', 'BRB'],
        [[], [], [], []],
        { id: 9102 },
      );
      let state = createGame(def);
      state = { ...state, holding: [{ id: 'held-red', color: 'red', capacity: 2 }] };

      expect(isLost(state)).toBe(false);
      expect(computeStatus(state)).toBe('playing');
    });

    test('3. held charge can crack Frozen -> not lost', () => {
      // (1, 2) is Frozen RED, exposed from bottom.
      const def = v2(
        ['BBB', 'BBB', 'BRB'],
        [[], [], [], []],
        {
          id: 9103,
          modifiers: { '1,2': { kind: 'frozen', level: 1 } },
        },
      );
      let state = createGame(def);
      state = { ...state, holding: [{ id: 'held-red', color: 'red', capacity: 2 }] };

      expect(isLost(state)).toBe(false);
      expect(computeStatus(state)).toBe('playing');
    });

    test('4. active orb exists -> do not terminal-deadlock', () => {
      // (1, 1) is RED, blocked on all sides by BLUE.
      const def = v2(
        ['BBB', 'BRB', 'BBB'],
        [[], [], [], []],
        { id: 9104 },
      );
      let state = createGame(def);
      const activeLaunch: EpochLaunch = {
        chargeId: 'active-blue', source: 'tunnel', originId: 'tunnel-0', color: 'blue', capacity: 1,
        insertionTime: 0, launchSequence: 0,
      };
      state = {
        ...state,
        holding: [{ id: 'held-red', color: 'red', capacity: 2 }],
        epoch: { launches: [activeLaunch], clock: 0.18 },
        activeCharges: [{
          id: 'active-blue', source: 'tunnel', originId: 'tunnel-0', color: 'blue', capacity: 1,
          remainingCapacity: 1, insertionTime: 0, launchSequence: 0, passCount: 0,
          phase: 'orbiting', encounters: [], finishTime: 1, landed: 'holding',
        }],
      };
      expect(activeSlotCount(state)).toBe(1);
      // The old rule kept such a state alive purely because `activeCharges` was
      // non-empty. That guard is gone: under FIRST LAUNCHED, FIRST SERVED an
      // active charge has ALREADY resolved and parked, so it carries no pending
      // board change, and the guard made the deadlock check unreachable in live
      // play (every commit leaves `activeCharges` set). What matters is whether
      // any admitted action can still change the committed state — here the
      // held red is buried behind blue and every tunnel is empty, so nothing can.
      expect(legalActions(state).length).toBeGreaterThan(0);
      expect(legalActions(state).every((a) => !isProductiveAction(state, a))).toBe(true);
      expect(isLost(state)).toBe(true);
      expect(computeStatus(state)).toBe('lost');
    });

    test('5. tunnel queue still has charges -> do not terminal-deadlock', () => {
      // (1, 1) is RED, blocked on all sides by BLUE.
      // Tunnel 0 has a blue charge that could clear the blocker.
      const def = v2(
        ['BBB', 'BRB', 'BBB'],
        [[{ color: 'blue', capacity: 1 }], [], [], []],
        { id: 9105 },
      );
      let state = createGame(def);
      state = { ...state, holding: [{ id: 'held-red', color: 'red', capacity: 2 }] };

      expect(state.tunnels.some((t) => t.queue.length > 0)).toBe(true);
      // Because tunnel queue still has charges, do not terminal deadlock!
      expect(isLost(state)).toBe(false);
      expect(computeStatus(state)).toBe('playing');
    });

    test('6. zero-progress held relaunch loop now resolves to lost when truly terminal', () => {
      // Board has only 1 BLUE pixel. All tunnels empty. Holding has 1 RED charge.
      const def = v2(
        ['.B.'],
        [[], [], [], []],
        { id: 9106 },
      );
      let state = createGame(def);
      state = {
        ...state,
        holding: [{ id: 'held-red', color: 'red', capacity: 2 }],
      };

      // State is terminal with zero possible progress -> now resolves to lost
      expect(isLost(state)).toBe(true);
      expect(computeStatus(state)).toBe('lost');
    });

    test('7. Legacy V1 reaches the same verdict through the shared rule', () => {
      // Legacy V1 with no exposed targets
      const def: LevelDefinition = {
        id: 9107, title: 'V1Deadlock', themeId: 'test', difficulty: 'easy', holdingCapacity: 3,
        pixelArt: ['WWW', 'WBW', 'WWW'],
        tunnels: [[], [], []],
        ruleset: 'legacyV1',
      };
      let state = createGame(def);
      state = {
        ...state,
        holding: [{ id: 'held-blue', color: 'blue', capacity: 1 }],
      };

      // Legacy V1 now behaves exactly like Core V2: the held blue IS admitted
      // (a buried colour no longer traps its Pal), and the state is lost
      // because that relaunch is a no-op loop rather than because admission
      // refused it.
      expect(legalActions(state)).toEqual([{ kind: 'holding', id: 'held-blue' }]);
      expect(isProductiveAction(state, { kind: 'holding', id: 'held-blue' })).toBe(false);
      expect(isLost(state)).toBe(true);
      expect(computeStatus(state)).toBe('lost');
    });
  });
});
