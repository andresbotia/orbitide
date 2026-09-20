import { createGame } from '@/game/engine/createGame';
import { resolveAction } from '@/game/engine/resolveLaunch';
import type { LevelDefinition } from '@/game/engine/types';
import { buildLaunchScript } from '../buildScript';
import type { FlightPass } from '../events';
import { capacityAt, shotsClearedAt } from '../motion';
import { reconcileFlights } from '../reconcile';
import { entryWaitEndAt } from '@/game/rendering/railPath';

/**
 * The in-flight count contract (device QA). The badge shows
 * `rows[shotsClearedAt(t)]`, where `rows = [charge.capacity, ...shots.remaining]`
 * — so these two functions ARE what the player sees. A Pal must read its full
 * remaining capacity from the moment it launches, never 0 and never blank
 * before its first clear.
 */

const v2 = (extra: Partial<LevelDefinition> & Pick<LevelDefinition, 'id' | 'title' | 'pixelArt' | 'tunnels'>): LevelDefinition => {
  const tunnels = [...extra.tunnels];
  while (tunnels.length < 4) tunnels.push([]);
  return { themeId: 'fixture', difficulty: 'easy', holdingCapacity: 3, ...extra, tunnels, ruleset: 'coreV2' };
};

/** What the badge frames at `t`. */
function badgeAt(pass: FlightPass, t: number): number {
  const rows = [pass.charge.capacity, ...pass.shots.map((s) => s.remaining)];
  const i = Math.max(0, Math.min(rows.length - 1, shotsClearedAt(pass, t)));
  return rows[i]!;
}

function launch(level: LevelDefinition, tunnelId = 'tunnel-0') {
  const game = createGame(level);
  const outcome = resolveAction(game, { kind: 'tunnel', id: tunnelId });
  if (!outcome.accepted) throw new Error('fixture launch was refused');
  return { before: game, outcome, pass: buildLaunchScript(outcome, game, 1).pass };
}

/** 8-capacity white Pal over an all-white plate: it fires every shot it has. */
const CONSUMED = v2({
  id: 9911, title: 'consumed', pixelArt: ['WWWW', 'WWWW', 'WWWW'],
  tunnels: [[{ color: 'white', capacity: 8 }], [], [], []],
});

/** 8-capacity Pal with only 5 reachable targets: it banks the rest in Holding. */
const PARTIAL = v2({
  id: 9912, title: 'partial', pixelArt: ['WWWWW'],
  tunnels: [[{ color: 'white', capacity: 8 }], [], [], []],
});

describe('A. no hit yet', () => {
  test('shows the launch capacity from the first frame, not 0', () => {
    const { pass } = launch(CONSUMED);
    expect(pass.charge.capacity).toBe(8);
    const firstClear = pass.shots[0]!.clearAt;
    for (const t of [0, 1, 50, pass.liftMs, firstClear - 1]) {
      expect(badgeAt(pass, t)).toBe(8);
      expect(capacityAt(pass, t)).toBe(8);
    }
  });

  test('the value never comes from an empty event lookup', () => {
    const { pass } = launch(CONSUMED);
    // Row 0 exists before any shot has landed.
    expect(shotsClearedAt(pass, 0)).toBe(0);
    expect(badgeAt(pass, 0)).not.toBe(0);
  });
});

describe('B/C. hits', () => {
  test('steps down by one on each exact clear frame', () => {
    const { pass } = launch(CONSUMED);
    const first = pass.shots[0]!;
    expect(badgeAt(pass, first.clearAt - 1)).toBe(8);
    expect(badgeAt(pass, first.clearAt)).toBe(7);

    let expected = 8;
    for (const shot of pass.shots) {
      expected -= 1;
      expect(badgeAt(pass, shot.clearAt)).toBe(expected);
      expect(capacityAt(pass, shot.clearAt)).toBe(expected);
    }
    expect(pass.shots.map((s) => s.remaining)).toEqual([7, 6, 5, 4, 3, 2, 1, 0]);
  });

  test('badge and capacityAt never disagree across the whole flight', () => {
    const { pass } = launch(CONSUMED);
    for (let t = 0; t <= pass.totalMs; t += 17) {
      expect(badgeAt(pass, t)).toBe(capacityAt(pass, t));
    }
  });
});

