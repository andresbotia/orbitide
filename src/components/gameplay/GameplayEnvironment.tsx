import { Canvas, Circle, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { Fragment, memo, useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { cancelAnimation, Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { AmbientLayer } from '@/components/world/AmbientLayer';
import { NEON } from '@/theme/neon';
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
 *
 * PERFORMANCE: Removed the two structural RoundedRect planes (nearly invisible
 * at 0.28 opacity on a dark navy base, cost 2 draw calls each frame) and the
 * four corner "arcade lamp" radial gradients (each was a separate Skia Circle
 * with its own RadialGradient — 4 radial gradient draws for ~7% opacity glow).
 * A single centered accent glow is kept as the only dynamic element.
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

  const glowOpacity = useDerivedValue(() => 0.06 + breath.value * 0.03);

  return (
    <Fragment>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Rect x={0} y={0} width={width} height={height} color={NEON.inkDeep} />

        {/* Single faint world-accent presence, centered behind the board */}
        <Circle cx={width * 0.5} cy={height * 0.38} r={width * 0.6} opacity={glowOpacity}>
          <RadialGradient c={vec(width * 0.5, height * 0.38)} r={width * 0.6} colors={[worldAccent, 'rgba(0,0,0,0)']} />
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
