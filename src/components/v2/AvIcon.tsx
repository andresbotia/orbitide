import { Canvas, Circle, Group, Path } from '@shopify/react-native-skia';
import { memo } from 'react';

import { AV } from '@/theme/arcadiaV2';

/**
 * M7A — v2 UI icon family: rounded strokes (2.2–2.6) on a 24-unit grid, one
 * colour. Only items and currencies get fill colour. Paths are the v2 design
 * doc's own glyphs; drawn once in a tiny static Skia canvas. Decorative —
 * parents own the accessibility label.
 */
export type AvIconName =
  | 'undo'
  | 'extraSlot'
  | 'shop'
  | 'trophy'
  | 'gear'
  | 'check'
  | 'chest'
  | 'home'
  | 'restart'
  | 'resume';

const PATHS: Record<AvIconName, readonly string[]> = {
  undo: ['M9 14L4 9l5-5', 'M4 9h10a6 6 0 0 1 0 12h-3'],
  extraSlot: ['M6 6h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z', 'M19 9v6M16 12h6'],
  shop: ['M5 8h14l-1.2 12H6.2z', 'M9 8V6.5a3 3 0 0 1 6 0V8'],
  trophy: ['M7 4h10v5a5 5 0 0 1-10 0z', 'M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8'],
  gear: [
    'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
  check: ['M5 12l5 5 9-10'],
  chest: [
    'M6 9h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z',
    'M3 9h18M12 9v11M12 9c-2-4-6-4-6-1s6 1 6 1zm0 0c2-4 6-4 6-1s-6 1-6 1z',
  ],
  home: ['M4 11l8-7 8 7', 'M6 9.5V20h4v-5h4v5h4V9.5'],
  restart: ['M4 12a8 8 0 1 0 2.4-5.7L4 8.6', 'M4 4v4.6h4.6'],
  resume: ['M8 5.5v13l10-6.5z'],
};

interface AvIconProps {
  name: AvIconName;
  size?: number;
  color?: string;
  /** Stroke width in grid units (24-unit grid). */
  stroke?: number;
}

export const AvIcon = memo(function AvIcon({ name, size = 24, color = AV.icon, stroke = 2.4 }: AvIconProps) {
  const scale = size / 24;
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group transform={[{ scale }]}>
        {PATHS[name].map((d) => (
          <Path
            key={d}
            path={d}
            style="stroke"
            strokeWidth={stroke}
            strokeCap="round"
            strokeJoin="round"
            color={color}
          />
        ))}
      </Group>
    </Canvas>
  );
});

/** v2 bomb item: coral body with highlight, blue fuse, gold spark. */
export const AvBombIcon = memo(function AvBombIcon({ size = 28, muted = false }: { size?: number; muted?: boolean }) {
  const scale = size / 24;
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group transform={[{ scale }]} opacity={muted ? 0.45 : 1}>
        <Circle cx={10.5} cy={14} r={7} color={AV.coral} />
        <Circle cx={8} cy={11.5} r={2} color="#FFB3C2" />
        <Path path="M15 9l2.5-2.5" style="stroke" strokeWidth={2.4} strokeCap="round" color={AV.icon} />
        <Circle cx={19} cy={5} r={2} color={AV.gold} />
      </Group>
    </Canvas>
  );
});

/** v2 heart (lives) glyph, filled. */
export const AvHeartIcon = memo(function AvHeartIcon({ size = 15, color = AV.white }: { size?: number; color?: string }) {
  const scale = size / 24;
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group transform={[{ scale }]}>
        <Path path="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" color={color} />
      </Group>
    </Canvas>
  );
});

/** v2 PLAY triangle (20×22 grid), filled. */
export const AvPlayTriangle = memo(function AvPlayTriangle({ width = 20, color = AV.goldInk }: { width?: number; color?: string }) {
  const scale = width / 20;
  return (
    <Canvas style={{ width, height: 22 * scale }} pointerEvents="none">
      <Group transform={[{ scale }]}>
        <Path path="M3 2.5v17a1.5 1.5 0 0 0 2.3 1.3l13-8.5a1.5 1.5 0 0 0 0-2.6l-13-8.5A1.5 1.5 0 0 0 3 2.5z" color={color} />
      </Group>
    </Canvas>
  );
});
