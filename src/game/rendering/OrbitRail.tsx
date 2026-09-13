import { Circle, Group, Path } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { material } from '@/theme/material';
import type { BoardGeometry } from './boardGeometry';

/**
 * PIXEL ARCADIA ENERGY TRACK (UI-R3, was "orbit rail"/"Cosmic Arcade
 * machinery"). The charge's flight still travels this circular path — the
 * engine's flight geometry is unchanged and this file draws exactly the same
 * shape as before — but the material is now Pixel Arcadia hardware: a
 * recessed structural groove with a cyan energy-guide line, not a painted-
 * metal orbit ring. Layered strokes read as: outer groove shadow, structural
 * band, a restrained catch-light arc (consistent top-left light direction),
 * and a thin cyan inner guide near the artwork.
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
      <Circle cx={center.x} cy={center.y} r={R + band * 0.55} color={material.bevelShadow} style="stroke" strokeWidth={band * 1.5} opacity={0.5} />
      {/* Structural band. */}
      <Circle cx={center.x} cy={center.y} r={R} color={material.structuralSurface} style="stroke" strokeWidth={band} />
      {/* Machined groove down the centre of the band. */}
      <Circle cx={center.x} cy={center.y} r={R} color={material.recessedSurface} style="stroke" strokeWidth={Math.max(1, band * 0.34)} opacity={0.9} />
      {/* Inner bevel catch-light. */}
      <Circle cx={center.x} cy={center.y} r={R - band * 0.5} color={material.bevelHighlight} style="stroke" strokeWidth={1} opacity={0.5} />
      {/* Restrained top-left highlight. */}
      <Path path={highlightArc} color={material.bevelHighlight} style="stroke" strokeWidth={Math.max(1.5, band * 0.5)} strokeCap="round" opacity={0.45} />
      {/* Cyan energy-guide line near the artwork — the "informational edging" the track carries. */}
      <Circle cx={center.x} cy={center.y} r={innerGuideRadius} color={material.accentCyan} style="stroke" strokeWidth={1} opacity={0.22} />
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
        color={material.accentCyan}
        style="stroke"
        strokeWidth={1}
        opacity={0.24}
      />
      {/* Insertion port at the bottom of the ring. */}
      <Circle cx={orbitInsertion.x} cy={orbitInsertion.y} r={chargeRadius * 0.5} color={material.accentCyan} style="stroke" strokeWidth={1.5} opacity={0.45} />
      {/* Central seat. */}
      <Circle cx={launchHub.x} cy={launchHub.y} r={r + 2} color={material.bevelShadow} opacity={0.5} />
      <Circle cx={launchHub.x} cy={launchHub.y} r={r} color={material.recessedSurface} style="stroke" strokeWidth={2} />
      <Circle cx={launchHub.x} cy={launchHub.y} r={r} color={material.bevelHighlight} style="stroke" strokeWidth={1} opacity={0.5} />
    </Group>
  );
}
