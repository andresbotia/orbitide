import { Blur, Canvas, Circle, Group, Rect } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { NEON, neonAlpha } from '@/theme/neon';

import { artBox, HOME_ART, sceneFrame, type SceneFrame } from './sceneGeometry';

interface FxLayerProps {
  width: number;
  height: number;
}

type BeaconTone = 'magenta' | 'cyan';

/**
 * Lit points painted into assets/home-city-b.png, in art pixels (1254 x 1570),
 * measured from the PNG itself: four red antenna beacons and two cyan spire
 * tips. `r` is half the painted light's size.
 */
const ART_BEACONS: readonly { x: number; y: number; r: number; tone: BeaconTone }[] = [
  { x: 63, y: 807, r: 6.5, tone: 'magenta' },
  { x: 1207, y: 856.5, r: 6.5, tone: 'magenta' },
  { x: 162, y: 1059.5, r: 6, tone: 'magenta' },
  { x: 869.5, y: 1207, r: 3.5, tone: 'magenta' },
  { x: 696, y: 1126, r: 3.5, tone: 'cyan' },
  { x: 773, y: 1287, r: 2.5, tone: 'cyan' },
];

/**
 * FX — only the lit neon: glows on the beacons painted into the city art, plus
 * the horizon line.
 *
 * Beacon positions are art pixels mapped through the same `artBox` as the city
 * image, so the glows stay registered on the painted lights at every device
 * size; HomeEnvironment moves this layer with the city's parallax. Isolated so
 * flicker can animate this layer's opacity alone. The halo is a pre-blurred
 * copy drawn once; nothing here ever animates a blur radius or a shadow.
 *
 * ── PNG SWAP POINT ────────────────────────────────────────────────────────
 * To replace this layer with a pre-rendered raster, swap the whole <Canvas>
 * below for:
 *     <Image source={require('../../../../assets/home-fx.png')}
 *            resizeMode="cover" style={StyleSheet.absoluteFill} />
 * Bake the glow into the PNG on a transparent background, registered to the
 * sky/city art. HomeEnvironment owns the opacity and transforms, so the
 * animation code is untouched.
 * ──────────────────────────────────────────────────────────────────────────
 */
export const FxLayer = memo(function FxLayer({ width, height }: FxLayerProps) {
  const frame = useMemo(() => sceneFrame(width, height), [width, height]);
  const beacons = useMemo(() => placeBeacons(frame), [frame]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Pre-blurred halo. Static — only the parent View's opacity moves. */}
      <Group>
        <Blur blur={7} />
        <HorizonLine frame={frame} strokeWidth={4} alpha={0.55} />
        {beacons.map((b, i) => (
          <Circle key={`halo-${i}`} cx={b.cx} cy={b.cy} r={b.halo} color={neonAlpha(NEON[b.tone], 0.6)} />
        ))}
      </Group>

      <HorizonLine frame={frame} strokeWidth={1.5} alpha={1} />
      {beacons.map((b, i) => (
        <Circle key={`core-${i}`} cx={b.cx} cy={b.cy} r={b.core} color={NEON[b.tone]} />
      ))}
    </Canvas>
  );
});

function placeBeacons(frame: SceneFrame) {
  const box = artBox(frame);
  const scale = box.w / HOME_ART.width;
  return ART_BEACONS.map((b) => ({
    cx: box.x + b.x * scale,
    cy: box.y + b.y * scale,
    core: Math.max(1.5, b.r * scale * 1.1),
    halo: Math.max(6, b.r * scale * 5),
    tone: b.tone,
  }));
}

function HorizonLine({
  frame,
  strokeWidth,
  alpha,
}: {
  frame: SceneFrame;
  strokeWidth: number;
  alpha: number;
}) {
  return (
    <Rect
      x={-frame.width * 0.1}
      y={frame.horizon - strokeWidth / 2}
      width={frame.width * 1.2}
      height={strokeWidth}
      color={neonAlpha(NEON.cyan, alpha)}
    />
  );
}
