import { Canvas, Group, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
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

interface OrbitBoardProps {
  size: number;
  state: GameState;
  flightPass: FlightPass | null;
  presentThrough: (passId: number, count: number) => void;
  /** Color Assist preference — off by default. */
  colorAssist?: boolean;
  reducedMotion?: boolean;
  /**
   * Presentation modifiers keyed by pixel id. Empty today; a future
   * `useGameSession` populates it from engine state so the material renderer
   * needs no redesign.
   */
  modifiers?: Record<string, ModifierInstance>;
}

/**
 * The production Cosmic Arcade board. The Skia layer paints the static
 * machinery; the actor layer paints per-pass motion (pixels, special-pixel
 * shells, Color Assist marks, projectile, charge) off one shared UI-thread
 * clock and remounts per pass for clean state.
 */
export function OrbitBoard({ size, state, flightPass: pass, presentThrough, colorAssist, reducedMotion, modifiers }: OrbitBoardProps) {
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
        colorAssist={!!colorAssist}
        reducedMotion={!!reducedMotion}
        modifiers={modifiers ?? EMPTY}
      />
    </View>
  );
}

const EMPTY: Record<string, ModifierInstance> = {};

function BoardActors({ state, pass, geo, presentThrough, colorAssist, reducedMotion, modifiers }: {
  state: GameState;
  pass: FlightPass | null;
  geo: BoardGeometry;
  presentThrough: (passId: number, count: number) => void;
  colorAssist: boolean;
  reducedMotion: boolean;
  modifiers: Record<string, ModifierInstance>;
}) {
  const reachable = useMemo(() => new Set(reachablePixels(state).map((p) => p.id)), [state]);
  const clock = useSharedValue(0);
  const shotById = useMemo(() => new Map(pass?.shots.map((s) => [s.pixelId, s]) ?? []), [pass]);

  const specials = useMemo<SpecialPixelInput[]>(() => {
    const list: SpecialPixelInput[] = [];
    for (const p of state.pixels) {
      const modifier = modifiers[p.id];
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
              modifierDim={dimById.get(p.id) ?? 0}
              reachable={reachable.has(p.id) || (!!shot && p.cleared)}
              clock={clock}
              clearAt={shot?.clearAt}
            />
          );
        })}
      </View>

      <SpecialPixelLayer geo={geo} specials={specials} reducedMotion={reducedMotion} />
      <ColorAssistLayer state={state} geo={geo} enabled={colorAssist} />

      {pass ? (
        <>
          <EnergyShot pass={pass} layout={geo} clock={clock} />
          <OrbitingCharge pass={pass} layout={geo} clock={clock} colorAssist={colorAssist} />
        </>
      ) : null}
    </>
  );
}
