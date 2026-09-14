import { Canvas, Group, Path, Rect, RoundedRect } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { NEON, neonAlpha } from '@/theme/neon';

import { neonSigns, palms, sceneFrame, skyline } from './sceneGeometry';

interface CitySkiaLayerProps {
  width: number;
  height: number;
}

/**
 * CITY (Skia) — skyline silhouettes, dim window grids, unlit sign housings, palms.
 *
 * Everything here is ambient and stays dark: sign panels are drawn with only a
 * faint edge. Their lit tubes live in FxLayer so flicker can animate them
 * without touching the skyline.
 *
 * ── SKIA FALLBACK ─────────────────────────────────────────────────────────
 * Procedural implementation, kept as the fallback for `CityLayer`, which now
 * renders assets/home-city-b.png. To switch back, follow the swap point in
 * CityLayer.tsx. HomeEnvironment owns the transforms, so the animation
 * code is untouched either way.
 * ──────────────────────────────────────────────────────────────────────────
 */
export const CitySkiaLayer = memo(function CitySkiaLayer({ width, height }: CitySkiaLayerProps) {
  const frame = useMemo(() => sceneFrame(width, height), [width, height]);
  const buildings = useMemo(() => skyline(frame), [frame]);
  const signs = useMemo(() => neonSigns(frame), [frame]);
  const trees = useMemo(() => palms(frame), [frame]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Footing under the skyline. The city tilts further than the sky, so
          without this the buildings would lift off the horizon and show the
          warm band beneath them. */}
      <Rect x={0} y={frame.horizon} width={width} height={16} color={NEON.inkDeep} />

      {buildings.map((b, i) => (
        <Group key={`bld-${i}`}>
          <Rect x={b.x} y={b.y} width={b.w} height={b.h} color={NEON.ink} />
          {/* Rim light: one px of pale cyan along the roofline. */}
          <Rect x={b.x} y={b.y} width={b.w} height={1} color={neonAlpha(NEON.cyanPale, 0.18)} />
          {b.windows.map((w, j) => (
            <Rect
              key={`win-${i}-${j}`}
              x={w.x}
              y={w.y}
              width={w.w}
              height={w.h}
              color={neonAlpha(j % 3 === 0 ? NEON.cyan : NEON.gold, 0.32)}
            />
          ))}
        </Group>
      ))}

      {signs.map((s, i) => (
        <Group key={`housing-${i}`}>
          <RoundedRect x={s.x} y={s.y} width={s.w} height={s.h} r={4} color={NEON.inkDeep} />
          <RoundedRect
            x={s.x}
            y={s.y}
            width={s.w}
            height={s.h}
            r={4}
            style="stroke"
            strokeWidth={1}
            color={neonAlpha(NEON[s.tone], 0.25)}
          />
        </Group>
      ))}

      {trees.map((p, i) => (
        <Group key={`palm-${i}`}>
          <Path path={p.trunk} style="stroke" strokeWidth={4} strokeCap="round" color={NEON.inkDeep} />
          <Path path={p.fronds} style="stroke" strokeWidth={3} strokeCap="round" color={NEON.inkDeep} />
        </Group>
      ))}
    </Canvas>
  );
});
