import { Blur, Canvas, Circle, Group, Path, RadialGradient, RoundedRect, vec } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';

import type { ModifierInstance, OrbColor } from '@/game/engine/types';
import { orbColors, orbGlow } from '@/theme/colors';
import { arcade } from '@/theme/arcade';
import { cellCenter, type BoardGeometry } from './boardGeometry';
import { useIdleMotion } from './modifierMotion';
import {
  hashSeed,
  pickIdleAnimated,
  resolveModifier,
  type ModifierRender,
} from './specialPixels';

export interface SpecialPixelInput {
  id: string;
  x: number;
  y: number;
  color: OrbColor;
  modifier: ModifierInstance;
}

interface SpecialPixelLayerProps {
  geo: BoardGeometry;
  /** Live modifier state projected from the engine's board pixels. */
  specials: SpecialPixelInput[];
  reducedMotion?: boolean;
}

/**
 * One shared Skia canvas drawing every special-pixel shell / hardware. The base
 * cube stays an RN view (Pixel.tsx); modifiers are Skia overlays so translucent
 * shells, refraction, frost, facets and brushed metal are cheap and the RN
 * board is untouched. Consumes the pure `resolveModifier` model.
 *
 * Renders nothing when the current board has no special pixels.
 */
export const SpecialPixelLayer = memo(function SpecialPixelLayer({ geo, specials, reducedMotion }: SpecialPixelLayerProps) {
  const resolved = useMemo(
    () => specials.map((s) => ({ ...s, render: resolveModifier({ ...s.modifier, seed: s.modifier.seed ?? hashSeed(s.id) }, geo.density) })),
    [specials, geo.density],
  );
  const idleIds = useMemo(() => pickIdleAnimated(resolved), [resolved]);
  const linkedTethers = useMemo(() => {
    const byId = new Map(specials.map((special) => [special.id, special]));
    return specials.flatMap((special) => {
      if (special.modifier.kind !== 'linked') return [];
      return (special.modifier.linkedPixelIds ?? []).flatMap((partnerId) => {
        if (special.id.localeCompare(partnerId) >= 0) return [];
        const partner = byId.get(partnerId);
        if (!partner) return [];
        return [{
          id: `${special.id}:${partnerId}`,
          from: cellCenter(geo, special.x, special.y),
          to: cellCenter(geo, partner.x, partner.y),
          energized: special.modifier.state === 'primed' || partner.modifier.state === 'primed',
        }];
      });
    });
  }, [specials, geo]);

  if (resolved.length === 0) return null;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {linkedTethers.map((tether) => (
        <Group key={tether.id}>
          <Path
            path={`M ${tether.from.x} ${tether.from.y} L ${tether.to.x} ${tether.to.y}`}
            color={tether.energized ? arcade.accent : arcade.accentDim}
            style="stroke"
            strokeWidth={Math.max(1, geo.cell * (tether.energized ? 0.1 : 0.055))}
            opacity={tether.energized ? 0.82 : 0.42}
          />
          {tether.energized ? (
            <Path
              path={`M ${tether.from.x} ${tether.from.y} L ${tether.to.x} ${tether.to.y}`}
              color="#FFFFFF" style="stroke" strokeWidth={Math.max(1, geo.cell * 0.025)} opacity={0.75}
            />
          ) : null}
        </Group>
      ))}
      {resolved.map((s) => (
        <SpecialShell
          key={s.id}
          center={cellCenter(geo, s.x, s.y)}
          cell={geo.cell}
          color={s.color}
          render={s.render}
          idle={idleIds.has(s.id)}
          reducedMotion={!!reducedMotion}
        />
      ))}
    </Canvas>
  );
});

