import {
  Canvas,
  Circle,
  Group,
  Oval,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { reachablePixels } from '@/game/engine/pixels';
import type { GameState } from '@/game/engine/types';
import { orbColors, orbGlow, palette } from '@/theme/colors';

import { Starfield } from './effects/Starfield';
import { cellCenter, computeBoardLayout } from './layout';
import { Pixel } from './Pixel';

interface OrbitBoardProps {
  size: number;
  state: GameState;
  /** Ordered pixel ids cleared by the most recent move (for stagger timing). */
  clearSequence: string[];
  /** Bumped when a charge launches; drives the traveling-charge token. */
  flightSignal: number;
  /** Index (0-2) of the tunnel the last charge launched from. */
  flightTunnel: number;
  /** Fill color of the traveling charge token. */
  flightColor: string;
  /** Bumped when the centre should pulse (target/auto-resolve/win). */
  pulseSignal: number;
  pulseColor: string;
}

const STAGGER_MS = 40;
const MAX_STAGGER = 320;

export function OrbitBoard({
  size,
  state,
  clearSequence,
  flightSignal,
  flightTunnel,
  flightColor,
  pulseSignal,
  pulseColor,
}: OrbitBoardProps) {
  const layout = useMemo(
    () => computeBoardLayout(size, state.width, state.height),
    [size, state.width, state.height],
  );

  const reachableIds = useMemo(
    () => new Set(reachablePixels(state).map((p) => p.id)),
    [state],
  );

  const clearIndex = useMemo(() => {
    const map = new Map<string, number>();
    clearSequence.forEach((id, i) => map.set(id, i));
    return map;
  }, [clearSequence]);

  // Centre pulse.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (pulseSignal === 0) return;
    pulse.value = withSequence(
      withTiming(1, { duration: 110 }),
      withTiming(0, { duration: 420 }),
    );
  }, [pulseSignal, pulse]);
  const glowRadius = useDerivedValue(
    () => layout.cell * 2.4 * (1 + pulse.value * 1.4),
  );
  const glowOpacity = useDerivedValue(() => 0.12 + pulse.value * 0.4);

  // Traveling charge token.
  const flight = useSharedValue(0);
  useEffect(() => {
    if (flightSignal === 0) return;
    flight.value = 0;
    flight.value = withTiming(1, { duration: 620 });
  }, [flightSignal, flight]);

  const anchor = layout.tunnelAnchors[flightTunnel] ?? layout.tunnelAnchors[0]!;
  const startAngle = Math.atan2(
    anchor.y - layout.center.y,
    anchor.x - layout.center.x,
  );

  const tokenStyle = useAnimatedStyle(() => {
    const t = flight.value;
    const angle = startAngle + t * Math.PI * 1.6;
    const rx = layout.orbit[0]!.rx * (1 - t) + layout.cell * 0.6 * t;
    const ry = layout.orbit[0]!.ry * (1 - t) + layout.cell * 0.6 * t;
    return {
      opacity: flightSignal === 0 ? 0 : t < 0.96 ? 1 : 0,
      transform: [
        { translateX: layout.center.x + Math.cos(angle) * rx - layout.chargeRadius },
        { translateY: layout.center.y + Math.sin(angle) * ry - layout.chargeRadius },
      ],
    };
  });

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

        {/* tunnel ports on the outer orbit */}
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

        {/* soft picture backlight */}
        <Circle cx={layout.center.x} cy={layout.center.y} r={glowRadius} opacity={glowOpacity}>
          <RadialGradient
            c={vec(layout.center.x, layout.center.y)}
            r={layout.cell * 4}
            colors={[pulseColor, 'rgba(143,180,255,0)']}
            positions={[0, 1]}
          />
        </Circle>
      </Canvas>

      {/* pixel layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {state.pixels.map((p) =>
          p.cleared ? null : (
            <Pixel
              key={p.id}
              color={p.color}
              center={cellCenter(layout, p.x, p.y)}
              cell={layout.cell}
              reachable={reachableIds.has(p.id)}
              exitDelay={Math.min(
                MAX_STAGGER,
                (clearIndex.get(p.id) ?? 0) * STAGGER_MS,
              )}
            />
          ),
        )}
      </View>

      {/* traveling charge token */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.token,
          {
            width: layout.chargeRadius * 2,
            height: layout.chargeRadius * 2,
            borderRadius: layout.chargeRadius,
            backgroundColor: flightColor,
            borderColor: orbGlow.white,
          },
          tokenStyle,
        ]}
      />
    </View>
  );
}

export { orbColors };

const styles = StyleSheet.create({
  container: { alignSelf: 'center', position: 'relative' },
  token: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderWidth: 1.5,
  },
});
