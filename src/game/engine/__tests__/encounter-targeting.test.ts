/**
 * REGRESSION B — PHYSICAL ENCOUNTER TARGETING.
 *
 * Gameplay truth and presentation must agree on which encounter a charge fires
 * at and where the shot originates. The charge travels the canonical orbit
 * direction, fires from its actual computed orbit position at the encounter, and
 * the projectile hits the exact engine-selected target. No random visual origin,
 * no presentation-selected target.
 *
 * The M2B engine already owns target selection (`simulateEpoch` / `pickEncounter`)
 * and the presentation script copies the engine encounters verbatim
 * (`buildLaunchScript`). This suite pins that agreement down for the concurrent
 * path and the shot geometry.
 */
import { createGame } from '../createGame';
import { orbitFraction } from '../orbit';
import { simulateEpoch } from '../epoch';
import { LAUNCH_SPACING } from '../concurrency';
import { resolveAction } from '../resolveLaunch';
import type { EpochLaunch, LevelDefinition, OrbColor } from '../types';
import { buildLaunchScript } from '../../presentation/buildScript';
import { progressAt } from '../../presentation/motion';
import { computeBoardGeometry } from '../../rendering/boardGeometry';
import { flightPosition } from '../../rendering/flightGeometry';

const level = (pixelArt: string[], tunnels: LevelDefinition['tunnels']): LevelDefinition => ({
  id: 720, title: 'EncounterTargeting', themeId: 'test', difficulty: 'easy', holdingCapacity: 3, pixelArt, tunnels,
});

const T = (i: number) => ({ kind: 'tunnel' as const, id: `tunnel-${i}` });
const J = (i: number) => ({ kind: 'tunnel' as const, id: `tunnel-${i}`, join: true });

const rawLaunch = (color: OrbColor, capacity: number, i: number, seq = i): EpochLaunch => ({
  chargeId: `c${seq}`, source: 'tunnel', originId: `tunnel-${i}`, color, capacity,
  insertionTime: i * LAUNCH_SPACING, launchSequence: seq,
});

describe('engine ↔ presentation target agreement (concurrent path)', () => {
  // Blue on the left edge, red on the right edge — both reachable from the start.
  const def = level(
    ['B...R', '.....', '.....', '.....', 'B...R'],
    [[{ color: 'blue', capacity: 2 }], [{ color: 'red', capacity: 2 }], [{ color: 'white', capacity: 1 }]],
  );

  test('projectile target ids exactly equal the engine encounter target ids', () => {
    const base = createGame(def);
    const first = resolveAction(base, T(0));   // blue, fresh epoch
    const second = resolveAction(first.state, J(1)); // red joins the running epoch
    expect(second.joinedEpoch).toBe(true);

    // The launched (red) charge's own resolution, as the presentation sees it.
    const redEngine = second.epochCharges!.find((c) => c.color === 'red')!;
    const script = buildLaunchScript(second, first.state, 2).pass;

    expect(script.shots.map((s) => s.pixelId)).toEqual(second.pass!.encounters.map((e) => e.pixelId));
    expect(script.shots.map((s) => s.pixelId)).toEqual(redEngine.encounters.map((e) => e.pixelId));
    expect(script.shots.map((s) => s.progress)).toEqual(redEngine.encounters.map((e) => e.progress));
    // No shot invents a target that the engine did not resolve.
    expect(script.shots).toHaveLength(redEngine.encounters.length);
  });

  test('shot origin equals the charge orbit position at the encounter, on the canonical direction', () => {
    const base = createGame(def);
    const first = resolveAction(base, T(0));
    const second = resolveAction(first.state, J(1));
    const script = buildLaunchScript(second, first.state, 2).pass;
    const layout = computeBoardGeometry(360, base.width, base.height);

    for (const shot of script.shots) {
      // The presentation fires from `flightPosition(pass, layout, shot.fireAt)`.
      const origin = flightPosition(script, layout, shot.fireAt);

      // 1. It is the charge's real orbit position — on the orbit ring.
      const r = Math.hypot(origin.x - layout.center.x, origin.y - layout.center.y);
      expect(r).toBeCloseTo(layout.orbit[0]!.rx, 6);

      // 2. It sits at the charge's actual lap progress, along the canonical
      //    orbit direction (fraction = ORBIT_ENTRY + progress).
      expect(progressAt(script, shot.fireAt)).toBe(shot.progress);
      const angle = orbitFraction(shot.progress) * Math.PI * 2 - Math.PI / 2;
      expect(origin.x).toBeCloseTo(layout.center.x + Math.cos(angle) * layout.orbit[0]!.rx, 6);
      expect(origin.y).toBeCloseTo(layout.center.y + Math.sin(angle) * layout.orbit[0]!.ry, 6);

      // 3. There is no separate anticipation/impact origin — the charge is held
      //    at contact (same source for the whole shot).
      expect(flightPosition(script, layout, shot.anticipateAt)).toEqual(origin);
      expect(flightPosition(script, layout, shot.impactAt)).toEqual(origin);
    }
  });

  test('target order follows the physical (clockwise-from-entry) encounter order with immediate targeting', () => {
    // Four white pixels at the compass points, cleared in bottom→left→top→right immediately at launch.
    const base = createGame(level(
      ['.W.', 'W.W', '.W.'],
      [[{ color: 'white', capacity: 4 }], [{ color: 'white', capacity: 4 }], [{ color: 'white', capacity: 4 }]],
    ));
    const res = simulateEpoch(base, [rawLaunch('white', 4, 0)]);
    expect(res.charges[0]!.encounters.map((e) => e.pixelId))
      .toEqual(['L720-p1-2', 'L720-p0-1', 'L720-p1-0', 'L720-p2-1']);
    // All four fire immediately from the charge's current position (0) without pointless travel.
    expect(res.charges[0]!.encounters.map((e) => e.progress)).toEqual([0, 0, 0, 0]);
  });
});

