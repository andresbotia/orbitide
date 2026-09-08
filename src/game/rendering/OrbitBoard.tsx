import { Canvas, Circle, Group, Oval } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { cancelAnimation, Easing, runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';
import { reachablePixels } from '@/game/engine/pixels';
import type { GameState } from '@/game/engine/types';
import type { FlightPass } from '@/game/presentation/events';
import { eventCountAt } from '@/game/presentation/motion';
import { palette } from '@/theme/colors';
import { EnergyShot } from './EnergyShot';
import { Starfield } from './effects/Starfield';
import { cellCenter, computeBoardLayout, type BoardLayout } from './layout';
import { OrbitingCharge } from './OrbitingCharge';
import { Pixel } from './Pixel';
interface OrbitBoardProps {
  size: number; state: GameState; flightPass: FlightPass | null;
  presentThrough: (passId: number, count: number) => void;
}
export function OrbitBoard({ size, state, flightPass: pass, presentThrough }: OrbitBoardProps) {
  const layout = useMemo(() => computeBoardLayout(size, state.width, state.height), [size, state.width, state.height]);
  return <View style={{ width: size, height: size, overflow: 'visible' }}>
    <Canvas style={StyleSheet.absoluteFill}>
      <Starfield size={size} />
      <Group>{layout.orbit.map((o, i) => <Oval key={i} x={layout.center.x - o.rx} y={layout.center.y - o.ry}
        width={o.rx * 2} height={o.ry * 2} color={palette.ringGuide} style="stroke" strokeWidth={1} opacity={0.85 - i * 0.25} />)}</Group>
      <Circle cx={layout.insertion.x} cy={layout.insertion.y} r={layout.chargeRadius * 0.7}
        color={palette.coreGlow} style="stroke" strokeWidth={2} />
    </Canvas>
    <BoardActors key={pass?.passId ?? 'idle'} state={state} pass={pass} layout={layout} presentThrough={presentThrough} />
  </View>;
}
function BoardActors({ state, pass, layout, presentThrough }: {
  state: GameState; pass: FlightPass | null; layout: BoardLayout;
  presentThrough: (passId: number, count: number) => void;
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
  useAnimatedReaction(() => pass ? eventCountAt(pass, clock.value) : 0,
    (count, previous) => {
      if (pass && count > 0 && count !== previous) runOnJS(presentThrough)(pass.passId, count);
    }, [pass, presentThrough]);
  return <>
    <View style={StyleSheet.absoluteFill} pointerEvents="none">{state.pixels.map((p) => {
      const shot = shotById.get(p.id);
      if (p.cleared && !shot) return null;
      const c = cellCenter(layout, p.x, p.y);
      return <Pixel key={p.id} color={p.color} cx={c.x} cy={c.y} cell={layout.cell}
        reachable={reachable.has(p.id) || !!shot && p.cleared} clock={clock} clearAt={shot?.clearAt} />;
    })}</View>
    {pass ? <>
      <EnergyShot pass={pass} layout={layout} clock={clock} />
      <OrbitingCharge pass={pass} layout={layout} clock={clock} />
    </> : null}
  </>;
}
