import { Blur, Canvas, Circle, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { interpolate, useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { GameState, LevelDefinition } from '@/game/engine/types';
import { resolveReveal, revealTimeline, type ResolvedReveal } from '@/game/rendering/revealGeometry';
import { orbColors } from '@/theme/colors';
import { arcade } from '@/theme/arcade';
import { cellCenter, computeBoardGeometry } from './boardGeometry';

interface DiscoveryRevealProps {
  size: number;
  level: LevelDefinition;
  /** Won state — pixels carry their original positions (all cleared). */
  state: GameState;
  /** Master reveal progress, 0..1 over `revealTimeline().tailMs`. */
  progress: SharedValue<number>;
  reducedMotion: boolean;
}

const CLAMP = 'clamp' as const;

/**
 * The Skia constellation layer. The solved picture fades to a holographic ghost;
 * authored (or deterministic-fallback) nodes brighten and rise; the lines draw
 * between them. One master progress value; per-node derived values only. No JS
 * per-frame work, no particle spam.
 */
export const DiscoveryReveal = memo(function DiscoveryReveal({
  size, level, state, progress, reducedMotion,
}: DiscoveryRevealProps) {
  const geo = useMemo(() => computeBoardGeometry(size, state.width, state.height), [size, state.width, state.height]);
  const reveal = useMemo<ResolvedReveal>(() => resolveReveal(level), [level]);
  const tl = useMemo(() => revealTimeline(reducedMotion), [reducedMotion]);

  const nodePts = useMemo(
    () => reveal.nodes.map((n) => cellCenter(geo, n.x, n.y)),
    [reveal, geo],
  );

  const linesPath = useMemo(() => {
    let d = '';
    for (const [a, b] of reveal.lines) {
      const p = nodePts[a];
      const q = nodePts[b];
      if (!p || !q) continue;
      d += `M ${p.x.toFixed(2)} ${p.y.toFixed(2)} L ${q.x.toFixed(2)} ${q.y.toFixed(2)} `;
    }
    return d.trim();
  }, [reveal.lines, nodePts]);

  const particles = useMemo(() => {
    if (reducedMotion) return [];
    let seed = (level.id * 0x9e3779b1) >>> 0;
    const rnd = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return Array.from({ length: 8 }, (_, i) => {
      const anchor = nodePts[i % Math.max(1, nodePts.length)] ?? geo.center;
      const angle = rnd() * Math.PI * 2;
      return {
        x: anchor.x,
        y: anchor.y,
        dx: Math.cos(angle) * geo.cell * 1.6,
        dy: Math.sin(angle) * geo.cell * 1.6,
        delay: rnd() * 0.4,
      };
    });
  }, [reducedMotion, level.id, nodePts, geo]);

  const elapsed = useDerivedValue(() => progress.value * tl.tailMs);

  const ghostOpacity = useDerivedValue(() =>
    interpolate(elapsed.value, [0, tl.settleMs, tl.nodesEndMs, tl.tailMs], [0, 0.34, 0.2, 0.13], CLAMP),
  );

  const lineEnd = useDerivedValue(() =>
    reducedMotion ? 1 : interpolate(elapsed.value, [tl.linesStartMs, tl.linesEndMs], [0, 1], CLAMP),
  );
  const lineOpacity = useDerivedValue(() =>
    interpolate(elapsed.value, [tl.linesStartMs, tl.linesStartMs + (reducedMotion ? 140 : 260)], [0, 0.9], CLAMP),
  );
  const particleP = useDerivedValue(() =>
    interpolate(elapsed.value, [tl.nodesStartMs, tl.tailMs], [0, 1], CLAMP),
  );

  const accent = reveal.accentNodes;
  const stagger = (tl.nodesEndMs - tl.nodesStartMs) / Math.max(1, reveal.nodes.length);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Holographic ghost of the solved picture. */}
      <Group opacity={ghostOpacity}>
        {state.pixels.map((p) => {
          const c = cellCenter(geo, p.x, p.y);
          const s = Math.max(2, geo.cell - 2);
          return (
            <RoundedRect
              key={p.id}
              x={c.x - s / 2}
              y={c.y - s / 2}
              width={s}
              height={s}
              r={Math.max(1, geo.cell * 0.18)}
              color={orbColors[p.color]}
            />
          );
        })}
      </Group>

      {/* Constellation lines drawing between the nodes. */}
      <Group opacity={lineOpacity}>
        <Blur blur={0.7} />
        <Path
          path={linesPath}
          style="stroke"
          strokeWidth={Math.max(1.4, geo.cell * 0.12)}
          strokeCap="round"
          strokeJoin="round"
          color={arcade.accent}
          start={0}
          end={lineEnd}
        />
      </Group>

      {/* Nodes. */}
      {nodePts.map((pt, i) => (
        <RevealNodeMark
          key={i}
          pt={pt}
          radius={geo.cell * (accent.includes(i) ? 0.42 : 0.3)}
          rise={reducedMotion ? 0 : geo.cell * 0.5}
          accent={accent.includes(i)}
          startMs={tl.nodesStartMs + i * stagger * 0.6}
          durMs={reducedMotion ? 120 : 300}
          elapsed={elapsed}
        />
      ))}

      {/* Restrained sparkle drift. */}
      {particles.map((pa, i) => (
        <RevealParticle key={i} p={pa} progress={particleP} />
      ))}
    </Canvas>
  );
});

function RevealNodeMark({ pt, radius, rise, accent, startMs, durMs, elapsed }: {
  pt: { x: number; y: number };
  radius: number;
  rise: number;
  accent: boolean;
  startMs: number;
  durMs: number;
  elapsed: SharedValue<number>;
}) {
  const t = useDerivedValue(() => interpolate(elapsed.value, [startMs, startMs + durMs], [0, 1], CLAMP));
  const cy = useDerivedValue(() => pt.y + (1 - t.value) * rise);
  const opacity = useDerivedValue(() => t.value);
  const haloR = useDerivedValue(() => radius * (1.8 + (1 - t.value) * 1.5));
  return (
    <Group opacity={opacity}>
      <Group opacity={0.35}>
        <Blur blur={2} />
        <Circle cx={pt.x} cy={cy} r={haloR} color={accent ? arcade.warn : arcade.accent} />
      </Group>
      <Circle cx={pt.x} cy={cy} r={radius} color={accent ? '#FFFFFF' : arcade.accent} />
      <Circle cx={pt.x} cy={cy} r={radius} color={accent ? arcade.warn : '#FFFFFF'} style="stroke" strokeWidth={1} opacity={0.7} />
    </Group>
  );
}

function RevealParticle({ p, progress }: {
  p: { x: number; y: number; dx: number; dy: number; delay: number };
  progress: SharedValue<number>;
}) {
  const local = useDerivedValue(() => Math.max(0, Math.min(1, (progress.value - p.delay) / (1 - p.delay))));
  const cx = useDerivedValue(() => p.x + p.dx * local.value);
  const cy = useDerivedValue(() => p.y + p.dy * local.value);
  const opacity = useDerivedValue(() => (1 - local.value) * 0.4);
  return <Circle cx={cx} cy={cy} r={1.4} color={arcade.starNear} opacity={opacity} />;
}