function SpecialShell({ center, cell, color, render, idle, reducedMotion }: {
  center: { x: number; y: number };
  cell: number;
  color: OrbColor;
  render: ModifierRender;
  idle: boolean;
  reducedMotion: boolean;
}) {
  const bleed = render.overflow * cell;
  const outer = cell + bleed * 2;
  const x = center.x - outer / 2;
  const y = center.y - outer / 2;
  const fill = orbColors[color];
  const glow = orbGlow[color];
  const pulse = useIdleMotion(render.motion ?? 'bombPulse', idle && render.motion !== null, reducedMotion);
  const pulseOpacity = useDerivedValue(() => 0.4 + pulse.value * 0.5);

  // Frozen ice fully cracked — the base pixel (Pixel.tsx) renders as normal.
  if ((render.kind === 'frozen' || render.kind === 'shielded') && render.baseCompromised) return null;

  switch (render.shell) {
    case 'ice':
      return (
        <Group>
          {render.features.frostCloud ? (
            <Group opacity={0.22}>
              <Blur blur={3} />
              <RoundedRect x={x - 2} y={y - 2} width={outer + 4} height={outer + 4} r={cell * 0.3} color="#CFE8FF" />
            </Group>
          ) : null}
          {/* Thick translucent slab: a filled body, a bright bevel, and a heavier
              outer edge so the shell reads as a real volume, not a flat overlay. */}
          <RoundedRect x={x} y={y} width={outer} height={outer} r={cell * 0.26} color="rgba(200,230,255,0.28)" />
          <RoundedRect x={x + outer * 0.14} y={y + outer * 0.14} width={outer * 0.72} height={outer * 0.72} r={cell * 0.2} color="rgba(235,248,255,0.16)" />
          <RoundedRect x={x} y={y} width={outer} height={outer} r={cell * 0.26} color="rgba(220,240,255,0.62)" style="stroke" strokeWidth={Math.max(1.5, cell * (render.detail === 'minimal' ? 0.07 : 0.11))} />
          {render.features.rimLight ? (
            <Path
              path={`M ${x + cell * 0.12} ${y + outer * 0.7} A ${outer * 0.5} ${outer * 0.5} 0 0 1 ${x + outer * 0.7} ${y + cell * 0.12}`}
              color="#FFFFFF" style="stroke" strokeWidth={Math.max(1, cell * 0.05)} opacity={0.55}
            />
          ) : null}
          {Array.from({ length: render.counts.cracks }, (_, i) => {
            const a = (i / Math.max(1, render.counts.cracks)) * Math.PI * 2 + 0.4;
            return (
              <Path key={i} color="rgba(255,255,255,0.7)" style="stroke" strokeWidth={Math.max(1, cell * 0.04)}
                path={`M ${center.x} ${center.y} L ${center.x + Math.cos(a) * outer * 0.5} ${center.y + Math.sin(a) * outer * 0.42} l ${Math.cos(a + 1) * cell * 0.2} ${Math.sin(a + 1) * cell * 0.2}`} />
            );
          })}
          {render.detailPoints.slice(0, render.counts.bubbles).map((d, i) => (
            <Circle key={`b${i}`} cx={center.x + d.x * cell} cy={center.y + d.y * cell} r={d.r * cell} color="rgba(255,255,255,0.4)" style="stroke" strokeWidth={1} />
          ))}
        </Group>
      );

    case 'membrane': {
      // Separate outer membrane + inner boundary leaves a visible air gap around
      // the cube. Facet seams and a short arc keep it volumetric at full detail.
      const inset = Math.max(2, cell * 0.1);
      return (
        <Group opacity={render.progression >= 1 ? 0 : 1}>
          <RoundedRect x={x} y={y} width={outer} height={outer} r={cell * 0.34} color={`${glow}22`} />
          <RoundedRect x={x} y={y} width={outer} height={outer} r={cell * 0.34} color={glow} style="stroke" strokeWidth={Math.max(1, cell * 0.05)} opacity={0.7} />
          {render.features.airGap ? (
            <RoundedRect x={x + inset} y={y + inset} width={outer - inset * 2} height={outer - inset * 2}
              r={cell * 0.24} color="#07060D" style="stroke" strokeWidth={Math.max(1, cell * 0.035)} opacity={0.6} />
          ) : null}
          {render.detail !== 'minimal' ? (
            <Path path={`M ${x + outer * 0.1} ${center.y} L ${center.x} ${y + outer * 0.08} L ${x + outer * 0.9} ${center.y}`}
              color={glow} style="stroke" strokeWidth={Math.max(1, cell * 0.025)} opacity={0.28} />
          ) : null}
          <Path path={`M ${x + outer * 0.2} ${y + outer * 0.22} q ${outer * 0.2} ${-outer * 0.12} ${outer * 0.4} 0`} color="#FFFFFF" style="stroke" strokeWidth={Math.max(1, cell * 0.04)} opacity={0.5} />
          {render.features.microArc ? (
            <Path path={`M ${x + outer * 0.72} ${y + outer * 0.2} l ${-cell * 0.08} ${cell * 0.13} l ${cell * 0.12} ${cell * 0.08}`}
              color="#FFFFFF" style="stroke" strokeWidth={Math.max(1, cell * 0.035)} opacity={0.75} />
          ) : null}
        </Group>
      );
    }

    case 'plates':
      return (
        <Group>
          {Array.from({ length: render.counts.plates }, (_, i) => {
            const corners = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;
            const [cxr, cyr] = corners[i % 4]!;
            const ps = cell * 0.42;
            const px = x + cxr * (outer - ps);
            const py = y + cyr * (outer - ps);
            return (
              <Group key={i}>
                <RoundedRect x={px} y={py} width={ps} height={ps} r={cell * 0.08} color={arcade.metalRaised} />
                <RoundedRect x={px} y={py} width={ps} height={ps} r={cell * 0.08} color={arcade.metalHi} style="stroke" strokeWidth={1} />
                {render.counts.bolts > 0 ? (
                  <Circle cx={px + ps * 0.5} cy={py + ps * 0.5} r={Math.max(1, cell * 0.05)} color={arcade.metalLo} />
                ) : null}
              </Group>
            );
          })}
          <Circle cx={center.x} cy={center.y} r={cell * 0.16} color={fill} opacity={0.9} />
        </Group>
      );

    case 'clamp':
      return (
        <Group opacity={render.progression >= 1 ? 0.2 : 1}>
          <RoundedRect x={x} y={y - bleed} width={outer} height={cell * 0.28} r={cell * 0.08} color={arcade.metalRaised} />
          <RoundedRect x={x} y={y + outer - cell * 0.28 + bleed} width={outer} height={cell * 0.28} r={cell * 0.08} color={arcade.metalRaised} />
          {render.features.pinGlow ? (
            <Circle cx={center.x} cy={center.y} r={cell * 0.12} color={arcade.accent}>
              <Blur blur={2} />
            </Circle>
          ) : null}
        </Group>
      );

    case 'cavity':
      return (
        <Group>
          <Circle cx={center.x} cy={center.y} r={cell * 0.34}>
            <RadialGradient c={vec(center.x, center.y - cell * 0.08)} r={cell * 0.4} colors={['#05060B', '#1A1020']} />
          </Circle>
          <Circle cx={center.x} cy={center.y} r={cell * 0.34} color={arcade.metalHi} style="stroke" strokeWidth={Math.max(1, cell * 0.06)} />
          <Path path={`M ${center.x - cell * 0.3} ${center.y - cell * 0.12} A ${cell * 0.32} ${cell * 0.32} 0 0 1 ${center.x + cell * 0.28} ${center.y - cell * 0.18}`} color="#FFFFFF" style="stroke" strokeWidth={1} opacity={0.4} />
          {render.features.ledRing ? (
            <Circle cx={center.x} cy={center.y} r={cell * 0.24} color={render.progression >= 1 ? arcade.danger : arcade.warn} style="stroke" strokeWidth={Math.max(1, cell * 0.04)} opacity={pulseOpacity} />
          ) : null}
        </Group>
      );

    case 'crystal':
      return (
        <Group>
          {render.detailPoints.slice(0, render.counts.facets).map((d, i) => {
            const a0 = d.rot;
            const a1 = d.rot + 1.2;
            return (
              <Path key={i} color="rgba(255,255,255,0.14)"
                path={`M ${center.x} ${center.y} L ${center.x + Math.cos(a0) * cell * 0.5} ${center.y + Math.sin(a0) * cell * 0.5} L ${center.x + Math.cos(a1) * cell * 0.5} ${center.y + Math.sin(a1) * cell * 0.5} Z`} />
            );
          })}
          <RoundedRect x={x} y={y} width={outer} height={outer} r={cell * 0.12} color="rgba(255,255,255,0.5)" style="stroke" strokeWidth={Math.max(1, cell * 0.05)} />
          {render.features.travelingHighlight ? (
            <Path path={`M ${x} ${y + outer * 0.3} L ${x + outer} ${y + outer * 0.1}`} color="#FFFFFF" style="stroke" strokeWidth={Math.max(1, cell * 0.06)} opacity={0.6} />
          ) : null}
        </Group>
      );

    case 'socket':
      return (
        <Group>
          {Array.from({ length: render.counts.sockets }, (_, i) => {
            const edge = i === 0 ? -1 : 1;
            return (
              <RoundedRect key={i} x={center.x - cell * 0.14} y={center.y + edge * outer * 0.5 - cell * 0.08} width={cell * 0.28} height={cell * 0.16} r={cell * 0.04} color={arcade.metalRaised} />
            );
          })}
          {render.features.conduit ? (
            <Path path={`M ${center.x} ${center.y - outer * 0.5} L ${center.x} ${center.y + outer * 0.5}`} color={arcade.accentDim} style="stroke" strokeWidth={Math.max(1, cell * 0.06)} opacity={0.7} />
          ) : null}
          <Circle cx={center.x} cy={center.y - outer * 0.5 + render.link!.linkProgress * outer} r={Math.max(1.5, cell * 0.06)} color={arcade.accent} opacity={pulseOpacity} />
        </Group>
      );

    case 'pane':
      return (
        <Group>
          <RoundedRect x={x} y={y} width={outer} height={outer} r={cell * 0.14} color={`${fill}22`} opacity={render.concealment} />
          <RoundedRect x={x} y={y} width={outer} height={outer} r={cell * 0.14} color={arcade.glassEdge} style="stroke" strokeWidth={1} />
          {Array.from({ length: render.counts.scanlines }, (_, i) => {
            const ly = y + ((i + 1) / (render.counts.scanlines + 1)) * outer;
            return <Path key={i} path={`M ${x} ${ly} L ${x + outer} ${ly}`} color="#FFFFFF" style="stroke" strokeWidth={1} opacity={0.18} />;
          })}
        </Group>
      );

    default:
      return null;
  }
}
