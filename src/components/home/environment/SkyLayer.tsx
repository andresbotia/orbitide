import { Canvas, Circle, Group, Rect } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { NEON, neonAlpha } from '@/theme/neon';

import { sceneFrame, seededRandom, type SceneFrame } from './sceneGeometry';

interface SkyLayerProps {
  width: number;
  height: number;
}

/**
 * SKY — flat horizontal colour bands, a slatted sun, and a star field.
 *
 * Bands, not a smooth gradient: cheaper to raster and it reads pixel-native.
 * Dusk is built by laying low-alpha magenta and gold over the deep-navy base
 * rather than by introducing mid-tone hexes, which keeps the palette honest and
 * keeps every warm value desaturated enough for neon to still register.
 *
 * ── PNG SWAP POINT ────────────────────────────────────────────────────────
 * To replace this layer with a pre-rendered raster, swap the whole <Canvas>
 * below for:
 *     <Image source={require('../../../../assets/home/sky.png')}
 *            resizeMode="cover" style={StyleSheet.absoluteFill} />
 * Nothing outside this file changes — HomeEnvironment owns the transforms and
 * drives them from the outside, so the animation code is untouched.
 * ──────────────────────────────────────────────────────────────────────────
 */
export const SkyLayer = memo(function SkyLayer({ width, height }: SkyLayerProps) {
  const frame = useMemo(() => sceneFrame(width, height), [width, height]);
  const bands = useMemo(() => skyBands(frame), [frame]);
  const stars = useMemo(() => starField(frame), [frame]);
  const slats = useMemo(() => sunSlats(frame), [frame]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height} color={NEON.inkDeep} />

      {/* Warm dusk stack. Alpha rises toward the horizon; the top stays ink. */}
      {bands.map((band, i) => (
        <Rect key={`band-${i}`} x={0} y={band.y} width={width} height={band.h} color={band.color} />
      ))}

      <Group>
        {stars.map((star, i) => (
          <Rect
            key={`star-${i}`}
            x={star.x}
            y={star.y}
            width={star.size}
            height={star.size}
            color={neonAlpha(NEON.cyanPale, star.alpha)}
          />
        ))}
      </Group>

      {/* Sun sits centred on the horizon — the floor's vanishing point. */}
      <Circle cx={frame.vanishX} cy={frame.horizon} r={frame.sunRadius} color={NEON.gold} />
      <Circle
        cx={frame.vanishX}
        cy={frame.horizon}
        r={frame.sunRadius * 0.62}
        color={neonAlpha(NEON.cyanPale, 0.35)}
      />
      {/* Slats cut the lower half of the disc, widening downward. */}
      {slats.map((slat, i) => (
        <Rect
          key={`slat-${i}`}
          x={frame.vanishX - frame.sunRadius}
          y={slat.y}
          width={frame.sunRadius * 2}
          height={slat.h}
          color={NEON.inkDeep}
        />
      ))}

      {/* Everything below the horizon belongs to the floor layer. */}
      <Rect
        x={0}
        y={frame.horizon}
        width={width}
        height={height - frame.horizon}
        color={NEON.inkDeep}
      />
    </Canvas>
  );
});

interface SkyBand {
  y: number;
  h: number;
  color: string;
}

/**
 * Eight bands from the top of the frame down to the horizon. The upper half
 * stays near-black navy; magenta creeps in through the middle and hands off to
 * gold in the last two bands, where the sun sits.
 */
function skyBands(frame: SceneFrame): SkyBand[] {
  const count = 8;
  const bandHeight = frame.horizon / count;
  const out: SkyBand[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const warm = t * t; // hold the top dark, concentrate colour near the horizon
    const color =
      t < 0.72
        ? neonAlpha(NEON.magenta, warm * 0.30)
        : neonAlpha(NEON.gold, 0.14 + warm * 0.26);
    out.push({ y: i * bandHeight, h: bandHeight + 1, color });
  }
  return out;
}

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
}

/** Stars thin out toward the horizon and never overlap the sun's column. */
function starField(frame: SceneFrame): Star[] {
  const rand = seededRandom(0x50495845); // "PIXE"
  const out: Star[] = [];
  const ceiling = frame.horizon * 0.78;
  for (let i = 0; i < 48; i += 1) {
    const y = rand() * ceiling;
    const x = rand() * frame.width;
    const nearSun = Math.abs(x - frame.vanishX) < frame.sunRadius * 1.15 && y > ceiling * 0.55;
    if (nearSun) continue;
    // Fade out as they approach the horizon haze.
    const depth = 1 - y / ceiling;
    out.push({
      x: Math.round(x),
      y: Math.round(y),
      size: rand() > 0.82 ? 2 : 1,
      alpha: 0.25 + depth * 0.5,
    });
  }
  return out;
}

/** Slat bands across the sun, thickening toward the horizon. */
function sunSlats(frame: SceneFrame): { y: number; h: number }[] {
  const out: { y: number; h: number }[] = [];
  let y = frame.horizon - frame.sunRadius * 0.45;
  let h = 2;
  while (y < frame.horizon) {
    out.push({ y, h });
    y += h + frame.sunRadius * 0.12;
    h += 1.4;
  }
  return out;
}
