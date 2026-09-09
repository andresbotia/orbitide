import { Circle, Group, Path } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { arcade } from '@/theme/arcade';
import type { BoardGeometry } from './boardGeometry';

/**
 * Production orbit rail — a recessed piece of arcade machinery, not a neon ring.
 * Layered strokes read as: outer groove shadow, painted metal band, a restrained
 * top-left highlight arc (consistent light direction), and a thin inner bevel.
 * A faint decorative inner guide sits closer to the artwork.
 *
 * Returns Skia nodes; render inside a <Canvas>.
 */
export function OrbitRail({ geo }: { geo: BoardGeometry }) {
  const { center, orbitRadius: R, innerGuideRadius, density } = geo;

  // Denser boards get a slightly thinner, calmer rail.
  const band = Math.max(2.5, geo.size * 0.02 - density * 0.15);

  const highlightArc = useMemo(() => {
    const a0 = (-168 * Math.PI) / 180;
    const a1 = (-12 * Math.PI) / 180;
    const p = (a: number) => `${(center.x + Math.cos(a) * R).toFixed(2)} ${(center.y + Math.sin(a) * R).toFixed(2)}`;
    return `M ${p(a0)} A ${R} ${R} 0 0 1 ${p(a1)}`;
  }, [center.x, center.y, R]);

  return (
    <Group>
      {/* Outer groove / drop shadow of the recess. */}
      <Circle cx={center.x} cy={center.y} r={R + band * 0.55} color={arcade.railShadow} style="stroke" strokeWidth={band * 1.5} opacity={0.5} />
      {/* Painted metal band. */}
      <Circle cx={center.x} cy={center.y} r={R} color={arcade.railBase} style="stroke" strokeWidth={band} />
      {/* Machined groove down the centre of the band. */}
      <Circle cx={center.x} cy={center.y} r={R} color={arcade.railGroove} style="stroke" strokeWidth={Math.max(1, band * 0.34)} opacity={0.9} />
      {/* Inner bevel catch-light. */}
      <Circle cx={center.x} cy={center.y} r={R - band * 0.5} color={arcade.metalEdge} style="stroke" strokeWidth={1} opacity={0.55} />
      {/* Restrained top-left highlight. */}
      <Path path={highlightArc} color={arcade.railHighlight} style="stroke" strokeWidth={Math.max(1.5, band * 0.5)} strokeCap="round" opacity={0.5} />
      {/* Decorative inner guide near the artwork. */}
      <Circle cx={center.x} cy={center.y} r={innerGuideRadius} color={arcade.accentDim} style="stroke" strokeWidth={1} opacity={0.28} />
    </Group>
  );
}

/**
 * The shared launch hub — a small machined seat at the board centre. Presentation
 * only; the engine's orbit still begins at ORBIT_INSERTION (bottom of the rail).
 */
export function LaunchHubMarker({ geo }: { geo: BoardGeometry }) {
  const { launchHub, orbitInsertion, chargeRadius } = geo;
  const r = chargeRadius * 0.62;
  return (
    <Group opacity={0.9}>
      {/* Radial guide from hub to the insertion point. */}
      <Path
        path={`M ${launchHub.x} ${launchHub.y} L ${orbitInsertion.x} ${orbitInsertion.y}`}
        color={arcade.accentDim}
        style="stroke"
        strokeWidth={1}
        opacity={0.3}
      />
      {/* Insertion port at the bottom of the ring. */}
      <Circle cx={orbitInsertion.x} cy={orbitInsertion.y} r={chargeRadius * 0.5} color={arcade.accent} style="stroke" strokeWidth={1.5} opacity={0.5} />
      {/* Central seat. */}
      <Circle cx={launchHub.x} cy={launchHub.y} r={r + 2} color={arcade.railShadow} opacity={0.5} />
      <Circle cx={launchHub.x} cy={launchHub.y} r={r} color={arcade.socket} style="stroke" strokeWidth={2} />
      <Circle cx={launchHub.x} cy={launchHub.y} r={r} color={arcade.socketRim} style="stroke" strokeWidth={1} opacity={0.6} />
    </Group>
  );
}
