import { Canvas, Group, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { memo, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import type { GameState, ModifierInstance } from '@/game/engine/types';
import type { FlightPass } from '@/game/presentation/events';
import { eventCountAt, presentationEndMs } from '@/game/presentation/motion';
import { material } from '@/theme/material';
import { BoardActors } from './BoardActors';
import { EnergyShot } from './EnergyShot';
import { cellCenter, computeBoardGeometry, type BoardGeometry } from './boardGeometry';
import { assignLaneSlots, laneOffset } from './laneAssignment';
import { RejectPulse } from './RejectPulse';
import { usePassClock, usePresentationClock, type PresentationClock } from './usePresentationClock';
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
  /** Completed toHolding Pals still drawn at their slot for the Holding handoff. */
  landingFlights?: FlightPass[];
  presentThrough: (passId: number, count: number) => void;
  colorAssist?: boolean;
  reducedMotion?: boolean;
  modifiers?: Record<string, ModifierInstance>;
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
export const OrbitBoard = memo(function OrbitBoard({ size, state, flights, landingFlights, presentThrough, colorAssist, reducedMotion, modifiers }: OrbitBoardProps) {
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

  // One keyed list, so a Pal moving from the rail into its Holding handoff
  // keeps its actor (and its UI clock) instead of remounting. Lanes are fixed
  // per Pal at launch, never re-derived from list position.
  const actors = useMemo(
    () => (landingFlights?.length ? [...flights, ...landingFlights] : flights),
    [flights, landingFlights],
  );
  const laneSlots = useRef<ReadonlyMap<number, number>>(new Map());
  const lanes = useMemo(() => {
    laneSlots.current = assignLaneSlots(laneSlots.current, actors.map((pass) => pass.passId));
    return laneSlots.current;
  }, [actors]);
  // One UI-thread time source for every Pal; runs only while a Pal is shown.
  const boardClock = usePresentationClock(actors.length > 0);

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

      {actors.map((pass) => (
        <FlightActor
          key={pass.passId}
          pass={pass}
          boardClock={boardClock}
          geo={geo}
          presentThrough={presentThrough}
          colorAssist={!!colorAssist}
          laneOffset={laneOffset(lanes.get(pass.passId) ?? 0, LANE_OFFSET_PX)}
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
const FlightActor = memo(function FlightActor({ pass, boardClock, geo, presentThrough, colorAssist, laneOffset: lane, calm }: {
  pass: FlightPass;
  boardClock: PresentationClock;
  geo: BoardGeometry;
  presentThrough: (passId: number, count: number) => void;
  colorAssist: boolean;
  laneOffset: number;
  calm: boolean;
}) {
  // Pass time from the board's shared clock. A join that re-scripts this pass
  // changes what it does next, never where its time is — nothing re-anchors.
  // A toHolding Pal's time runs on through the Holding handoff.
  const endMs = presentationEndMs(pass);
  const clock = usePassClock(boardClock, pass.launchedAtMs, endMs);

  // Commits engine events at their scheduled beats; at the end of its time the
  // pass presents everything (the event list may have grown since launch).
  useAnimatedReaction(
    () => (clock.value >= endMs ? Number.MAX_SAFE_INTEGER : eventCountAt(pass, clock.value)),
    (count, previous) => {
      if (count > 0 && count !== previous) runOnJS(presentThrough)(pass.passId, count);
    },
    [pass, presentThrough, endMs],
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
      {pass.terminal.kind === 'reject' ? <RejectPulse clock={clock} at={pass.orbitEndAt} /> : null}
    </>
  );
});
