import { Blur, Circle, Group, RadialGradient, vec } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';

import { palette } from '@/theme/colors';

import type { Point } from './layout';

interface CoreProps {
  center: Point;
  radius: number;
  /** 0 at rest, spikes toward ~1 on absorb / target complete / win. */
  pulse: SharedValue<number>;
  /** Tint of the most recently absorbed orb, drives the flash color. */
  flashColor: string;
}

/**
 * The luminous central Core — the visual anchor of the board. A steady inner
 * disc with a soft outer halo, plus a pulse ring that expands and fades when
 * `pulse` is driven.
 */
export function Core({ center, radius, pulse, flashColor }: CoreProps) {
  const cx = center.x;
  const cy = center.y;

  const haloRadius = useDerivedValue(() => radius * (1.9 + pulse.value * 1.2));
  const haloOpacity = useDerivedValue(() => 0.18 + pulse.value * 0.5);
  const pulseRingRadius = useDerivedValue(() => radius * (1 + pulse.value * 2.6));
  const pulseRingOpacity = useDerivedValue(() => pulse.value * 0.55);
  const bodyRadius = useDerivedValue(() => radius * (1 + pulse.value * 0.12));

  return (
    <Group>
      {/* outer halo */}
      <Circle cx={cx} cy={cy} r={haloRadius} opacity={haloOpacity}>
        <RadialGradient
          c={vec(cx, cy)}
          r={radius * 3.2}
          colors={[flashColor, palette.coreGlow, 'rgba(143,180,255,0)']}
          positions={[0, 0.4, 1]}
        />
        <Blur blur={16} />
      </Circle>

      {/* expanding pulse ring */}
      <Circle
        cx={cx}
        cy={cy}
        r={pulseRingRadius}
        color={flashColor}
        style="stroke"
        strokeWidth={2.5}
        opacity={pulseRingOpacity}
      />

      {/* core body */}
      <Circle cx={cx} cy={cy} r={bodyRadius}>
        <RadialGradient
          c={vec(cx, cy - radius * 0.25)}
          r={radius * 1.4}
          colors={[palette.core, palette.coreGlow, '#2E4C86']}
          positions={[0, 0.55, 1]}
        />
      </Circle>
    </Group>
  );
}
