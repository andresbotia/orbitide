import {
  Canvas,
  Circle,
  Group,
  Oval,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import {
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { reachablePixels } from '@/game/engine/pixels';
import type { GameState } from '@/game/engine/types';
import type { EnergyShot as EnergyShotSpec, FlightPass } from '@/game/presentation/events';
import { orbColors, palette } from '@/theme/colors';

import { EnergyShot } from './EnergyShot';
import { Starfield } from './effects/Starfield';
import { cellCenter, computeBoardLayout } from './layout';
import { OrbitingCharge } from './OrbitingCharge';
import { Pixel } from './Pixel';
import { PixelBurst, type BurstSpec } from './PixelBurst';

const MAX_BURSTS = 22;

interface OrbitBoardProps {
  size: number;
  /** The *presented* state — lags engine truth while a launch is staged. */
  state: GameState;
  /** Bumped when the centre should pulse. */
  pulseSignal: number;
  pulseColor: string;
  /** Bumped once per charge pass. */
  flightSignal: number;
  flightPass: FlightPass | null;
  /** Live capacity to show on the flying charge, or null when none is flying. */
  flyingCapacity: number | null;
  shots: EnergyShotSpec[];
}

export function OrbitBoard({
  size,
  state,
  pulseSignal,
  pulseColor,
  flightSignal,
  flightPass,
  flyingCapacity,
  shots,
}: OrbitBoardProps) {
  const [active, setActive] = useState(AppState.currentState === 'active');
  const layout = useMemo(
    () => computeBoardLayout(size, state.width, state.height),
    [size, state.width, state.height],
  );

  const reachableIds = useMemo(
    () => new Set(reachablePixels(state).map((p) => p.id)),
    [state],
  );

  // Stable per-cell centres — only change on resize / picture size.
  const centreOf = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const p of state.pixels) {
      map.set(p.id, cellCenter(layout, p.x, p.y));
    }
    return map;
  }, [layout, state.pixels]);

  // Spawn a small burst wherever a pixel just became cleared in the presented
  // state (one per pixel pop). Capped list, dropped after they expire.
  const clearedRef = useRef<Set<string>>(new Set());
  const [bursts, setBursts] = useState<BurstSpec[]>([]);
  useEffect(() => {
    const prev = clearedRef.current;
    const now = new Set<string>();
    const fresh: BurstSpec[] = [];
    for (const p of state.pixels) {
      if (!p.cleared) continue;
      now.add(p.id);
      if (!prev.has(p.id)) {
        fresh.push({
          key: `${p.id}-${Date.now()}`,
          point: centreOf.get(p.id) ?? cellCenter(layout, p.x, p.y),
          color: p.color,
          cell: layout.cell,
        });
      }
    }
    clearedRef.current = now;
    if (!active || fresh.length === 0) return;
    const raf = requestAnimationFrame(() => {
      setBursts((cur) => [...cur, ...fresh].slice(-MAX_BURSTS));
    });
    const timer = setTimeout(() => {
      setBursts((cur) => cur.filter((b) => !fresh.some((f) => f.key === b.key)));
    }, 300);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [state, layout, centreOf, active]);

  const pulse = useSharedValue(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      setActive(next === 'active');
      if (next !== 'active') {
        cancelAnimation(pulse);
        pulse.set(0);
        setBursts([]);
      }
    });
    return () => sub.remove();
  }, [pulse]);
  useEffect(() => {
    if (!active || pulseSignal === 0) return;
    pulse.set(withSequence(
      withTiming(1, { duration: 110 }),
      withTiming(0, { duration: 430 }),
    ));
    return () => cancelAnimation(pulse);
  }, [pulseSignal, pulse, active]);
  const glowRadius = useDerivedValue(
    () => layout.cell * 2.4 * (1 + pulse.value * 1.5),
  );
  const glowOpacity = useDerivedValue(() => 0.1 + pulse.value * 0.42);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Starfield size={size} />

        <Group>
          {layout.orbit.map((o, i) => (
            <Oval
              key={i}
              x={layout.center.x - o.rx}
              y={layout.center.y - o.ry}
              width={o.rx * 2}
              height={o.ry * 2}
              color={palette.ringGuide}
              style="stroke"
              strokeWidth={1}
              opacity={0.85 - i * 0.25}
            />
          ))}
        </Group>

        <Group>
          {layout.tunnelAnchors.map((a, i) => (
            <Circle key={i} cx={a.x} cy={a.y} r={layout.cell * 0.5} opacity={0.7}>
              <RadialGradient
                c={vec(a.x, a.y)}
                r={layout.cell * 0.9}
                colors={[palette.coreGlow, 'rgba(143,180,255,0)']}
                positions={[0, 1]}
              />
            </Circle>
          ))}
        </Group>

        <Circle
          cx={layout.center.x}
          cy={layout.center.y}
          r={glowRadius}
          opacity={glowOpacity}
        >
          <RadialGradient
            c={vec(layout.center.x, layout.center.y)}
            r={layout.cell * 4}
            colors={[pulseColor, 'rgba(143,180,255,0)']}
            positions={[0, 1]}
          />
        </Circle>
      </Canvas>

      {/* pixel layer — one view per uncleared pixel of the presented state */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {state.pixels.map((p) => {
          if (p.cleared) return null;
          const c = centreOf.get(p.id);
          return (
            <Pixel
              key={p.id}
              color={p.color}
              cx={c?.x ?? 0}
              cy={c?.y ?? 0}
              cell={layout.cell}
              reachable={reachableIds.has(p.id)}
              motionEnabled={active}
            />
          );
        })}
      </View>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {(active ? bursts : []).map((b) => (
          <PixelBurst
            key={b.key}
            point={b.point}
            color={b.color}
            cell={b.cell}
          />
        ))}
      </View>

      {(active ? shots : []).map((shot) => {
        const target = centreOf.get(shot.pixelId);
        return target ? <EnergyShot key={`${shot.passId}-${shot.pixelId}`}
          shot={shot} layout={layout} target={target} /> : null;
      })}

      <OrbitingCharge
        layout={layout}
        signal={flightSignal}
        pass={active ? flightPass : null}
        capacity={flyingCapacity}
      />
    </View>
  );
}

export { orbColors };

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    position: 'relative',
    overflow: 'visible',
  },
});
