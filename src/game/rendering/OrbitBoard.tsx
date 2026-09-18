import { Canvas, Group, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { cancelAnimation, Easing, runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';

import type { GameState, ModifierInstance } from '@/game/engine/types';
import type { FlightPass } from '@/game/presentation/events';
import { eventCountAt } from '@/game/presentation/motion';
import { material } from '@/theme/material';
import { BoardActors } from './BoardActors';
import { EnergyShot } from './EnergyShot';
import { cellCenter, computeBoardGeometry, type BoardGeometry } from './boardGeometry';
import { OrbitingCharge } from './OrbitingCharge';
import { OrbitRail, LaunchHubMarker } from './OrbitRail';
import { Pixel } from './Pixel';

/** TUNABLE — presentation-only radial lane spacing so crowded charges stay legible. */
const LANE_OFFSET_PX = 2;
/** Calm the trails/halos once this many charges share the rail. */
const CALM_TRAILS_AT = 3;

interface OrbitBoardProps {
  size: number;
  state: GameState;
  /** Every charge currently on the rail. */
  flights: FlightPass[];
  presentThrough: (passId: number, count: number) => void;
  colorAssist?: boolean;
  reducedMotion?: boolean;
  modifiers?: Record<string, ModifierInstance>;
}

/** Symmetric lane nudge by launch order: … −2, 0, +2, −2, 0 … */
function laneOffset(index: number): number {
  const step = Math.ceil(index / 2);
  return (index % 2 === 0 ? -step : step) * LANE_OFFSET_PX;
}

/**
 * The production Pixel Arcadia board (UI-R3 — Cosmic Arcade materials
 * removed from the default paint; concurrency architecture below is
 * unchanged). The Skia layer paints the static machinery; one static actor
 * layer paints the pixels / special shells / Color Assist marks; and each
 * in-flight charge gets its own {@link FlightActor} with its own UI-thread
 * clock, so up to five charges animate independently off one shared board
 * without a singleton anywhere.
 */
export const OrbitBoard = memo(function OrbitBoard({ size, state, flights, presentThrough, colorAssist, reducedMotion, modifiers }: OrbitBoardProps) {
  const geo = useMemo(
    () => computeBoardGeometry(size, state.width, state.height),
    [size, state.width, state.height],
  );

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
    <View style={{ width: size, height: size, overflow: 'visible' }}>
      <OrbitField geo={geo} size={size} />

      <BoardActors
        state={state}
        geo={geo}
        colorAssist={!!colorAssist}
        reducedMotion={!!reducedMotion}
        modifiers={modifiers}
        shotPixelIds={shotPixelIds}
      />

      {flights.map((pass, i) => (
        <FlightActor
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
const OrbitField = memo(function OrbitField({ geo, size }: { geo: BoardGeometry; size: number }) {
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={size} height={size}>
        <RadialGradient
          c={vec(geo.center.x, geo.center.y)}
          r={size * 0.66}
          colors={[material.structuralSurface, material.recessedSurface]}
        />
      </Rect>
      <Group>
        <OrbitRail geo={geo} />
        <LaunchHubMarker geo={geo} />
      </Group>
    </Canvas>
  );
});

/**
 * One in-flight charge: its own linear UI-thread clock (0 → totalMs), the
 * animated-reaction bridge that commits engine events at their scheduled beats,
 * the pop of the pixels it clears, its projectile streak and its orbiting token.
 */
const FlightActor = memo(function FlightActor({ pass, geo, presentThrough, colorAssist, laneOffset: lane, calm }: {
  pass: FlightPass;
  geo: BoardGeometry;
  presentThrough: (passId: number, count: number) => void;
  colorAssist: boolean;
  laneOffset: number;
  calm: boolean;
}) {
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.set(0);
    clock.set(
      withTiming(pass.totalMs, { duration: pass.totalMs, easing: Easing.linear }, (finished) => {
        if (finished) runOnJS(presentThrough)(pass.passId, pass.events.length);
      }),
    );
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') cancelAnimation(clock);
    });
    return () => { cancelAnimation(clock); sub.remove(); };
  }, [pass.passId, pass.totalMs, pass.events.length, clock, presentThrough]);

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
      <OrbitingCharge pass={pass} layout={geo} clock={clock} colorAssist={colorAssist} laneOffset={lane} dim={calm} />
    </>
  );
});