describe('concurrent target claiming', () => {
  test('a target newly exposed by one charge is acquired later by another in the same epoch', () => {
    const def = level(
      ['RRR', 'RWR', 'RRR'],
      [[{ color: 'red', capacity: 8 }], [{ color: 'white', capacity: 1 }], [{ color: 'white', capacity: 1 }]],
    );
    const base = createGame(def);
    const res = simulateEpoch(base, [rawLaunch('red', 8, 0), rawLaunch('white', 1, 1)]);
    expect(res.charges[0]!.remainingCapacity).toBe(0);
    // White centre was buried at insertion; red exposed it; white took it later.
    expect(res.charges[1]!.encounters.map((e) => e.pixelId)).toEqual(['L720-p1-1']);
    expect(res.pixels.every((p) => p.cleared)).toBe(true);

    // End-to-end through resolveAction: launch red, then join white → win.
    const joined = resolveAction(resolveAction(base, T(0)).state, J(1));
    expect(joined.joinedEpoch).toBe(true);
    expect(joined.state.status).toBe('won');
  });

  test('two concurrent charges cannot both consume the same pixel', () => {
    // One reachable white pixel, two white charges.
    const base = createGame(level(
      ['.W.', '...', '...'],
      [[{ color: 'white', capacity: 1 }], [{ color: 'white', capacity: 1 }], [{ color: 'white', capacity: 1 }]],
    ));
    const res = simulateEpoch(base, [rawLaunch('white', 1, 0), rawLaunch('white', 1, 1)]);
    const clears = res.charges.flatMap((c) => c.encounters.map((e) => e.pixelId));
    expect(clears).toEqual(['L720-p1-0']); // exactly one clear, not two
    expect(res.charges[0]!.remainingCapacity).toBe(0);
    expect(res.charges[0]!.landed).toBe('consumed');
    expect(res.charges[1]!.encounters).toEqual([]);
    expect(res.charges[1]!.remainingCapacity).toBe(1);
    expect(res.charges[1]!.landed).toBe('holding');
  });

  test('no capacity is spent on a target that vanished before the charge arrived', () => {
    const oneTarget = createGame(level(
      ['.W.', '...', '...'],
      [[{ color: 'white', capacity: 1 }], [{ color: 'white', capacity: 3 }], [{ color: 'white', capacity: 1 }]],
    ));
    // c0 (seq 0) clears the pixel before c1 (seq 1, larger capacity) reaches it.
    const res = simulateEpoch(oneTarget, [rawLaunch('white', 1, 0), rawLaunch('white', 3, 1)]);
    expect(res.charges[1]!.encounters).toEqual([]);
    expect(res.charges[1]!.remainingCapacity).toBe(3); // full capacity preserved
    expect(res.charges[1]!.landed).toBe('holding');
  });

  test('identical state + action sequence produces an identical result', () => {
    const def = level(
      ['WWWW', 'WBWW', 'WWCW', 'WWWW'],
      [
        [{ color: 'white', capacity: 6 }, { color: 'blue', capacity: 1 }],
        [{ color: 'white', capacity: 6 }, { color: 'cyan', capacity: 1 }],
        [{ color: 'white', capacity: 2 }],
      ],
    );
    const run = () => {
      let state = createGame(def);
      const scripts: string[] = [];
      for (const action of [T(0), J(1), J(0), J(1)]) {
        const outcome = resolveAction(state, action);
        scripts.push(JSON.stringify(buildLaunchScript(outcome, state, scripts.length + 1).pass.shots));
        state = outcome.state;
      }
      return { state: JSON.stringify(state), scripts };
    };
    const a = run();
    const b = run();
    expect(a.state).toBe(b.state);
    expect(a.scripts).toEqual(b.scripts);
  });
});

