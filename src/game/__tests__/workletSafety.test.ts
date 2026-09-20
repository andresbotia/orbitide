import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Static guard for a native-only crash class that Node/Jest never executes:
 * a Reanimated worklet (UI runtime) synchronously calling a plain JS helper
 * ("[Worklets] Tried to synchronously call a Remote Function").
 *
 * Every call inside a `useAnimatedStyle` / `useDerivedValue` /
 * `useAnimatedReaction` body in gameplay presentation code must be either a
 * Reanimated/JS builtin or a function that itself declares `'worklet'`.
 * Anything else (e.g. `neonAlpha`) must be precomputed on the JS side.
 */
const root = resolve(__dirname, '../../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === 'node_modules') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const SOURCES = [
  ...walk(join(root, 'src/components')),
  ...walk(join(root, 'src/game/rendering')),
  ...walk(join(root, 'src/game/presentation')),
  ...walk(join(root, 'src/theme')),
  join(root, 'src/screens/GameScreen.tsx'),
];

/** Names of functions that declare themselves worklets anywhere in src. */
const WORKLET_FNS = new Set<string>();
for (const file of [...SOURCES, ...walk(join(root, 'src/game/geometry'))]) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/function\s+(\w+)\s*\([^)]*\)[^{]*\{\s*['"]worklet['"]/g)) WORKLET_FNS.add(m[1]!);
}

const BUILTINS = new Set([
  'Math', 'Number', 'String', 'Boolean', 'Array',
  'interpolate', 'interpolateColor', 'withTiming', 'withSpring', 'withSequence', 'withDelay', 'withRepeat',
  'runOnJS', 'if', 'for', 'while', 'switch', 'return',
]);

/** Gameplay files whose worklets this guard covers (the M5.8B surface + boards). */
const GAMEPLAY = /(TunnelBar|HoldingTray|ActiveStatus|Hud|ControlDeck|ItemRack|LevelIntro|BoardFx|RejectPulse|pixelPal[\\/]|ResultOverlay|DiscoveryOverlay|DiscoveryReveal|EnergyShot|CoreV2Board|GameScreen)\.tsx?$/;

function workletBodies(src: string): { body: string; line: number }[] {
  const out: { body: string; line: number }[] = [];
  for (const m of src.matchAll(/\b(useAnimatedStyle|useDerivedValue|useAnimatedReaction)\(/g)) {
    let i = m.index! + m[0].length;
    let depth = 1;
    while (depth > 0 && i < src.length) {
      const c = src[i]!;
      if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    out.push({ body: src.slice(m.index! + m[0].length, i - 1), line: src.slice(0, m.index).split('\n').length });
  }
  return out;
}

test('worklet guard knows the real worklet helpers', () => {
  for (const name of ['flightPose', 'progressAt', 'capacityAt', 'eventCountAt', 'shotsClearedAt',
    'holdingHandoffOpacity', 'nextComboChain', 'comboTierCrossed', 'pulseEnvelope']) {
    expect(WORKLET_FNS.has(name)).toBe(true);
  }
  // A plain colour helper is NOT a worklet — the M5.8B crash.
  expect(WORKLET_FNS.has('neonAlpha')).toBe(false);
});

test('gameplay worklets only call builtins or declared worklet helpers', () => {
  const offenders: string[] = [];
  for (const file of SOURCES.filter((f) => GAMEPLAY.test(f))) {
    const src = readFileSync(file, 'utf8');
    for (const { body, line } of workletBodies(src)) {
      // Bare calls (not `.method(`): `foo(` preceded by neither `.` nor a word char.
      for (const m of body.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
        const name = m[1]!;
        if (BUILTINS.has(name) || WORKLET_FNS.has(name)) continue;
        offenders.push(`${relative(root, file)}:${line} calls ${name}()`);
      }
    }
  }
  expect(offenders).toEqual([]);
});
