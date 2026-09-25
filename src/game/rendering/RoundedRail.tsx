import { Circle, Group, LinearGradient, Path, RoundedRect, vec } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import {
  measureRoundedPerimeter,
  pointAtMeasuredPerimeterProgress,
  ROUNDED_PERIMETER_BOTTOM_CENTER_PROGRESS,
} from '@/game/geometry/roundedPerimeter';
import { coreV2Board } from '@/theme/coreV2Board';
import type { BoardGeometry } from './boardGeometry';

/**
 * M7A — v2 Core V2 board paint: a light blue track band that frames a deep
 * well. Everything here is static: no animated border, no cyan outline, no
 * glow. The path the Pals travel (`geo.perimeter`) is unchanged — this only
 * paints around it. Legacy V1 keeps `OrbitRail`.
 *
 * Every export renders nothing when `geo.perimeter` is absent (a Legacy V1
 * geometry passed in by mistake) — a silent no-op is safer than crashing.
 */

/** How far the well's edge sits inside the rail centreline (pt). */
function wellInset(geo: BoardGeometry): number {
  const short = Math.min(geo.width, geo.height);
  return Math.max(8, Math.min(12, short * 0.03));
}

/**
 * Track band + well. The band fills the whole canvas as one rounded tile
 * (#7598FF → #5F86FF, inner bevel); the well is the rail interior, inset so
 * the travelling Pals sit on the band rather than over the artwork.
 */
export function RoundedTrack({ geo }: { geo: BoardGeometry }) {
  const p = geo.perimeter;
  if (!p) return null;

  const outerR = trackOuterRadius(geo);
  const inset = wellInset(geo);
  const wx = p.x + inset;
  const wy = p.y + inset;
  const ww = Math.max(0, p.width - inset * 2);
  const wh = Math.max(0, p.height - inset * 2);
  const wr = Math.max(6, p.radius - inset);

  return (
    <Group>
      <RoundedRect x={0} y={0} width={geo.width} height={geo.height} r={outerR}>
        <LinearGradient start={vec(0, 0)} end={vec(0, geo.height)} colors={[coreV2Board.trackTop, coreV2Board.trackBottom]} />
      </RoundedRect>
      {/* Inner bevel: light top edge, shaded bottom edge. */}
      <RoundedRect
        x={1} y={1} width={geo.width - 2} height={geo.height - 2} r={Math.max(0, outerR - 1)}
        style="stroke" strokeWidth={2}
      >
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, geo.height)}
          colors={[coreV2Board.trackBevelLight, 'rgba(255,255,255,0)', 'rgba(255,255,255,0)', coreV2Board.trackBevelShade]}
          positions={[0, 0.08, 0.92, 1]}
        />
      </RoundedRect>
      {/* Seam, then the well with its inset top shadow. */}
      <RoundedRect x={wx - 2} y={wy - 2} width={ww + 4} height={wh + 4} r={wr + 2} color={coreV2Board.wellRim} />
      <RoundedRect x={wx} y={wy} width={ww} height={wh} r={wr}>
        <LinearGradient
          start={vec(0, wy)}
          end={vec(0, wy + wh)}
          colors={['#081638', coreV2Board.fieldCenter, coreV2Board.fieldCenter, coreV2Board.fieldEdge]}
          positions={[0, Math.min(0.2, 6 / Math.max(1, wh)), 0.7, 1]}
        />
      </RoundedRect>
    </Group>
  );
}

/** Outer corner radius of the track band (and of anything that sits under it). */
export function trackOuterRadius(geo: BoardGeometry): number {
  const p = geo.perimeter;
  return p ? p.radius + Math.min(p.x, p.y) : 0;
}

/** Chevron spacing along the band centreline (pt). */
const CHEVRON_STEP = 44;
/** Open-arrow half-height and depth (pt): a ~7pt chevron. */
const CHEVRON_HALF = 3.5;
const CHEVRON_DEPTH = 3;

