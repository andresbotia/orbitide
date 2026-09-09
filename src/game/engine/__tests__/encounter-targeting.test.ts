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

  test('target order follows the physical (clockwise-from-entry) encounter order', () => {
    // Four white pixels at the compass points, cleared in bottom→left→top→right.
    const base = createGame(level(
      ['.W.', 'W.W', '.W.'],
      [[{ color: 'white', capacity: 4 }], [{ color: 'white', capacity: 4 }], [{ color: 'white', capacity: 4 }]],
    ));
    const res = simulateEpoch(base, [rawLaunch('white', 4, 0)]);
    expect(res.charges[0]!.encounters.map((e) => e.pixelId))
      .toEqual(['L720-p1-2', 'L720-p0-1', 'L720-p1-0', 'L720-p2-1']);
    expect(res.charges[0]!.encounters.map((e) => e.progress)).toEqual([0, 0.25, 0.5, 0.75]);
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
