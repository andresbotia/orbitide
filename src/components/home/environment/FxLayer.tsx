import { Blur, Canvas, Group, Rect, RoundedRect } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { NEON, neonAlpha } from '@/theme/neon';

import { neonSigns, sceneFrame, type NeonSign, type SceneFrame } from './sceneGeometry';

interface FxLayerProps {
  width: number;
  height: number;
}

/**
 * FX — only the lit neon: sign tubes, sign lettering bars, the horizon line.
 *
 * Isolated so the motion pass can flicker it by animating this layer's opacity
 * alone. The glow is a pre-blurred copy drawn once; nothing here ever animates
 * a blur radius or a shadow.
 *
 * ── PNG SWAP POINT ────────────────────────────────────────────────────────
 * To replace this layer with a pre-rendered raster, swap the whole <Canvas>
 * below for:
 *     <Image source={require('../../../../assets/home/fx.png')}
 *            resizeMode="cover" style={StyleSheet.absoluteFill} />
 * Bake the glow into the PNG on a transparent background. HomeEnvironment owns
 * the opacity and transforms, so the animation code is untouched.
 * ──────────────────────────────────────────────────────────────────────────
 */
export const FxLayer = memo(function FxLayer({ width, height }: FxLayerProps) {
  const frame = useMemo(() => sceneFrame(width, height), [width, height]);
  const signs = useMemo(() => neonSigns(frame), [frame]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Pre-blurred halo. Static — only the parent View's opacity moves. */}
      <Group>
        <Blur blur={7} />
        <NeonTubes frame={frame} signs={signs} strokeWidth={4} alpha={0.55} />
      </Group>
      <NeonTubes frame={frame} signs={signs} strokeWidth={1.5} alpha={1} />
    </Canvas>
  );
});

function NeonTubes({
  frame,
  signs,
  strokeWidth,
  alpha,
}: {
  frame: SceneFrame;
  signs: NeonSign[];
  strokeWidth: number;
  alpha: number;
}) {
  return (
    <Group>
      <Rect
        x={-frame.width * 0.1}
        y={frame.horizon - strokeWidth / 2}
        width={frame.width * 1.2}
        height={strokeWidth}
        color={neonAlpha(NEON.cyan, alpha)}
      />
      {signs.map((s, i) => (
        <Group key={`sign-${i}`}>
          <RoundedRect
            x={s.x}
            y={s.y}
            width={s.w}
            height={s.h}
            r={4}
            style="stroke"
            strokeWidth={strokeWidth}
            color={neonAlpha(NEON[s.tone], alpha)}
          />
          {s.bars.map((b, j) => (
            <Rect
              key={`bar-${i}-${j}`}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              color={neonAlpha(j % 2 === 0 ? NEON[s.tone] : NEON.cyanPale, alpha)}
            />
          ))}
        </Group>
      ))}
    </Group>
  );
}
