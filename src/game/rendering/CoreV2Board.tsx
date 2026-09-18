import { Canvas, Group, LinearGradient, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { GameState, ModifierInstance } from '@/game/engine/types';
import type { FlightPass } from '@/game/presentation/events';
import { eventCountAt } from '@/game/presentation/motion';
import { coreV2Board } from '@/theme/coreV2Board';
import { NEON } from '@/theme/neon';
import { BoardActors } from './BoardActors';
import { EnergyShot } from './EnergyShot';
import { cellCenter, computeBoardGeometry, type BoardGeometry } from './boardGeometry';
import { RoundedLauncherGate, RoundedRail } from './RoundedRail';
import { Pixel } from './Pixel';
import { PixelPal } from './pixelPal/PixelPal';

/** TUNABLE — how long the one-shot winning-clear flash takes to fade out. */
const FINAL_FLASH_MS = 220;
/** TUNABLE — peak opacity of the winning-clear flash. Subtle, not a bloom. */
const FINAL_FLASH_PEAK_OPACITY = 0.32;

/** TUNABLE — presentation-only radial lane spacing so crowded Pixel Pals stay legible. */
const LANE_OFFSET_PX = 3;
/** Soften shot streaks once this many Pixel Pals share the rail. */
const CALM_TRAILS_AT = 3;

interface CoreV2BoardProps {
  size: number;
  /** Fitted canvas. Falls back to a `size × size` square. */
  width?: number;
  height?: number;
  state: GameState;
  /** Every charge currently on the rail. */
  flights: FlightPass[];
  presentThrough: (passId: number, count: number) => void;
  colorAssist?: boolean;
  reducedMotion?: boolean;
  modifiers?: Record<string, ModifierInstance>;
}

/** Symmetric lane nudge by launch order: … −3, 0, +3, −3, 0 … */
function laneOffset(index: number): number {
  const step = Math.ceil(index / 2);
  return (index % 2 === 0 ? -step : step) * LANE_OFFSET_PX;
}

/**
 * M5.3 — the Core V2 gameplay board: a rounded-rectangle perimeter carrying
 * Pixel Pal creatures, replacing Legacy V1's circular `OrbitBoard` rail for
 * `coreV2`-ruleset levels only (spec §1/§18). Structurally a sibling of
 * `OrbitBoard`, not a rewrite of it — the pixel-art actor layer
 * (`BoardActors`) and the projectile (`EnergyShot`) are shared verbatim,
 * since neither depends on the rail's shape; only the rail paint and the
 * traveling character are new.
 */
export const CoreV2Board = memo(function CoreV2Board({ size, width, height, state, flights, presentThrough, colorAssist, reducedMotion, modifiers }: CoreV2BoardProps) {
  const availW = width ?? size;
  const availH = height ?? size;
  const geo = useMemo(
    () => computeBoardGeometry(Math.max(availW, availH), state.width, state.height, {
      roundedRect: true,
      box: { width: availW, height: availH },
    }),
    [availW, availH, state.width, state.height],
  );
  const canvasW = geo.width;
  const canvasH = geo.height;

  const shotPixelIds = useMemo(
    // A Frozen crack leaves the pixel on the board, so the static layer keeps
    // drawing it (with its shell) — only real clears are handed to the flight.
    () => new Set(flights.flatMap((f) => f.shots.flatMap((s) => {
      if (s.frozenBreak || s.shieldBreak || s.linkedPrime) return [];
      return s.linkedClearedPixelIds ?? [s.pixelId];
    }))),
    [flights],
  );
  const calm = flights.length >= CALM_TRAILS_AT;

  return (
    <View style={{ width: canvasW, height: canvasH, overflow: 'visible' }}>
      <CoreV2Field geo={geo} width={canvasW} height={canvasH} />

      <BoardActors
        state={state}
        geo={geo}
        colorAssist={!!colorAssist}
        reducedMotion={!!reducedMotion}
        modifiers={modifiers}
        shotPixelIds={shotPixelIds}
      />

      {flights.map((pass, i) => (
        <CoreV2FlightActor
          key={pass.passId}
          pass={pass}
          geo={geo}
          presentThrough={presentThrough}
          colorAssist={!!colorAssist}
          laneOffset={laneOffset(i)}
          calm={calm}
        />
      ))}
    </View>
  );
});

/** Static Skia field + rail. Memoised so pixel-clear React updates don't redraw it. */
const CoreV2Field = memo(function CoreV2Field({ geo, width, height }: { geo: BoardGeometry; width: number; height: number }) {
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={[coreV2Board.fieldCenter, coreV2Board.fieldEdge]}
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={height} opacity={0.22}>
        <RadialGradient
          c={vec(width * 0.5, height * 0.42)}
          r={Math.min(width, height) * 0.62}
          colors={['#00407A', 'rgba(0,0,0,0)']}
        />
      </Rect>
      <Group>
        <RoundedRail geo={geo} />
        <RoundedLauncherGate geo={geo} />
      </Group>
    </Canvas>
  );
});

