import { Canvas, Circle, Group, LinearGradient, RoundedRect, vec } from '@shopify/react-native-skia';
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

// NORTH-STAR REBUILD — widened from 9px (a hairline that read as "a small
// image floating inside a giant dark rectangle") to a real arcade-cabinet
// bezel with its own corner hardware, still never touching the board's own
// interior (that stays `CoreV2Board`'s/`OrbitBoard`'s job). Exported so
// `GameScreen`'s board-sizing math can reserve enough room for it — this
// frame draws OUTSIDE `boardSize`, so the board area must budget for it or
// the corners clip against the screen edge.
export const BOARD_FRAME_MARGIN = 22;
const MARGIN = BOARD_FRAME_MARGIN;

/**
 * PIXEL ARCADIA BOARD FRAME (UI-R3, widened in the north-star visual
 * rebuild) — the dimensional cabinet housing around the gameplay board.
 * Renders BEHIND the (unchanged) board, extending `MARGIN`px past its edges:
 * a thicker bevel shell, four corner "rivet" accents, a brighter cyan rail
 * line, and a faint world-accent aura. Does not read `GameState` or touch
 * `OrbitBoard` — purely a static frame with one small reactive input
 * (`celebrate`) for the win handoff.
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

  const accentOpacity = useDerivedValue(() => 0.46 + breath.value * 0.18 + celebrate.value * 0.45);
  const accentSoftOpacity = useDerivedValue(() => accentOpacity.value * 0.5);
  const auraOpacity = useDerivedValue(() => 0.17 + celebrate.value * 0.28);

  const rivetR = Math.max(3, size * 0.012);
  const rivetInset = cornerR * 0.62;
  const rivets = [
    { x: rivetInset, y: rivetInset },
    { x: boxed - rivetInset, y: rivetInset },
    { x: rivetInset, y: boxed - rivetInset },
    { x: boxed - rivetInset, y: boxed - rivetInset },
  ];

  return (
    <Canvas
      pointerEvents="none"
      style={[styles.canvas, { width: boxed, height: boxed, left: -MARGIN, top: -MARGIN }]}
    >
      {/* Structural mat — the cabinet bezel body around the board. */}
      <RoundedRect x={0} y={0} width={boxed} height={boxed} r={cornerR}>
        <LinearGradient start={vec(0, 0)} end={vec(boxed, boxed)} colors={[material.raisedSurface, material.structuralSurface]} />
      </RoundedRect>

      {/* Bevel edge: upper-left highlight, lower-right shadow. */}
      <RoundedRect x={0.75} y={0.75} width={boxed - 1.5} height={boxed - 1.5} r={cornerR} style="stroke" strokeWidth={2.5}>
        <LinearGradient start={vec(0, 0)} end={vec(boxed, boxed)} colors={[material.bevelHighlight, material.bevelShadow]} />
      </RoundedRect>

      {/* Corner hardware — small rivet accents, the "physical machine" cue. */}
      <Group opacity={0.85}>
        {rivets.map((r, i) => (
          <Circle key={i} cx={r.x} cy={r.y} r={rivetR} color={material.bevelShadow} />
        ))}
        {rivets.map((r, i) => (
          <Circle key={`hl-${i}`} cx={r.x - rivetR * 0.3} cy={r.y - rivetR * 0.3} r={rivetR * 0.4} color={material.bevelHighlight} />
        ))}
      </Group>

      {/* Faint world-accent aura on the outermost edge only. */}
      <Group opacity={auraOpacity}>
        <RoundedRect x={-2} y={-2} width={boxed + 4} height={boxed + 4} r={cornerR + 2} style="stroke" strokeWidth={3} color={worldAccent} />
      </Group>

      {/* Bright cyan rail line right at the board's own edge — a real glowing
          seam, not a hairline, so the board reads as lit from its own frame. */}
      <Group opacity={accentOpacity}>
        <RoundedRect x={MARGIN} y={MARGIN} width={size} height={size} r={Math.max(4, cornerR * 0.4)} style="stroke" strokeWidth={3} color={material.accentCyan} />
      </Group>
      <Group opacity={accentSoftOpacity}>
        <RoundedRect x={MARGIN - 2} y={MARGIN - 2} width={size + 4} height={size + 4} r={Math.max(4, cornerR * 0.4) + 2} style="stroke" strokeWidth={5} color={material.accentCyan} />
      </Group>
    </Canvas>
  );
});

const styles = StyleSheet.create({
  canvas: { position: 'absolute' },
});
