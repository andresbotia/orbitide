import { Blur, Canvas, Group, LinearGradient, Path, vec } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { NEON, neonAlpha } from '@/theme/neon';

import { artBox, HOME_ART, sceneFrame, type SceneFrame } from './sceneGeometry';

interface ReflectionLayerProps {
  width: number;
  height: number;
}

type ReflectionTone = 'gold' | 'cyan';

/**
 * Lit column bands in assets/home-city-b.png, in art pixels (1254 x 1570),
 * measured from the PNG itself: per-column counts of gold window pixels and cyan
 * edge-light pixels, smoothed, with each band's opacity (10–18%) scaled by how
 * much light it holds. Where gold and cyan share a column, the dominant tone
 * wins.
 */
const ART_REFLECTIONS: readonly { x0: number; x1: number; tone: ReflectionTone; alpha: number }[] = [
  { x0: 18, x1: 90, tone: 'gold', alpha: 0.18 },
  { x0: 95, x1: 120, tone: 'cyan', alpha: 0.18 },
  { x0: 153, x1: 205, tone: 'cyan', alpha: 0.17 },
  { x0: 206, x1: 224, tone: 'gold', alpha: 0.11 },
  { x0: 299, x1: 319, tone: 'gold', alpha: 0.11 },
  { x0: 679, x1: 712, tone: 'gold', alpha: 0.12 },
  { x0: 993, x1: 1018, tone: 'cyan', alpha: 0.16 },
  { x0: 1035, x1: 1083, tone: 'gold', alpha: 0.15 },
  { x0: 1125, x1: 1171, tone: 'cyan', alpha: 0.18 },
  { x0: 1192, x1: 1236, tone: 'gold', alpha: 0.13 },
];

/** Band width at the near edge, as a multiple of its width at the horizon. */
const NEAR_WIDEN = 2.6;

/**
 * REFLECTIONS — soft vertical streaks on the floor beneath the lit parts of the
 * painted skyline, gold and cyan. Each starts at the horizon under its source,
 * widens toward the viewer and fades out before the near edge.
 *
 * Positions are art pixels mapped through the same `artBox` as the city image,
 * and HomeEnvironment moves this layer with the city's parallax, so every streak
 * stays under the building that casts it. Drawn above the city and below the
 * grid; the soft edge is a static pre-blur and never animates.
 *
 * ── PNG SWAP POINT ────────────────────────────────────────────────────────
 * To replace this layer with a pre-rendered raster, swap the whole <Canvas>
 * below for:
 *     <Image source={require('../../../../assets/home-reflections.png')}
 *            resizeMode="cover" style={StyleSheet.absoluteFill} />
 * The raster must be registered to the sky/city art on a transparent
 * background. HomeEnvironment owns the transforms, so the animation code is
 * untouched.
 * ──────────────────────────────────────────────────────────────────────────
 */
export const ReflectionLayer = memo(function ReflectionLayer({ width, height }: ReflectionLayerProps) {
  const frame = useMemo(() => sceneFrame(width, height), [width, height]);
  const bands = useMemo(() => placeBands(frame), [frame]);
  const start = vec(0, frame.horizon);
  const end = vec(0, height);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group>
        <Blur blur={5} />
        {bands.map((band, i) => (
          <Path key={`reflection-${i}`} path={band.path}>
            <LinearGradient
              start={start}
              end={end}
              colors={[
                neonAlpha(NEON[band.tone], band.alpha),
                neonAlpha(NEON[band.tone], band.alpha * 0.4),
                neonAlpha(NEON[band.tone], 0),
              ]}
              positions={[0, 0.45, 1]}
            />
          </Path>
        ))}
      </Group>
    </Canvas>
  );
});

/** Each band as a trapezoid from the horizon (source width) to the near edge (widened). */
function placeBands(frame: SceneFrame) {
  const n = (v: number) => v.toFixed(1);
  const box = artBox(frame);
  const scale = box.w / HOME_ART.width;
  return ART_REFLECTIONS.map((r) => {
    const cx = box.x + ((r.x0 + r.x1) / 2) * scale;
    const half = ((r.x1 - r.x0 + 1) / 2) * scale;
    const nearHalf = half * NEAR_WIDEN;
    const top = frame.horizon;
    const bottom = frame.height;
    return {
      tone: r.tone,
      alpha: r.alpha,
      path:
        `M ${n(cx - half)} ${n(top)} L ${n(cx + half)} ${n(top)} ` +
        `L ${n(cx + nearHalf)} ${n(bottom)} L ${n(cx - nearHalf)} ${n(bottom)} Z`,
    };
  });
}
