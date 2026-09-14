import { Circle, Group, RoundedRect } from '@shopify/react-native-skia';

import { coreV2Board } from '@/theme/coreV2Board';
import type { BoardGeometry } from './boardGeometry';

/**
 * Core V2 rounded-rectangle energy track. Traces the same `geo.perimeter`
 * the flight geometry travels. The rail is the only board frame — no outer
 * glow, no inner hairline. Legacy V1 keeps `OrbitRail`.
 *
 * Renders nothing when `geo.perimeter` is absent (i.e. a Legacy V1 geometry
 * was passed in by mistake) — a silent no-op is safer than crashing render.
 */
export function RoundedRail({ geo }: { geo: BoardGeometry }) {
  const p = geo.perimeter;
  if (!p) return null;

  // ~10pt track on a reference board; slightly thinner on dense/small boards.
  const band = Math.max(6, Math.min(10, geo.size * 0.028));

  return (
    <Group>
      {/* Structural band — the only frame around gameplay. */}
      <RoundedRect x={p.x} y={p.y} width={p.width} height={p.height} r={p.radius}
        style="stroke" strokeWidth={band} color={coreV2Board.railBand} />
      {/* 1pt upper edge-light. No outer glow. */}
      <RoundedRect
        x={p.x + 1} y={p.y + 1}
        width={Math.max(0, p.width - 2)} height={Math.max(0, p.height - 2)}
        r={Math.max(0, p.radius - 1)}
        style="stroke" strokeWidth={1} color={coreV2Board.railHighlight} opacity={0.3}
      />
      {/* Inner lip: 2pt inset shadow only — no hairline stroke. */}
      <RoundedRect
        x={p.x + band * 0.55} y={p.y + band * 0.55}
        width={Math.max(0, p.width - band * 1.1)} height={Math.max(0, p.height - band * 1.1)}
        r={Math.max(0, p.radius - band * 0.55)}
        style="stroke" strokeWidth={2} color={coreV2Board.innerLip} opacity={0.55}
      />
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
  const r = geo.chargeRadius * 0.55;
  return (
    <Group opacity={0.9}>
      <Circle cx={x} cy={y} r={r} style="stroke" strokeWidth={1.5} color={coreV2Board.launcherGate} opacity={0.7} />
    </Group>
  );
}
