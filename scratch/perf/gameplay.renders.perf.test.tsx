/**
 * M5.8B — gameplay render-count harness.
 *
 * Drives the REAL `useGameSession` with a controlled wall clock, rendering the
 * real HUD + Core V2 board + control deck exactly as `GameScreen` composes
 * them. The UI-thread clock is replaced by a 16 ms frame loop that calls
 * `presentThrough(passId, eventCountAt(pass, now - launchedAt))` for every live
 * flight — what `CoreV2FlightActor`'s animated reaction does on device.
 *
 * Renders are counted by wrapping each exported memo component's inner
 * function, so a bailed-out memo does not count. Synthetic fixture only — no
 * campaign level (campaign content is mutable).
 *
 *   npx jest --config scratch/perf/jest.perf.js --runInBand gameplay.renders
 */
import { act, create } from 'react-test-renderer';
import { useEffect } from 'react';

import type { LevelDefinition } from '@/game/engine/types';
import { eventCountAt } from '@/game/presentation/motion';
import { useGameSession, type GameSession } from '@/hooks/useGameSession';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 0, Medium: 1, Heavy: 2, Rigid: 3, Soft: 4 },
  NotificationFeedbackType: { Success: 0, Warning: 1, Error: 2 },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const counts = new Map<string, number>();
function instrument(name: string, component: any) {
  const inner = component.type;
  if (typeof inner !== 'function') throw new Error(`${name} is not a memo component`);
  counts.set(name, 0);
  component.type = function Counted(props: any) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
    return inner(props);
  };
}

const { Hud } = require('@/components/Hud');
const { ControlDeck } = require('@/components/gameplay/ControlDeck');
const { CoreV2Board } = require('@/game/rendering/CoreV2Board');
const TARGETS: Record<string, any> = {
  Hud,
  ControlDeck,
  CoreV2Board,
  ActiveStatus: require('@/components/ActiveStatus').ActiveStatus,
  HoldingTray: require('@/components/HoldingTray').HoldingTray,
  TunnelBar: require('@/components/TunnelBar').TunnelBar,
  ItemRack: require('@/components/gameplay/ItemRack').ItemRack,
  BoardActors: require('@/game/rendering/BoardActors').BoardActors,
  StaticPixelField: require('@/game/rendering/StaticPixelField').StaticPixelField,
  PixelPal: require('@/game/rendering/pixelPal/PixelPal').PixelPal,
  AnimatedCount: require('@/game/rendering/pixelPal/AnimatedCount').AnimatedCount,
  PixelPalFace: require('@/game/rendering/pixelPal/PixelPalFace').PixelPalFace,
  EnergyShot: require('@/game/rendering/EnergyShot').EnergyShot,
  ...optional('HoldingStatus', '@/components/HoldingTray'),
  ...optional('GateFx', '@/game/rendering/BoardFx'),
  ...optional('ComboLayer', '@/game/rendering/BoardFx'),
};
/** Components that only exist after M5.8B. */
function optional(name: string, path: string): Record<string, any> {
  try {
    const c = require(path)[name];
    return c ? { [name]: c } : {};
  } catch { return {}; }
}
for (const [name, c] of Object.entries(TARGETS)) instrument(name, c);
/* eslint-enable @typescript-eslint/no-require-imports */

/**
 * 14×14 four-colour plate, four tunnels, Active 5, Holding 3. Dense enough
 * that five Pals fire overlapping volleys; small enough to run fast.
 */
const ROW = 'RRRBBBBGGGGYYY';
const FIXTURE: LevelDefinition = {
  id: 9801,
  title: 'Perf Plate',
  themeId: 'fixture',
  difficulty: 'easy',
  ruleset: 'coreV2',
  holdingCapacity: 3,
  pixelArt: Array.from({ length: 14 }, (_, y) => (y % 2 === 0 ? ROW : [...ROW].reverse().join(''))),
  tunnels: [
    [{ color: 'red', capacity: 12 }, { color: 'blue', capacity: 12 }, { color: 'red', capacity: 12 }, { color: 'yellow', capacity: 20 }],
    [{ color: 'blue', capacity: 12 }, { color: 'green', capacity: 20 }, { color: 'blue', capacity: 16 }, { color: 'red', capacity: 18 }],
    [{ color: 'green', capacity: 12 }, { color: 'yellow', capacity: 12 }, { color: 'green', capacity: 16 }, { color: 'yellow', capacity: 10 }],
    [{ color: 'yellow', capacity: 12 }, { color: 'red', capacity: 12 }, { color: 'blue', capacity: 12 }, { color: 'green', capacity: 8 }],
  ],
} as LevelDefinition;

let session: GameSession | null = null;
/** Pre-M5.8B HUD took the whole state; kept so the baseline stays runnable. */
const HUD_TAKES_STATE = /state: GameState/.test(require('node:fs').readFileSync(require('node:path').join(__dirname, '../../src/components/Hud.tsx'), 'utf8'));
const noop = () => {};
const onSourceLayout = () => {};

