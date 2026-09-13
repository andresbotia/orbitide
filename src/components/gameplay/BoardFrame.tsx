import { Canvas, Group, LinearGradient, RoundedRect, vec } from '@shopify/react-native-skia';
import { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { material } from '@/theme/material';

interface BoardFrameProps {
  /** The board's own square edge length (`boardSize` in `GameScreen`) — unchanged, not shrunk. */
  size: number;
  /** Faint environmental hint only — never recolors board/pixel/HUD materials. */
  worldAccent: string;
  active: boolean;
  reducedMotion: boolean;
  /** 0 idle -> 1 on the win transition, for a brief warm handoff pulse (not the win celebration itself). */
  celebrate: SharedValue<number>;
}

const MARGIN = 9;

/**
 * PIXEL ARCADIA BOARD FRAME (UI-R3) — the dimensional cabinet housing around
 * the gameplay board. Renders BEHIND the (unchanged) board, extending only
 * `MARGIN`px past its edges — a thin bevel + cyan accent line + faint
 * world-accent aura, never a thick ornamental border that eats board space.
 * Does not read `GameState` or touch `OrbitBoard` — purely a static frame
 * with one small reactive input (`celebrate`) for the win handoff.
 */
export const BoardFrame = memo(function BoardFrame({ size, worldAccent, active, reducedMotion, celebrate }: BoardFrameProps) {
  const breath = useSharedValue(0.5);

  useEffect(() => {
    cancelAnimation(breath);
    if (!active || reducedMotion) { breath.set(0.5); return; }
    breath.set(withRepeat(withTiming(1, { duration: 4400, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(breath);
  }, [active, reducedMotion, breath]);

  const boxed = size + MARGIN * 2;
  const cornerR = Math.max(10, size * 0.03);

  const accentOpacity = useDerivedValue(() => 0.4 + breath.value * 0.15 + celebrate.value * 0.45);
  const auraOpacity = useDerivedValue(() => 0.12 + celebrate.value * 0.28);

  return (
    <Canvas
      pointerEvents="none"
      style={[styles.canvas, { width: boxed, height: boxed, left: -MARGIN, top: -MARGIN }]}
    >
      {/* Structural mat — only its MARGIN-px ring is visible once the board sits on top. */}
      <RoundedRect x={0} y={0} width={boxed} height={boxed} r={cornerR} color={material.structuralSurface} />

      {/* Bevel edge: upper-left highlight, lower-right shadow. */}
      <RoundedRect x={0.5} y={0.5} width={boxed - 1} height={boxed - 1} r={cornerR} style="stroke" strokeWidth={1.5}>
        <LinearGradient start={vec(0, 0)} end={vec(boxed, boxed)} colors={[material.bevelHighlight, material.bevelShadow]} />
      </RoundedRect>

      {/* Faint world-accent aura on the outermost edge only. */}
      <Group opacity={auraOpacity}>
        <RoundedRect x={-2} y={-2} width={boxed + 4} height={boxed + 4} r={cornerR + 2} style="stroke" strokeWidth={2.5} color={worldAccent} />
      </Group>

      {/* Cyan accent line right at the board's own edge. */}
      <Group opacity={accentOpacity}>
        <RoundedRect x={MARGIN} y={MARGIN} width={size} height={size} r={Math.max(4, cornerR * 0.4)} style="stroke" strokeWidth={1.5} color={material.accentCyan} />
      </Group>
    </Canvas>
  );
});

const styles = StyleSheet.create({
  canvas: { position: 'absolute' },
});
