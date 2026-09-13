import { Canvas, Circle, Group, RadialGradient, Rect, RoundedRect, vec } from '@shopify/react-native-skia';
import { Fragment, memo, useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { cancelAnimation, Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { AmbientLayer } from '@/components/world/AmbientLayer';
import { material } from '@/theme/material';
import type { AmbientTreatmentId } from '@/theme/worldSkins';

interface GameplayEnvironmentProps {
  /** Faint hint only — never recolors board/HUD/tunnel/holding chrome. */
  worldAccent: string;
  worldSecondaryAccent: string;
  ambientId: AmbientTreatmentId;
  active: boolean;
  reducedMotion: boolean;
}

/**
 * PIXEL ARCADIA GAMEPLAY BACKDROP (UI-R3 base + UI-R7 low-intensity world
 * ambience) — replaces the old Cosmic Arcade screen wash that used to sit
 * behind `GameScreen`'s board. Deliberately the most restrained environment
 * in the app: this is the "flow state" screen, so it frames the board rather
 * than competing with it. The `AmbientLayer` here always renders at `"low"`
 * intensity, the floor of the three-tier system — gameplay stays the lowest
 * ambient intensity of any screen, by construction, not by convention.
 */
export const GameplayEnvironment = memo(function GameplayEnvironment({
  worldAccent, worldSecondaryAccent, ambientId, active, reducedMotion,
}: GameplayEnvironmentProps) {
  const { width, height } = useWindowDimensions();
  const breath = useSharedValue(0.5);

  useEffect(() => {
    cancelAnimation(breath);
    if (!active || reducedMotion) { breath.set(0.5); return; }
    breath.set(withRepeat(withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(breath);
  }, [active, reducedMotion, breath]);

  // A couple of very low-contrast structural planes near the edges — enough
  // to read as "inside a cabinet," never enough to compete with the board.
  const planes = useMemo(() => ([
    { x: -width * 0.1, y: height * 0.06, w: width * 0.4, h: height * 0.22, r: 16 },
    { x: width * 0.7, y: height * 0.7, w: width * 0.4, h: height * 0.26, r: 16 },
  ]), [width, height]);

  const glowOpacity = useDerivedValue(() => 0.05 + breath.value * 0.03);

  return (
    <Fragment>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Rect x={0} y={0} width={width} height={height} color={material.background} />

        <Group opacity={0.4}>
          {planes.map((p, i) => (
            <RoundedRect key={i} x={p.x} y={p.y} width={p.w} height={p.h} r={p.r} color={material.recessedSurface} />
          ))}
        </Group>

        {/* Faint world-accent presence, far behind the board — a hint, not a wash. */}
        <Circle cx={width * 0.5} cy={height * 0.42} r={width * 0.7} opacity={glowOpacity}>
          <RadialGradient c={vec(width * 0.5, height * 0.42)} r={width * 0.7} colors={[worldAccent, 'rgba(0,0,0,0)']} />
        </Circle>
      </Canvas>
      <AmbientLayer
        ambientId={ambientId}
        accent={worldAccent}
        secondaryAccent={worldSecondaryAccent}
        intensity="low"
        active={active}
        reducedMotion={reducedMotion}
      />
    </Fragment>
  );
});
