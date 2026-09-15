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

  const short = Math.min(geo.width, geo.height);
  // Thick enough that a 32–38pt Pal reads as seated on the track, not so
  // thick that it eats the artwork.
  const band = Math.max(10, Math.min(14, short * 0.036));

  const inner = band * 0.55;
  return (
    <Group>
      <RoundedRect x={p.x} y={p.y} width={p.width} height={p.height} r={p.radius}
        style="stroke" strokeWidth={band} color={coreV2Board.railBand} />
      <RoundedRect
        x={p.x + 1} y={p.y + 1}
        width={Math.max(0, p.width - 2)} height={Math.max(0, p.height - 2)}
        r={Math.max(0, p.radius - 1)}
        style="stroke" strokeWidth={1.5} color={coreV2Board.railHighlight} opacity={0.78}
      />
      <RoundedRect
        x={p.x + inner} y={p.y + inner}
        width={Math.max(0, p.width - inner * 2)} height={Math.max(0, p.height - inner * 2)}
        r={Math.max(0, p.radius - inner)}
        style="stroke" strokeWidth={2} color={coreV2Board.innerLip} opacity={0.55}
      />
      <RoundedRect
        x={p.x + inner + 1} y={p.y + inner + 1}
        width={Math.max(0, p.width - inner * 2 - 2)} height={Math.max(0, p.height - inner * 2 - 2)}
        r={Math.max(0, p.radius - inner - 1)}
        style="stroke" strokeWidth={1} color={coreV2Board.railHighlight} opacity={0.18}
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
  const r = Math.max(6, geo.chargeRadius * 0.58);
  return (
    <Group>
      <Circle cx={x} cy={y} r={r + 3} color={coreV2Board.launcherGate} opacity={0.18} />
      <Circle cx={x} cy={y} r={r} style="stroke" strokeWidth={2} color={coreV2Board.launcherGate} opacity={0.95} />
      <Circle cx={x} cy={y} r={Math.max(2, r * 0.35)} color={coreV2Board.launcherGlow} opacity={0.7} />
    </Group>
  );
}
