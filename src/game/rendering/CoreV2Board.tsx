import { Canvas, Group, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { cancelAnimation, Easing, runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';

import type { GameState, ModifierInstance } from '@/game/engine/types';
import type { FlightPass } from '@/game/presentation/events';
import { eventCountAt } from '@/game/presentation/motion';
import { coreV2Board } from '@/theme/coreV2Board';
import { BoardActors } from './BoardActors';
import { EnergyShot } from './EnergyShot';
import { cellCenter, computeBoardGeometry, type BoardGeometry } from './boardGeometry';
import { RoundedLauncherGate, RoundedRail } from './RoundedRail';
import { Pixel } from './Pixel';
import { PixelPal } from './pixelPal/PixelPal';

/** TUNABLE — presentation-only radial lane spacing so crowded Pixel Pals stay legible. */
const LANE_OFFSET_PX = 3;
/** Calm the halos once this many Pixel Pals share the rail. */
const CALM_TRAILS_AT = 3;

interface CoreV2BoardProps {
  size: number;
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
export function CoreV2Board({ size, state, flights, presentThrough, colorAssist, reducedMotion, modifiers }: CoreV2BoardProps) {
  const geo = useMemo(
    () => computeBoardGeometry(size, state.width, state.height, { roundedRect: true }),
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
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Brighter navy/indigo field (spec §13) — a richer, more luminous
            base than Legacy V1's darker circular-rail plane. */}
        <Rect x={0} y={0} width={size} height={size}>
          <RadialGradient
            c={vec(geo.center.x, geo.center.y)}
            r={size * 0.7}
            colors={[coreV2Board.fieldCenter, coreV2Board.fieldEdge]}
          />
        </Rect>
        <Group>
          <RoundedRail geo={geo} />
          <RoundedLauncherGate geo={geo} />
        </Group>
      </Canvas>

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
}

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
    clock.set(0);
    clock.set(withTiming(pass.totalMs, { duration: pass.totalMs, easing: Easing.linear }));
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') cancelAnimation(clock);
    });
    return () => { cancelAnimation(clock); sub.remove(); };
  }, [pass, clock]);

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
    </>
  );
});
