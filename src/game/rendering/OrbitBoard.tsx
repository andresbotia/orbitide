import { Canvas, Group, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { cancelAnimation, Easing, runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';

import { reachablePixels } from '@/game/engine/pixels';
import type { GameState } from '@/game/engine/types';
import type { FlightPass } from '@/game/presentation/events';
import { eventCountAt } from '@/game/presentation/motion';
import { arcade } from '@/theme/arcade';
import { EnergyShot } from './EnergyShot';
import { Starfield } from './effects/Starfield';
import { cellCenter, computeBoardGeometry, type BoardGeometry } from './boardGeometry';
import { OrbitingCharge } from './OrbitingCharge';
import { OrbitRail, LaunchHubMarker } from './OrbitRail';
import { Pixel } from './Pixel';

interface OrbitBoardProps {
  size: number;
  state: GameState;
  flightPass: FlightPass | null;
  presentThrough: (passId: number, count: number) => void;
  /** Color Assist readiness hook — not wired to settings yet. */
  colorAssist?: boolean;
}

/**
 * The production Cosmic Arcade board. The Skia layer paints the static
 * machinery (environment, starfield, orbit rail, launch-hub seat). The actor
 * layer paints everything that moves per pass (pixels, active charge, projectile)
 * off one shared UI-thread clock and remounts per pass for clean state.
 */
export function OrbitBoard({ size, state, flightPass: pass, presentThrough, colorAssist }: OrbitBoardProps) {
  const geo = useMemo(
    () => computeBoardGeometry(size, state.width, state.height),
    [size, state.width, state.height],
  );

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
        key={pass?.passId ?? 'idle'}
        state={state}
        pass={pass}
        geo={geo}
        presentThrough={presentThrough}
        colorAssist={colorAssist}
      />
    </View>
  );
}

function BoardActors({ state, pass, geo, presentThrough, colorAssist }: {
  state: GameState;
  pass: FlightPass | null;
  geo: BoardGeometry;
  presentThrough: (passId: number, count: number) => void;
  colorAssist?: boolean;
}) {
  const reachable = useMemo(() => new Set(reachablePixels(state).map((p) => p.id)), [state]);
  const clock = useSharedValue(0);
  const shotById = useMemo(() => new Map(pass?.shots.map((s) => [s.pixelId, s]) ?? []), [pass]);

  useEffect(() => {
    clock.set(0);
    if (!pass) return;
    clock.set(withTiming(pass.totalMs, { duration: pass.totalMs, easing: Easing.linear }));
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') cancelAnimation(clock);
    });
    return () => { cancelAnimation(clock); sub.remove(); };
  }, [pass, clock]);

  useAnimatedReaction(
    () => (pass ? eventCountAt(pass, clock.value) : 0),
    (count, previous) => {
      if (pass && count > 0 && count !== previous) runOnJS(presentThrough)(pass.passId, count);
    },
    [pass, presentThrough],
  );

  return (
    <>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {state.pixels.map((p) => {
          const shot = shotById.get(p.id);
          if (p.cleared && !shot) return null;
          const c = cellCenter(geo, p.x, p.y);
          return (
            <Pixel
              key={p.id}
              color={p.color}
              cx={c.x}
              cy={c.y}
              cell={geo.cell}
              adaptive={geo.adaptive}
              assist={colorAssist}
              reachable={reachable.has(p.id) || (!!shot && p.cleared)}
              clock={clock}
              clearAt={shot?.clearAt}
            />
          );
        })}
      </View>
      {pass ? (
        <>
          <EnergyShot pass={pass} layout={geo} clock={clock} />
          <OrbitingCharge pass={pass} layout={geo} clock={clock} />
        </>
      ) : null}
    </>
  );
}
