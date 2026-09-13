import { Circle, Group, RoundedRect } from '@shopify/react-native-skia';

import { coreV2Board } from '@/theme/coreV2Board';
import type { BoardGeometry } from './boardGeometry';

/**
 * M5.3 — the Core V2 rounded-rectangle energy track. Traces the exact same
 * `geo.perimeter` bounds the engine-truth flight geometry travels (see
 * `flightGeometry.ts`), so the visible rail and the actual targeting/flight
 * path never disagree (spec §1). Brighter navy/indigo material than Legacy
 * V1's circular `OrbitRail` (spec §13) — a separate file, not a recolor of
 * the circular rail, so Legacy V1's presentation is entirely unaffected.
 *
 * Renders nothing when `geo.perimeter` is absent (i.e. a Legacy V1 geometry
 * was passed in by mistake) — a silent no-op is safer than crashing render.
 */
export function RoundedRail({ geo }: { geo: BoardGeometry }) {
  const p = geo.perimeter;
  if (!p) return null;

  // Denser boards get a slightly thinner, calmer rail (mirrors OrbitRail).
  const band = Math.max(3, geo.size * 0.024 - geo.density * 0.14);
  const cx = p.x + p.width / 2;
  const cy = p.y + p.height / 2;

  return (
    <Group>
      {/* Outer groove shadow. */}
      <RoundedRect
        x={p.x - band * 0.55} y={p.y - band * 0.55}
        width={p.width + band * 1.1} height={p.height + band * 1.1}
        r={p.radius + band * 0.55}
        style="stroke" strokeWidth={band * 1.3} color={coreV2Board.fieldEdge} opacity={0.55}
      />
      {/* Structural band. */}
      <RoundedRect x={p.x} y={p.y} width={p.width} height={p.height} r={p.radius}
        style="stroke" strokeWidth={band} color={coreV2Board.railBand} />
      {/* Machined groove down the center of the band. */}
      <RoundedRect x={p.x} y={p.y} width={p.width} height={p.height} r={p.radius}
        style="stroke" strokeWidth={Math.max(1, band * 0.34)} color={coreV2Board.railGroove} opacity={0.9} />
      {/* Top-left catch-light, offset slightly inward. */}
      <RoundedRect
        x={p.x + band * 0.5} y={p.y + band * 0.5}
        width={Math.max(0, p.width - band)} height={Math.max(0, p.height - band)}
        r={Math.max(0, p.radius - band * 0.5)}
        style="stroke" strokeWidth={1} color={coreV2Board.railHighlight} opacity={0.5}
      />
      {/* Inner informational guide, near the artwork. */}
      <RoundedRect
        x={p.x + band * 1.7} y={p.y + band * 1.7}
        width={Math.max(0, p.width - band * 3.4)} height={Math.max(0, p.height - band * 3.4)}
        r={Math.max(0, p.radius - band * 1.7)}
        style="stroke" strokeWidth={1} color={coreV2Board.railGlow} opacity={0.22}
      />
      {/* Restrained center presence so the field doesn't read as a flat void. */}
      <Circle cx={cx} cy={cy} r={Math.min(p.width, p.height) * 0.02} color={coreV2Board.railGlow} opacity={0.12} />
    </Group>
  );
}

/**
 * The single shared perimeter launcher — bottom-center of the rounded rect,
 * exactly where `geo.orbitInsertion` sits (spec §7: one shared entry point,
 * no center-hub launch, compact/arcade-like, not a giant cannon).
 */
export function RoundedLauncherGate({ geo }: { geo: BoardGeometry }) {
  if (!geo.perimeter) return null;
  const { x, y } = geo.orbitInsertion;
  const r = geo.chargeRadius * 0.7;
  return (
    <Group opacity={0.95}>
      <Circle cx={x} cy={y} r={r + 3} color={coreV2Board.fieldEdge} opacity={0.65} />
      <Circle cx={x} cy={y} r={r} style="stroke" strokeWidth={2} color={coreV2Board.launcherGate} opacity={0.85} />
      <Circle cx={x} cy={y} r={r * 0.55} color={coreV2Board.launcherGlow} opacity={0.4} />
    </Group>
  );
}