/**
 * One in-flight Pixel Pal: its own linear UI-thread clock, the
 * animated-reaction bridge that commits engine events at their scheduled
 * beats, the pop of the pixels it clears, its projectile streak and its
 * traveling creature. Structurally identical to `OrbitBoard`'s
 * `FlightActor` — only the traveling-character component differs.
 */
const CoreV2FlightActor = memo(function CoreV2FlightActor({ pass, geo, presentThrough, colorAssist, laneOffset: lane, calm }: {
  pass: FlightPass;
  geo: BoardGeometry;
  presentThrough: (passId: number, count: number) => void;
  colorAssist: boolean;
  laneOffset: number;
  calm: boolean;
}) {
  const clock = useSharedValue(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') cancelAnimation(clock);
    });
    return () => { cancelAnimation(clock); sub.remove(); };
  }, [pass.passId, clock]);

  // Anchored to the pass's launch time: when a join re-scripts this pass's
  // unplayed tail (new totalMs), the clock carries on instead of restarting.
  const { passId, totalMs, launchedAtMs } = pass;
  useEffect(() => {
    const elapsed = Math.min(totalMs, Math.max(0, Date.now() - launchedAtMs));
    clock.set(elapsed);
    clock.set(
      withTiming(totalMs, { duration: totalMs - elapsed, easing: Easing.linear }, (finished) => {
        // Present everything: the event list may have grown since this started.
        if (finished) runOnJS(presentThrough)(passId, Number.MAX_SAFE_INTEGER);
      }),
    );
  }, [passId, totalMs, launchedAtMs, clock, presentThrough]);

  useAnimatedReaction(
    () => eventCountAt(pass, clock.value),
    (count, previous) => {
      if (count > 0 && count !== previous) runOnJS(presentThrough)(pass.passId, count);
    },
    [pass, presentThrough],
  );

  return (
    <>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {pass.shots.filter((shot) => !shot.frozenBreak && !shot.shieldBreak && !shot.linkedPrime)
          .flatMap((shot, i) => (shot.linkedClearTargets ?? [{
            pixelId: shot.pixelId, x: shot.target.x, y: shot.target.y, color: pass.charge.color,
          }]).map((target) => {
            const c = cellCenter(geo, target.x, target.y);
            return (
              <Pixel
                key={`${pass.passId}-${target.pixelId}-${i}`}
                color={target.color}
                cx={c.x}
                cy={c.y}
                cell={geo.cell}
                adaptive={geo.adaptive}
                reachable
                clock={clock}
                clearAt={shot.clearAt}
              />
            );
          }))}
      </View>
      <EnergyShot pass={pass} layout={geo} clock={clock} laneOffset={lane} calm={calm} />
      <PixelPal layout={geo} pass={pass} clock={clock} colorAssist={colorAssist} laneOffset={lane} dim={calm} />
      {pass.finalClearPixelId ? (
        <FinalClearFlash
          clock={clock}
          at={pass.shots.find((s) => s.pixelId === pass.finalClearPixelId)?.clearAt ?? pass.orbitEndAt}
        />
      ) : null}
    </>
  );
});

/**
 * One-shot warm flash across the board the instant the winning pixel clears —
 * the only visual cue (besides the existing `finalClear` haptic) that this
 * specific clear finished the level, before the Discovery reveal takes over.
 * Reuses the flight's own clock; no new shared value, no persistent loop.
 */
const FinalClearFlash = memo(function FinalClearFlash({ clock, at }: { clock: SharedValue<number>; at: number }) {
  const style = useAnimatedStyle(() => {
    const t = clock.value - at;
    if (t < 0 || t > FINAL_FLASH_MS) return { opacity: 0 };
    return { opacity: (1 - t / FINAL_FLASH_MS) * FINAL_FLASH_PEAK_OPACITY };
  });
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.finalFlash, style]} />;
});

const styles = StyleSheet.create({
  finalFlash: { backgroundColor: NEON.gold },
});
