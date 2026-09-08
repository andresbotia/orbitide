import { createGame } from '@/game/engine/createGame';
import { resolveLaunch } from '@/game/engine/resolveLaunch';
import type { LevelDefinition } from '@/game/engine/types';

import { buildLaunchScript } from '../buildScript';
import { FEEL } from '../constants';
import type { PresentationEvent } from '../events';

function ofKind<K extends PresentationEvent['kind']>(
  events: PresentationEvent[],
  kind: K,
) {
  return events.filter((e): e is Extract<PresentationEvent, { kind: K }> => e.kind === kind);
}

const ringLevel: LevelDefinition = {
  id: 800,
  title: 'T',
  themeId: 't',
  difficulty: 'easy',
  holdingCapacity: 3,
  // green shell, blue centre
  pixelArt: ['GGGGG', 'G...G', 'G.B.G', 'G...G', 'GGGGG'],
  tunnels: [
    [{ color: 'green', capacity: 16 }, { color: 'blue', capacity: 1 }],
    [{ color: 'blue', capacity: 1 }],
    [{ color: 'green', capacity: 20 }],
  ],
};

describe('buildLaunchScript', () => {
  it('starts with a launch event at t=0 and returns events sorted by time', () => {
    const s = createGame(ringLevel);
    const outcome = resolveLaunch(s, 'tunnel-0'); // green:16 clears the shell
    const script = buildLaunchScript(outcome, s);

    expect(script.events[0]).toMatchObject({ kind: 'launch', at: 0 });
    for (let i = 1; i < script.events.length; i += 1) {
      expect(script.events[i]!.at).toBeGreaterThanOrEqual(script.events[i - 1]!.at);
    }
  });

  it('stages one pixelClear per cleared pixel with a decreasing counter', () => {
    const s = createGame(ringLevel);
    const outcome = resolveLaunch(s, 'tunnel-0');
    const script = buildLaunchScript(outcome, s);
    const pops = ofKind(script.events, 'pixelClear');

    expect(pops).toHaveLength(outcome.primaryClearedPixelIds.length);
    const cap = outcome.launchedCharge!.capacity;
    pops.forEach((p, i) => expect(p.remaining).toBe(cap - (i + 1)));
    // every cleared pixel id is represented exactly once
    expect(new Set(pops.map((p) => p.pixelId))).toEqual(
      new Set(outcome.primaryClearedPixelIds),
    );
  });

  it('spaces consecutive pixel pops by at least PIXEL_CLEAR_INTERVAL', () => {
    const s = createGame(ringLevel);
    const outcome = resolveLaunch(s, 'tunnel-0');
    const pops = ofKind(buildLaunchScript(outcome, s).events, 'pixelClear');
    for (let i = 1; i < pops.length; i += 1) {
      expect(pops[i]!.at - pops[i - 1]!.at).toBeGreaterThanOrEqual(
        FEEL.PIXEL_CLEAR_INTERVAL - 1e-6,
      );
    }
  });

  it('a consumed charge bursts and never lands in Holding', () => {
    const s = createGame(ringLevel);
    const outcome = resolveLaunch(s, 'tunnel-0'); // green:16 fully consumed
    expect(outcome.primaryConsumed).toBe(true);
    const script = buildLaunchScript(outcome, s);
    expect(ofKind(script.events, 'chargeConsumed')).toHaveLength(1);
    expect(ofKind(script.events, 'holdingLanded')).toHaveLength(0);
  });

  it('a leftover charge moves to and lands in Holding', () => {
    const level: LevelDefinition = {
      ...ringLevel,
      id: 801,
      tunnels: [
        [{ color: 'green', capacity: 20 }], // 16 shell -> 4 leftover
        [{ color: 'blue', capacity: 1 }],
        [{ color: 'green', capacity: 4 }],
      ],
    };
    const s = createGame(level);
    const outcome = resolveLaunch(s, 'tunnel-0');
    expect(outcome.primaryConsumed).toBe(false);
    const script = buildLaunchScript(outcome, s);

    expect(ofKind(script.events, 'moveToHolding')).toHaveLength(1);
    const landed = ofKind(script.events, 'holdingLanded');
    expect(landed).toHaveLength(1);
    expect(landed[0]!.charge.capacity).toBe(4);
    // landing happens after the orbit
    const orbitEnter = ofKind(script.events, 'orbitEnter')[0]!;
    expect(landed[0]!.at).toBeGreaterThan(orbitEnter.at);
  });

  it('stages held-charge auto-resolutions after the primary pass, in order', () => {
    const level: LevelDefinition = {
      id: 802,
      title: 'T',
      themeId: 't',
      difficulty: 'easy',
      holdingCapacity: 3,
      // blue shell / green ring / red core
      pixelArt: ['BBBBB', 'BGGGB', 'BGRGB', 'BGGGB', 'BBBBB'],
      tunnels: [
        [{ color: 'red', capacity: 1 }, { color: 'green', capacity: 8 }],
        [{ color: 'blue', capacity: 16 }],
        [{ color: 'green', capacity: 8 }],
      ],
    };
    let s = createGame(level);
    s = resolveLaunch(s, 'tunnel-0').state; // park red
    s = resolveLaunch(s, 'tunnel-2').state; // park green:8
    const prev = s;
    const outcome = resolveLaunch(s, 'tunnel-1'); // blue:16 -> green then red auto-resolve
    expect(outcome.autoResolutions.map((r) => r.color)).toEqual(['green', 'red']);

    const script = buildLaunchScript(outcome, prev);
    const react = ofKind(script.events, 'heldReactivate');
    expect(react).toHaveLength(2);
    // both reactivations occur after the primary pass's own pops
    const lastPrimaryPop = Math.max(
      ...ofKind(script.events, 'pixelClear')
        .filter((p) => outcome.primaryClearedPixelIds.includes(p.pixelId))
        .map((p) => p.at),
    );
    for (const r of react) expect(r.at).toBeGreaterThan(lastPrimaryPop);
    expect(script.events.at(-1)).toMatchObject({ kind: 'win' });
  });

  it('emits a win event and totalMs past it when the level is solved', () => {
    const level: LevelDefinition = {
      ...ringLevel,
      id: 803,
      pixelArt: ['GGG', 'GGG', 'GGG'],
      tunnels: [
        [{ color: 'green', capacity: 9 }],
        [{ color: 'green', capacity: 1 }],
        [{ color: 'green', capacity: 1 }],
      ],
    };
    const s = createGame(level);
    const outcome = resolveLaunch(s, 'tunnel-0');
    expect(outcome.state.status).toBe('won');
    const script = buildLaunchScript(outcome, s);
    const win = ofKind(script.events, 'win');
    expect(win).toHaveLength(1);
    expect(script.totalMs).toBeGreaterThan(win[0]!.at);
  });

  it('deferredPixelIds is exactly the set of pixels the script clears', () => {
    const s = createGame(ringLevel);
    const outcome = resolveLaunch(s, 'tunnel-0');
    const script = buildLaunchScript(outcome, s);
    const fromEvents = new Set(
      ofKind(script.events, 'pixelClear').map((p) => p.pixelId),
    );
    expect(new Set(script.deferredPixelIds)).toEqual(fromEvents);
  });

  it('the flight pass covers at least one full lap', () => {
    const s = createGame(ringLevel);
    const script = buildLaunchScript(resolveLaunch(s, 'tunnel-0'), s);
    const flight = ofKind(script.events, 'flightStart')[0]!;
    expect(flight.pass.sweepTurns).toBeGreaterThanOrEqual(1);
    expect(flight.pass.endKind).toBe('burst');
    expect(script.totalMs).toBeGreaterThanOrEqual(
      FEEL.LAUNCH_DURATION + FEEL.ORBIT_DURATION,
    );
  });
});