describe('Part 5 — targeting regression tests A–J', () => {
  // A. One exposed matching pixel exists at launch -> charge fires immediately.
  test('A: one exposed matching pixel at launch fires immediately at progress 0', () => {
    const def = level(['...', '.W.', '...'], [[{ color: 'white', capacity: 1 }], [], []]);
    const base = createGame(def);
    const outcome = resolveAction(base, T(0));
    expect(outcome.accepted).toBe(true);
    expect(outcome.pass!.encounters).toHaveLength(1);
    expect(outcome.pass!.encounters[0]!.progress).toBe(0);
    expect(outcome.state.pixels.find((p) => p.id === 'L720-p1-1')!.cleared).toBe(true);
  });

  // B. Matching pixel is geometrically on the "other side" of the board -> no pointless half/full orbit before firing.
  test('B: pixel on the far side (12 o clock vs 6 o clock entry) fires immediately at progress 0', () => {
    // Only the top-most pixel exists; entry is at bottom center.
    const def = level(['.W.', '...', '...'], [[{ color: 'white', capacity: 1 }], [], []]);
    const base = createGame(def);
    const outcome = resolveAction(base, T(0));
    expect(outcome.accepted).toBe(true);
    expect(outcome.pass!.encounters[0]!.progress).toBe(0); // fires immediately, not after 0.5 lap
  });

  // C. Multiple matching pixels exist -> deterministic target selected.
  test('C: multiple matching pixels select deterministically using canonical clearOrder', () => {
    const def = level(['.W.', 'W.W', '.W.'], [[{ color: 'white', capacity: 2 }], [], []]);
    const base = createGame(def);
    const outcome = resolveAction(base, T(0));
    expect(outcome.pass!.encounters.map((e) => e.pixelId)).toEqual(['L720-p1-2', 'L720-p0-1']);
    expect(outcome.pass!.encounters.map((e) => e.progress)).toEqual([0, 0]);
  });

  // D. Hit reveals another matching pixel -> second target acquired immediately.
  test('D: hit reveals another matching pixel which is acquired immediately in the same pass', () => {
    // p1-1 (white) is shielded behind p1-2 (white); clearing p1-2 exposes p1-1.
    const def = level(['RRR', 'RWR', '.W.'], [[{ color: 'white', capacity: 2 }], [], []]);
    const base = createGame(def);
    const outcome = resolveAction(base, T(0));
    expect(outcome.pass!.encounters.map((e) => e.pixelId)).toEqual(['L720-p1-2', 'L720-p1-1']);
    expect(outcome.pass!.encounters.map((e) => e.progress)).toEqual([0, 0]);
    expect(outcome.pass!.charge.capacity).toBe(0);
  });

  // E. Frozen hit exposes/changes state -> immediately re-query.
  test('E: frozen hit cracks ice and immediately re-queries other matching targets', () => {
    const def: LevelDefinition = {
      ...level(['.W.', '...', '.W.'], [[{ color: 'white', capacity: 2 }], [], []]),
      modifiers: { '1,2': { kind: 'frozen', level: 1 } },
    };
    const base = createGame(def);
    const outcome = resolveAction(base, T(0));
    expect(outcome.accepted).toBe(true);
    // Hits frozen pixel first (bottom, cracks ice), then immediately hits top pixel (clears)
    expect(outcome.pass!.encounters).toHaveLength(2);
    expect(outcome.pass!.encounters[0]!.pixelId).toBe('L720-p1-2');
    expect(outcome.pass!.encounters[0]!.frozenBreak).toBe(true);
    expect(outcome.pass!.encounters[1]!.pixelId).toBe('L720-p1-0');
    expect(outcome.pass!.encounters[1]!.frozenBreak).toBeFalsy();
  });

  // F. Shield break -> immediately re-query.
  test('F: shield break collapses energy shield and immediately re-queries next target', () => {
    const def: LevelDefinition = {
      ...level(['.W.', '...', '.W.'], [[{ color: 'white', capacity: 2 }], [], []]),
      modifiers: { '1,2': { kind: 'shielded', level: 1 } },
    };
    const base = createGame(def);
    const outcome = resolveAction(base, T(0));
    expect(outcome.accepted).toBe(true);
    expect(outcome.pass!.encounters).toHaveLength(2);
    expect(outcome.pass!.encounters[0]!.pixelId).toBe('L720-p1-2');
    expect(outcome.pass!.encounters[0]!.shieldBreak).toBe(true);
    expect(outcome.pass!.encounters[1]!.pixelId).toBe('L720-p1-0');
  });

  // G. Concurrent charges competing for a target -> no duplicate claim.
  test('G: concurrent charges competing for a target do not duplicate claim', () => {
    const def = level(['.W.', '...', '...'], [[{ color: 'white', capacity: 1 }], [{ color: 'white', capacity: 1 }], []]);
    const base = createGame(def);
    const res = simulateEpoch(base, [rawLaunch('white', 1, 0), rawLaunch('white', 1, 1)]);
    const allEncounters = res.charges.flatMap((c) => c.encounters);
    expect(allEncounters).toHaveLength(1);
    expect(allEncounters[0]!.pixelId).toBe('L720-p1-0');
  });

  // H. Target disappears before resolution -> no capacity incorrectly spent.
  test('H: target disappeared before resolution preserves charge capacity', () => {
    const def = level(['.W.', '...', '...'], [[{ color: 'white', capacity: 1 }], [{ color: 'white', capacity: 3 }], []]);
    const base = createGame(def);
    const res = simulateEpoch(base, [rawLaunch('white', 1, 0), rawLaunch('white', 3, 1)]);
    expect(res.charges[1]!.encounters).toHaveLength(0);
    expect(res.charges[1]!.remainingCapacity).toBe(3);
    expect(res.charges[1]!.landed).toBe('holding');
  });

  // I. Charge has no matching exposed targets -> continues/settles according to normal rules.
  test('I: charge with no matching targets coasts a full lap and lands in holding', () => {
    const def = level(['.R.', '...', '...'], [[{ color: 'blue', capacity: 2 }], [], []]);
    const base = createGame(def);
    const outcome = resolveAction(base, T(0));
    expect(outcome.accepted).toBe(true);
    expect(outcome.pass!.encounters).toHaveLength(0);
    expect(outcome.pass!.progress).toBe(1);
    expect(outcome.heldCharge).toMatchObject({ color: 'blue', capacity: 2 });
  });

  // J. Held relaunch has a legal target -> relaunch fires without artificial orbit delay.
  test('J: held relaunch with a legal target fires immediately without artificial delay', () => {
    const def = level(
      ['WWW', 'WBW', 'WWW'],
      [[{ color: 'blue', capacity: 1 }], [{ color: 'white', capacity: 8 }], []],
    );
    let state = createGame(def);
    // Launch Blue: no exposed blue pixels, flies full lap, lands in holding.
    const blueLaunch = resolveAction(state, T(0));
    expect(blueLaunch.accepted).toBe(true);
    expect(blueLaunch.heldCharge).toMatchObject({ color: 'blue', capacity: 1 });
    state = blueLaunch.state;
    expect(state.holding).toHaveLength(1);
    const heldId = state.holding[0]!.id;

    // Launch White: clears all 8 white pixels, exposing Blue.
    const whiteLaunch = resolveAction(state, T(1));
    expect(whiteLaunch.accepted).toBe(true);
    state = whiteLaunch.state;

    // Relaunch held Blue: Blue is now legal and exposed.
    const relaunch = resolveAction(state, { kind: 'holding', id: heldId });
    expect(relaunch.accepted).toBe(true);
    expect(relaunch.pass!.encounters).toHaveLength(1);
    expect(relaunch.pass!.encounters[0]!.progress).toBe(0); // immediate firing
    expect(relaunch.state.status).toBe('won');
  });
});
