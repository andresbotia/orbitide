import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { getActiveColor, getExposedOrbs } from '@/game/engine/selectors';
import type { GameState } from '@/game/engine/types';
import { orbColors, palette } from '@/theme/colors';

import { Core } from './Core';
import { Starfield } from './effects/Starfield';
import { computeBoardLayout, layoutOrbs } from './layout';
import { Orb } from './Orb';

interface OrbitBoardProps {
  size: number;
  state: GameState;
  /** Input is locked while a move resolves visually. */
  locked: boolean;
  onTapOrb: (orbId: string) => void;
  /** Increments each time the Core should pulse. */
  pulseSignal: number;
  /** Strength of the pulse (0.4 absorb, 1 target/win). */
  pulseStrength: number;
  /** Tint of the pulse — usually the last absorbed color. */
  flashColor: string;
}

export function OrbitBoard({
  size,
  state,
  locked,
  onTapOrb,
  pulseSignal,
  pulseStrength,
  flashColor,
}: OrbitBoardProps) {
  const layout = useMemo(
    () => computeBoardLayout(size, state.lanes.length),
    [size, state.lanes.length],
  );

  const positioned = useMemo(() => layoutOrbs(state, layout), [state, layout]);
  const activeColor = getActiveColor(state);
  const exposedIds = useMemo(
    () => new Set(getExposedOrbs(state).map((e) => e.orb.id)),
    [state],
  );

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (pulseSignal === 0) return;
    pulse.value = withSequence(
      withTiming(pulseStrength, { duration: 120 }),
      withTiming(0, { duration: 420 }),
    );
  }, [pulseSignal, pulseStrength, pulse]);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Starfield size={size} />

        {/* concentric orbital guides */}
        <Group>
          {layout.ringRadii.map((r, i) => (
            <Circle
              key={i}
              cx={layout.center.x}
              cy={layout.center.y}
              r={r}
              color={palette.ringGuide}
              style="stroke"
              strokeWidth={1}
              opacity={0.9 - i * 0.12}
            />
          ))}
        </Group>

        <Core
          center={layout.center}
          radius={layout.coreRadius}
          pulse={pulse}
          flashColor={flashColor}
        />
      </Canvas>

      {/* Orb layer — Reanimated views on top of the Skia field. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {positioned.map((o) => (
          <Orb
            key={o.id}
            id={o.id}
            color={o.color}
            point={o.point}
            center={layout.center}
            radius={layout.orbRadius}
            isExposed={exposedIds.has(o.id)}
            matches={o.color === activeColor}
            disabled={locked || state.status !== 'playing'}
            onPress={onTapOrb}
          />
        ))}
      </View>
    </View>
  );
}

/** Solid color lookup re-exported for callers that need an orb tint. */
export { orbColors };

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    position: 'relative',
  },
});