function Harness() {
  const s = useGameSession(FIXTURE.id, { level: FIXTURE, completedTutorials: [] });
  useEffect(() => { session = s; });
  const launchTunnel = s.launch;
  return (
    <>
      {HUD_TAKES_STATE
        ? <Hud state={s.state} title={FIXTURE.title} onRestart={s.restart} onHome={noop} />
        : <Hud levelId={s.state.levelId} cleared={s.state.pixels.filter((p) => p.cleared).length} total={s.state.pixels.length} onRestart={s.restart} onHome={noop} />}
      <CoreV2Board
        size={360} width={360} height={420}
        state={s.state} flights={s.flights} landingFlights={s.landingFlights}
        presentThrough={s.presentThrough} reducedMotion={false}
      />
      <ControlDeck
        state={s.state}
        activeCount={s.activeCount}
        activeCapacity={s.activeCapacity}
        layoutVersion={780}
        disabled={s.state.status !== 'playing'}
        blocked={!s.canLaunch}
        capacityRefusalSeq={s.lastDenial?.reason === 'activeFull' ? s.lastDenial.seq : 0}
        usefulIds={EMPTY}
        pixelPal
        onSourceLayout={onSourceLayout}
        onLaunchTunnel={launchTunnel}
        onLaunchHeld={s.launchHeld}
        message={s.message}
        tutorial={s.tutorial}
      />
    </>
  );
}
const EMPTY = new Set<string>();

function snapshot(): Record<string, number> {
  return Object.fromEntries(counts);
}
function diff(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(b)) out[k] = (b[k] ?? 0) - (a[k] ?? 0);
  return out;
}

interface Scenario { name: string; launches: { at: number; tunnel: string }[]; spamAt?: number[] }

function run(sc: Scenario) {
  jest.useFakeTimers({ now: 0 });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  session = null;
  for (const k of counts.keys()) counts.set(k, 0);
  let root!: ReturnType<typeof create>;
  act(() => { root = create(<Harness />); });
  const mounted = snapshot();
  const t0 = Date.now();
  const pending = [...sc.launches];
  const spam = [...(sc.spamAt ?? [])];
  let hits = 0;
  let frames = 0;
  let accepted = 0;
  const cursors = new Map<number, number>();
  for (let now = 0; now < 90_000; now += 16) {
    jest.setSystemTime(t0 + now);
    while (pending.length && pending[0]!.at <= now) {
      const l = pending.shift()!;
      act(() => { if (session!.launch(l.tunnel, { x: 100, y: 700 })) accepted++; });
    }
    while (spam.length && spam[0]! <= now) {
      spam.shift();
      act(() => { session!.launch('tunnel-0', { x: 100, y: 700 }); });
    }
    const live = [...session!.flights, ...session!.landingFlights];
    if (!live.length && !pending.length) break;
    frames++;
    for (const pass of live) {
      const t = Date.now() - pass.launchedAtMs;
      const count = t >= pass.totalMs ? Number.MAX_SAFE_INTEGER : eventCountAt(pass, t);
      const prev = cursors.get(pass.passId) ?? 0;
      if (count > 0 && count !== prev) {
        cursors.set(pass.passId, count);
        const newly = pass.events.slice(prev === Number.MAX_SAFE_INTEGER ? pass.events.length : prev, count)
          .filter((e) => e.kind === 'pixelClear').length;
        hits += newly;
        act(() => { session!.presentThrough(pass.passId, count); });
      }
    }
  }
  const played = diff(mounted, snapshot());
  const cleared = session!.state.pixels.filter((p) => p.cleared).length;
  act(() => root.unmount());
  jest.useRealTimers();
  return { mounted, played, hits, cleared, frames, accepted };
}

const SCENARIOS: Scenario[] = [
  { name: '1 Pal', launches: [{ at: 0, tunnel: 'tunnel-0' }] },
  { name: '3 Pals', launches: [0, 400, 800].map((at, i) => ({ at, tunnel: `tunnel-${i}` })) },
  { name: '5 Pals rapid', launches: [0, 60, 120, 180, 240].map((at, i) => ({ at, tunnel: `tunnel-${i % 4}` })) },
  {
    name: '5 Pals + full-rail spam',
    launches: [0, 60, 120, 180, 240].map((at, i) => ({ at, tunnel: `tunnel-${i % 4}` })),
    spamAt: [300, 340, 380, 420, 460, 500],
  },
];

test('gameplay render counts', () => {
  const lines: string[] = [];
  for (const sc of SCENARIOS) {
    const r = run(sc);
    const per = (k: string) => (r.hits ? (r.played[k]! / r.hits).toFixed(2) : '-');
    lines.push(`[RENDERS] ${sc.name}: accepted=${r.accepted} hits=${r.hits} cleared=${r.cleared}`);
    for (const k of Object.keys(TARGETS)) {
      lines.push(`   ${k.padEnd(18)} mount=${String(r.mounted[k]).padStart(3)} play=${String(r.played[k]).padStart(5)} perHit=${per(k)}`);
    }
  }
  console.log(lines.join('\n'));
});