describe('D. partial Pal to Holding', () => {
  test('holds its leftover count through the rest of the flight and the landing', () => {
    const { pass } = launch(PARTIAL);
    expect(pass.terminal.kind).toBe('toHolding');
    const leftover = pass.charge.capacity - pass.shots.length;
    expect(leftover).toBeGreaterThan(0);
    const lastClear = pass.shots[pass.shots.length - 1]!.clearAt;
    for (const t of [lastClear, lastClear + 1, pass.orbitEndAt, pass.landingAt, pass.totalMs]) {
      expect(badgeAt(pass, t)).toBe(leftover);
    }
  });
});

describe('E. fully consumed', () => {
  test('reaches 0 only on the final clear, which is where the burst starts', () => {
    const { pass } = launch(CONSUMED);
    const last = pass.shots[pass.shots.length - 1]!;
    expect(last.remaining).toBe(0);
    expect(badgeAt(pass, last.clearAt - 1)).toBe(1);
    expect(badgeAt(pass, last.clearAt)).toBe(0);
    // `PixelPal` fades the plate from this same beat; the terminal is here too.
    expect(pass.terminal.kind).toBe('consumed');
    expect(pass.orbitEndAt).toBe(last.clearAt);
  });
});

describe('F. reconcile / re-script', () => {
  test('a re-scripted tail keeps the presented prefix and never resets to 0', () => {
    const level = v2({
      id: 9913, title: 'join', pixelArt: ['WWWW', 'WWWW'],
      tunnels: [[{ color: 'white', capacity: 6 }], [{ color: 'white', capacity: 4 }], [], []],
    });
    const game = createGame(level);
    const first = resolveAction(game, { kind: 'tunnel', id: 'tunnel-0' });
    if (!first.accepted) throw new Error('refused');
    const original: FlightPass = { ...buildLaunchScript(first, game, 1).pass, launchedAtMs: 0 };

    // Present the first two shots, then a second Pal joins and re-scripts.
    const presentedUntil = original.shots[1]!.clearAt;
    const seenBefore = badgeAt(original, presentedUntil);
    const second = resolveAction(first.state, { kind: 'tunnel', id: 'tunnel-1', join: true });
    if (!second.accepted) throw new Error('join refused');
    const joined: FlightPass = { ...buildLaunchScript(second, first.state, 2).pass, launchedAtMs: presentedUntil };

    const { passes } = reconcileFlights({
      flights: [{ pass: original, cursor: 0 }, { pass: joined, cursor: 0 }],
      freshPassId: joined.passId,
      truth: second.state,
      resolutions: second.epochCharges ?? [],
      pixels: game.pixels,
      now: presentedUntil,
      slotPoints: [],
      convoy: true,
    });
    const rescripted = passes.find((p) => p.passId === original.passId)!;

    // Everything already shown is unchanged...
    for (let t = 0; t <= presentedUntil; t += 13) {
      expect(badgeAt(rescripted, t)).toBe(badgeAt(original, t));
    }
    expect(badgeAt(rescripted, presentedUntil)).toBe(seenBefore);
    // ...and the count never restarts from the original charge or from 0.
    expect(badgeAt(rescripted, presentedUntil + 1)).toBeLessThanOrEqual(seenBefore);
    for (let t = presentedUntil; t <= rescripted.totalMs; t += 13) {
      expect(badgeAt(rescripted, t)).toBeLessThanOrEqual(seenBefore);
    }
  });
});

describe('G. staged / upstream Pal', () => {
  test('a Pal waiting to merge still shows its full remaining capacity', () => {
    const { pass } = launch(CONSUMED);
    // A staged Pal waits at the rail origin and its shots are pushed behind
    // the hold, exactly as the convoy scheduler re-times them.
    const wait = 420;
    const staged: FlightPass = {
      ...pass,
      convoyHolds: [{ progress: 0, startAt: pass.liftMs, endAt: pass.liftMs + wait }],
      shots: pass.shots.map((shot) => ({
        ...shot,
        anticipateAt: shot.anticipateAt + wait,
        fireAt: shot.fireAt + wait,
        impactAt: shot.impactAt + wait,
        clearAt: shot.clearAt + wait,
      })),
    };
    const entryEnd = entryWaitEndAt(staged);
    expect(entryEnd).toBe(staged.liftMs + wait);
    // Full capacity for the whole wait, including the frame it merges.
    for (const t of [0, staged.liftMs, staged.liftMs + 200, entryEnd]) {
      expect(badgeAt(staged, t)).toBe(8);
    }
    // ...and it starts counting down only once it is actually firing.
    expect(badgeAt(staged, staged.shots[0]!.clearAt)).toBe(7);
  });
});