/**
 * Direction chevrons: small open arrows pointing in travel direction
 * (increasing perimeter progress). They sit on the visible band's own
 * centreline — the band runs from the canvas edge to the well seam, which is
 * not symmetric about the Pal path — and are phased from the launch gate so
 * the gate takes exactly one slot and the spacing is even everywhere else.
 * Static — one path, drawn once per geometry.
 */
export function RoundedRail({ geo }: { geo: BoardGeometry }) {
  const p = geo.perimeter;
  const inset = p ? wellInset(geo) : 0;
  const path = useMemo(() => {
    if (!p) return null;
    // Band spans [-min(x,y), inset - 2] around the Pal path (the seam is the
    // last 2pt before the well); grow the path outward to that span's middle.
    const grow = (Math.min(p.x, p.y) - (inset - 2)) / 2;
    const m = measureRoundedPerimeter({
      x: p.x - grow,
      y: p.y - grow,
      width: p.width + grow * 2,
      height: p.height + grow * 2,
      radius: p.radius + grow,
    });
    if (m.length <= 0) return null;
    const count = Math.round(m.length / CHEVRON_STEP);
    if (count < 4) return null;
    const step = m.length / count;
    const gateAt = ROUNDED_PERIMETER_BOTTOM_CENTER_PROGRESS * m.length;
    const eps = 0.5 / m.length;
    let d = '';
    // Slot 0 is the launch gate itself; every other slot gets a chevron.
    for (let i = 1; i < count; i++) {
      const dist = gateAt + i * step;
      const t = dist / m.length;
      const at = pointAtMeasuredPerimeterProgress(m, t);
      const ahead = pointAtMeasuredPerimeterProgress(m, t + eps);
      const behind = pointAtMeasuredPerimeterProgress(m, t - eps);
      const dx = ahead.x - behind.x;
      const dy = ahead.y - behind.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      // Tip ahead of the point, arms trailing back on either side.
      const tipX = at.x + ux * CHEVRON_DEPTH * 0.5;
      const tipY = at.y + uy * CHEVRON_DEPTH * 0.5;
      const baseX = at.x - ux * CHEVRON_DEPTH * 0.5;
      const baseY = at.y - uy * CHEVRON_DEPTH * 0.5;
      const nx = -uy * CHEVRON_HALF;
      const ny = ux * CHEVRON_HALF;
      d += `M ${(baseX + nx).toFixed(2)} ${(baseY + ny).toFixed(2)} L ${tipX.toFixed(2)} ${tipY.toFixed(2)} L ${(baseX - nx).toFixed(2)} ${(baseY - ny).toFixed(2)} `;
    }
    return d || null;
  }, [p, inset]);

  if (!path) return null;
  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={2}
      strokeCap="round"
      strokeJoin="round"
      color={coreV2Board.chevron}
    />
  );
}

/**
 * The single shared perimeter launcher — bottom-centre of the rounded rect,
 * exactly where `geo.orbitInsertion` sits. v2: a ~22pt amber ring on a shell
 * blue core with a small gold centre. Static.
 */
export function RoundedLauncherGate({ geo }: { geo: BoardGeometry }) {
  if (!geo.perimeter) return null;
  const { x, y } = geo.orbitInsertion;
  const r = Math.max(7, Math.min(11, geo.chargeRadius * 0.68));
  return (
    <Group>
      <Circle cx={x} cy={y} r={r + 3} color={coreV2Board.launcherGate} opacity={0.25} />
      <Circle cx={x} cy={y} r={r} color={coreV2Board.launcherCore} />
      <Circle cx={x} cy={y} r={r - 1.5} style="stroke" strokeWidth={3} color={coreV2Board.launcherGate} />
      <Circle cx={x} cy={y} r={Math.max(2, r * 0.28)} color={coreV2Board.launcherGlow} />
    </Group>
  );
}
