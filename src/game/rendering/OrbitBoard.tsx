import { Canvas, Group, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { cancelAnimation, Easing, runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';

import { reachablePixels } from '@/game/engine/pixels';
import type { GameState, ModifierInstance } from '@/game/engine/types';
import type { FlightPass } from '@/game/presentation/events';
import { eventCountAt } from '@/game/presentation/motion';
import { arcade } from '@/theme/arcade';
import { ColorAssistLayer } from './ColorAssistLayer';
import { EnergyShot } from './EnergyShot';
import { Starfield } from './effects/Starfield';
import { cellCenter, computeBoardGeometry, type BoardGeometry } from './boardGeometry';
import { OrbitingCharge } from './OrbitingCharge';
import { OrbitRail, LaunchHubMarker } from './OrbitRail';
import { Pixel } from './Pixel';
import { SpecialPixelLayer, type SpecialPixelInput } from './SpecialPixelLayer';
import { resolveModifier } from './specialPixels';

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
 * The production Cosmic Arcade board. The Skia layer paints the static
 * machinery; one static actor layer paints the pixels / special shells / Color
 * Assist marks; and each in-flight charge gets its own {@link FlightActor} with
 * its own UI-thread clock, so up to five charges animate independently off one
 * shared board without a singleton anywhere.
 */
export function OrbitBoard({ size, state, flights, presentThrough, colorAssist, reducedMotion, modifiers }: OrbitBoardProps) {
  const geo = useMemo(
    () => computeBoardGeometry(size, state.width, state.height),
    [size, state.width, state.height],
  );

  const shotPixelIds = useMemo(
    // A Frozen crack leaves the pixel on the board, so the static layer keeps
    // drawing it (with its shell) — only real clears are handed to the flight.
    () => new Set(flights.flatMap((f) => f.shots.filter((s) => !s.frozenBreak && !s.shieldBreak).map((s) => s.pixelId))),
    [flights],
  );
  const calm = flights.length >= CALM_TRAILS_AT;

  return (
    <View style={{ width: size, height: size, overflow: 'visible' }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={size} height={size}>
          <RadialGradient
            c={vec(geo.center.x, geo.center.y)}
            r={size * 0.66}
            colors={[arcade.envMid, arcade.envBottom]}
          />
        </Rect>
        <Starfield size={size} />
        <Group>
          <OrbitRail geo={geo} />
          <LaunchHubMarker geo={geo} />
        </Group>
      </Canvas>

      <BoardActors
        state={state}
        geo={geo}
        colorAssist={!!colorAssist}
        reducedMotion={!!reducedMotion}
        modifiers={modifiers ?? EMPTY}
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
}

const EMPTY: Record<string, ModifierInstance> = {};

const BoardActors = memo(function BoardActors({ state, geo, colorAssist, reducedMotion, modifiers, shotPixelIds }: {
  state: GameState;
  geo: BoardGeometry;
  colorAssist: boolean;
  reducedMotion: boolean;
  modifiers: Record<string, ModifierInstance>;
  /** Pixels an active flight will pop — rendered by that flight, not here. */
  shotPixelIds: Set<string>;
}) {
  const reachable = useMemo(() => new Set(reachablePixels(state).map((p) => p.id)), [state]);
  const idle = useSharedValue(0);

  const specials = useMemo<SpecialPixelInput[]>(() => {
    const list: SpecialPixelInput[] = [];
    for (const p of state.pixels) {
      // Engine truth first (Frozen updates `p.modifier` as ice cracks); the prop
      // is only a fallback for callers that drive modifiers externally.
      const modifier = p.modifier ?? modifiers[p.id];
      if (!p.cleared && modifier) list.push({ id: p.id, x: p.x, y: p.y, color: p.color, modifier });
    }
    return list;
  }, [state.pixels, modifiers]);

  const dimById = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of specials) {
      const r = resolveModifier(s.modifier, geo.density);
      const dim = Math.max(r.desaturate, r.concealment);
      if (dim > 0) map.set(s.id, dim);
    }
    return map;
  }, [specials, geo.density]);

  return (
    <>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {state.pixels.map((p) => {
          if (p.cleared || shotPixelIds.has(p.id)) return null;
          const c = cellCenter(geo, p.x, p.y);
          return (
            <Pixel
              key={p.id}
              color={p.color}
              cx={c.x}
              cy={c.y}
              cell={geo.cell}
              adaptive={geo.adaptive}
              modifierDim={dimById.get(p.id) ?? 0}
              reachable={reachable.has(p.id)}
              clock={idle}
            />
          );
        })}
      </View>

      <SpecialPixelLayer geo={geo} specials={specials} reducedMotion={reducedMotion} />
      <ColorAssistLayer state={state} geo={geo} enabled={colorAssist} />
    </>
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
        {pass.shots.filter((shot) => !shot.frozenBreak && !shot.shieldBreak).map((shot, i) => {
          const c = cellCenter(geo, shot.target.x, shot.target.y);
          return (
            <Pixel
              key={`${pass.passId}-${shot.pixelId}-${i}`}
              color={pass.charge.color}
              cx={c.x}
              cy={c.y}
              cell={geo.cell}
              adaptive={geo.adaptive}
              reachable
              clock={clock}
              clearAt={shot.clearAt}
            />
          );
        })}
      </View>
      <EnergyShot pass={pass} layout={geo} clock={clock} laneOffset={lane} />
      <OrbitingCharge pass={pass} layout={geo} clock={clock} colorAssist={colorAssist} laneOffset={lane} dim={calm} />
    </>
  );
});
