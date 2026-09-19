import { Blur, Canvas, Circle, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { GameState, LevelDefinition, Pixel } from '@/game/engine/types';
import { isCoreV2 } from '@/game/engine/ruleset';
import { resolveReveal, revealTimeline, type CelebrationTier, type ResolvedReveal } from '@/game/rendering/revealGeometry';
import { GP } from '@/theme/gameplayUi';
import { cellCenter, computeBoardGeometry } from './boardGeometry';
import { StaticPixelField } from './StaticPixelField';

interface DiscoveryRevealProps {
  size: number;
  width?: number;
  height?: number;
  level: LevelDefinition;
  /** Won state — pixels carry their original positions (all cleared). */
  state: GameState;
  /** Master reveal progress, 0..1 over `revealTimeline().tailMs`. */
  progress: SharedValue<number>;
  reducedMotion: boolean;
  tier: CelebrationTier;
}

const CLAMP = 'clamp' as const;
/** Bounded particle budget per tier — "largest count, still bounded" for the finale. */
const PARTICLE_COUNT: Record<CelebrationTier, number> = { normal: 8, capstone: 14, finale: 20 };
/** Restored art settles to this once the trace draws, so the trace reads over it. */
const ART_SETTLED_OPACITY = 0.85;
const EDGE_PULSE_MS = 620;
const EMPTY_IDS: ReadonlySet<string> = new Set();
const EMPTY_DIM: ReadonlyMap<string, number> = new Map();
const ALL_REACHABLE = () => true;

/**
 * The win moment (M5.8B), in the board's own coordinates:
 *
 *  1. **Artwork restored.** The finished picture — drawn by the same
 *     `StaticPixelField` the player just cleared, so it is literally their
 *     picture — wipes in bottom → top behind a gold scanline (a fade under
 *     reduced motion). The player gets it at full strength before any text.
 *  2. **Completion edge.** One gold board-edge pulse.
 *  3. **Restoration trace.** Authored (or deterministic-fallback) nodes rise
 *     and the cyan trace draws over the art, which settles slightly so the
 *     trace reads. Bounded gold/cyan pixel sparks drift out.
 *
 * One master progress value; per-node derived values only; the art itself is
 * one static Skia picture moved by two transforms. No JS per-frame work.
 */
export const DiscoveryReveal = memo(function DiscoveryReveal({
  size, width, height, level, state, progress, reducedMotion, tier,
}: DiscoveryRevealProps) {
  const canvasW = width ?? size;
  const canvasH = height ?? size;
  const geo = useMemo(() => computeBoardGeometry(
    Math.max(canvasW, canvasH),
    state.width,
    state.height,
    isCoreV2(state.ruleset)
      ? { roundedRect: true, box: { width: canvasW, height: canvasH } }
      : undefined,
  ), [canvasW, canvasH, state.width, state.height, state.ruleset]);
  const reveal = useMemo<ResolvedReveal>(() => resolveReveal(level), [level]);
  const tl = useMemo(() => revealTimeline(reducedMotion, tier), [reducedMotion, tier]);

  // The finished picture: every pixel standing, no modifier shells.
  const restored = useMemo<Pixel[]>(
    () => state.pixels.map((p) => ({ ...p, cleared: false, modifier: undefined })),
    // Positions/colours never change within a level; only identity matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.levelId],
  );

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
    return Array.from({ length: PARTICLE_COUNT[tier] }, (_, i) => {
      const anchor = nodePts[i % Math.max(1, nodePts.length)] ?? geo.center;
      const angle = rnd() * Math.PI * 2;
      return {
        x: anchor.x,
        y: anchor.y,
        dx: Math.cos(angle) * geo.cell * 1.6,
        dy: Math.sin(angle) * geo.cell * 1.6,
        delay: rnd() * 0.4,
        color: i % 3 === 0 ? GP.cyan : GP.gold,
      };
    });
  }, [reducedMotion, level.id, tier, nodePts, geo]);

  const elapsed = useDerivedValue(() => progress.value * tl.tailMs);
  const wipe = useDerivedValue(() => interpolate(elapsed.value, [0, tl.restoreMs], [0, 1], CLAMP));

  // Wipe = a clipping window sliding up while its content counter-slides, so
  // the art never moves — transforms only, no layout per frame.
  const clipStyle = useAnimatedStyle(() => {
    const settle = interpolate(elapsed.value, [tl.linesStartMs, tl.linesEndMs], [1, ART_SETTLED_OPACITY], CLAMP);
    if (reducedMotion) return { opacity: wipe.value * settle };
    return { opacity: settle, transform: [{ translateY: (1 - wipe.value) * canvasH }] };
  });
  const artStyle = useAnimatedStyle(() => (
    reducedMotion ? {} : { transform: [{ translateY: -(1 - wipe.value) * canvasH }] }
  ));
  const scanStyle = useAnimatedStyle(() => {
    const w = wipe.value;
    if (reducedMotion || w <= 0 || w >= 1) return { opacity: 0 };
    return { opacity: Math.min(1, (1 - w) * 4), transform: [{ translateY: (1 - w) * canvasH - 7 }] };
  });
  const edgeStyle = useAnimatedStyle(() => {
    const t = elapsed.value - tl.edgeMs;
    if (t < 0 || t > EDGE_PULSE_MS) return { opacity: 0 };
    const v = t < 120 ? t / 120 : 1 - (t - 120) / (EDGE_PULSE_MS - 120);
    return { opacity: v * 0.9 };
  });

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
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.clip, clipStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, artStyle]}>
          <StaticPixelField
            pixels={restored}
            geo={geo}
            hiddenIds={EMPTY_IDS}
            dimById={EMPTY_DIM}
            isReachable={ALL_REACHABLE}
            colorAssist={false}
          />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.scan, scanStyle]}>
        <View style={styles.scanGlow} />
        <View style={styles.scanLine} />
      </Animated.View>
      <Animated.View style={[styles.edge, edgeStyle]} />

      <Canvas style={StyleSheet.absoluteFill}>
        {/* Restoration trace — cyan energy drawn over the finished picture. */}
        <Group opacity={lineOpacity}>
          <Blur blur={0.7} />
          <Path
            path={linesPath}
            style="stroke"
            strokeWidth={Math.max(1.4, geo.cell * 0.12)}
            strokeCap="round"
            strokeJoin="round"
            color={GP.cyan}
            start={0}
            end={lineEnd}
          />
        </Group>

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

        {particles.map((pa, i) => (
          <RevealParticle key={i} p={pa} progress={particleP} />
        ))}
      </Canvas>
    </View>
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
        <Circle cx={pt.x} cy={cy} r={haloR} color={accent ? GP.gold : GP.cyan} />
      </Group>
      <Circle cx={pt.x} cy={cy} r={radius} color={accent ? '#FFFFFF' : GP.cyan} />
      <Circle cx={pt.x} cy={cy} r={radius} color={accent ? GP.gold : '#FFFFFF'} style="stroke" strokeWidth={1} opacity={0.7} />
    </Group>
  );
}

function RevealParticle({ p, progress }: {
  p: { x: number; y: number; dx: number; dy: number; delay: number; color: string };
  progress: SharedValue<number>;
}) {
  const local = useDerivedValue(() => Math.max(0, Math.min(1, (progress.value - p.delay) / (1 - p.delay))));
  const opacity = useDerivedValue(() => (1 - local.value) * 0.55);
  const x = useDerivedValue(() => p.x + p.dx * local.value - 1.6);
  const y = useDerivedValue(() => p.y + p.dy * local.value - 1.6);
  // A tiny pixel-block fragment — the Pixel Arcadia restoration spark.
  return <RoundedRect x={x} y={y} width={3.2} height={3.2} r={0.6} color={p.color} opacity={opacity} />;
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  scan: { position: 'absolute', left: 0, right: 0, top: 0, height: 14 },
  scanGlow: { position: 'absolute', left: 0, right: 0, top: 0, height: 14, backgroundColor: GP.gold, opacity: 0.16 },
  scanLine: { position: 'absolute', left: 0, right: 0, top: 6, height: 2, backgroundColor: GP.gold },
  edge: {
    position: 'absolute',
    top: -2, left: -2, right: -2, bottom: -2,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: GP.gold,
  },
});
