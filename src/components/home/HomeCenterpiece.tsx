import {
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  RoundedRect,
  vec,
} from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { AmbientChargeSpec, HomeLayout, LevelPreview } from '@/game/rendering/homeGeometry';
import { previewGrid } from '@/game/rendering/homeGeometry';
import { orbColors } from '@/theme/colors';
import { arcade, pixelMaterial } from '@/theme/arcade';
import { AmbientCharge } from './AmbientCharge';

interface HomeCenterpieceProps {
  layout: HomeLayout;
  preview: LevelPreview;
  specs: AmbientChargeSpec[];
  active: boolean;
  reducedMotion: boolean;
  /** 0 idle, ramps to 1 on PLAY press for the activation response. */
  activation: SharedValue<number>;
}

/**
 * MIDGROUND depth layer: the orbital machine that "contains the next puzzle".
 * Physical rail, recessed housing, the actual current-level preview inside it,
 * a slow energy sweep and 1–3 ambient charges. Not decorative — it is the hero.
 */
export const HomeCenterpiece = memo(function HomeCenterpiece({
  layout, preview, specs, active, reducedMotion, activation,
}: HomeCenterpieceProps) {
  const { machineRadius: R, orbitRadius } = layout;
  const band = Math.max(3, R * 0.055);

  const sweep = useSharedValue(0);
  const breath = useSharedValue(0.5);

  useEffect(() => {
    cancelAnimation(sweep);
    cancelAnimation(breath);
    if (!active) return;
    if (!reducedMotion) {
      sweep.set(withRepeat(withTiming(1, { duration: 7200, easing: Easing.linear }), -1, false));
    }
    // Preview "breathing" stays even under reduced motion — the essential life.
    breath.set(withRepeat(
      withTiming(1, { duration: reducedMotion ? 9000 : 4700, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    ));
    return () => { cancelAnimation(sweep); cancelAnimation(breath); };
  }, [active, reducedMotion, sweep, breath]);

  const grid = useMemo(() => previewGrid(preview, { size: layout.preview.size }), [preview, layout.preview.size]);

  const sweepTransform = useDerivedValue(() => [{ rotate: sweep.value * Math.PI * 2 }]);
  const sweepOpacity = useDerivedValue(() => 0.25 + activation.value * 0.5);

  const previewTransform = useDerivedValue(() => {
    const s = 1 + (breath.value - 0.5) * 0.024 + activation.value * 0.05;
    return [{ scale: s }];
  });
  const ringGlow = useDerivedValue(() => 0.4 + activation.value * 0.55);

  // A short highlight arc for the energy sweep (~55° of the rail), in the
  // canvas-local frame where the machine centre is (R, R).
  const sweepArc = useMemo(() => {
    const a0 = -Math.PI / 2 - 0.5;
    const a1 = -Math.PI / 2 + 0.5;
    const p = (a: number) => `${(R + Math.cos(a) * orbitRadius).toFixed(2)} ${(R + Math.sin(a) * orbitRadius).toFixed(2)}`;
    return `M ${p(a0)} A ${orbitRadius} ${orbitRadius} 0 0 1 ${p(a1)}`;
  }, [R, orbitRadius]);

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { left: layout.center.x - R, top: layout.center.y - R, width: R * 2, height: R * 2 }]}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Recessed housing. */}
        <Circle cx={R} cy={R} r={R}>
          <RadialGradient c={vec(R * 0.8, R * 0.72)} r={R * 1.3} colors={[arcade.metalRaised, arcade.metalLo]} />
        </Circle>
        <Circle cx={R} cy={R} r={R - 1} color={arcade.metalSeam} style="stroke" strokeWidth={2} opacity={0.6} />

        {/* Orbit rail (same language as the gameplay rail). */}
        <Circle cx={R} cy={R} r={orbitRadius + band * 0.5} color={arcade.railShadow} style="stroke" strokeWidth={band * 1.4} opacity={0.5} />
        <Circle cx={R} cy={R} r={orbitRadius} color={arcade.railBase} style="stroke" strokeWidth={band} />
        <Circle cx={R} cy={R} r={orbitRadius} color={arcade.railGroove} style="stroke" strokeWidth={Math.max(1, band * 0.32)} opacity={0.9} />
        <Circle cx={R} cy={R} r={orbitRadius - band * 0.5} color={arcade.metalEdge} style="stroke" strokeWidth={1} opacity={0.5} />

        {/* Energy sweep. */}
        <Group origin={vec(R, R)} transform={sweepTransform} opacity={sweepOpacity}>
          <Path
            path={sweepArc}
            color={arcade.accent}
            style="stroke"
            strokeWidth={Math.max(2, band * 0.6)}
            strokeCap="round"
          />
        </Group>

        {/* Hub seat behind the preview. */}
        <Circle cx={R} cy={R} r={orbitRadius * 0.12} color={arcade.socket} style="stroke" strokeWidth={2} opacity={0.7} />
        <Circle cx={R} cy={R} r={orbitRadius + band} color={arcade.accent} style="stroke" strokeWidth={1} opacity={ringGlow} />

        {/* Current-level preview — from real board data, inside the machine. */}
        <Group origin={vec(R, R)} transform={previewTransform}>
          {preview.cells.map((c) => {
            const m = pixelMaterial(c.color);
            const size = Math.max(2, grid.cell - (preview.simplify ? 0.6 : 1.4));
            const x = (R - layout.preview.size / 2) + grid.originX + c.x * grid.cell;
            const y = (R - layout.preview.size / 2) + grid.originY + c.y * grid.cell;
            const rad = preview.simplify ? 1 : Math.max(1.5, grid.cell * 0.22);
            return (
              <Group key={`${c.x},${c.y}`}>
                <RoundedRect x={x} y={y} width={size} height={size} r={rad} color={orbColors[c.color]} />
                {preview.simplify ? null : (
                  <RoundedRect x={x} y={y} width={size} height={size * 0.4} r={rad} color={m.top} opacity={0.3} />
                )}
              </Group>
            );
          })}
        </Group>
      </Canvas>

      {specs.map((spec, i) => (
        <AmbientCharge
          key={i}
          spec={spec}
          center={{ x: R, y: R }}
          radius={orbitRadius}
          size={Math.max(12, orbitRadius * 0.14)}
          active={active}
          reducedMotion={reducedMotion}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
});
