import {
  Canvas,
  Group,
  LinearGradient,
  RadialGradient,
  RoundedRect,
  vec,
} from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { AmbientChargeSpec, HomeLayout, LevelPreview } from '@/game/rendering/homeGeometry';
import { previewGrid } from '@/game/rendering/homeGeometry';
import { orbColors } from '@/theme/colors';
import { pixelMaterial } from '@/theme/arcade';
import { material } from '@/theme/material';
import { PortalMotes } from './PortalMotes';

interface HomeCenterpieceProps {
  layout: HomeLayout;
  preview: LevelPreview;
  specs: AmbientChargeSpec[];
  /** Faint environmental hint only — never recolors the housing/window materials. */
  worldAccent: string;
  active: boolean;
  reducedMotion: boolean;
  /** 0 idle, ramps to 1 on PLAY press for the activation response. */
  activation: SharedValue<number>;
}

/**
 * PIXEL ARCADIA HOME CENTERPIECE (UI-R2) — the arcade-portal window the
 * player is about to enter. Replaces the old orbital-machine housing (rail
 * groove, sweep arc, "LaunchHub" circle motif) with a dimensional block
 * housing around a recessed level-preview window: material-token bevel
 * lighting (upper-left highlight, lower-right shadow), a warm inner glow, a
 * cyan accent boundary ring, and a faint world-accent aura on the outer edge
 * only. Not a literal recreation of the app icon — a UI language derived
 * from it. The live board-preview data pipeline (`homeLevelPreview`/
 * `previewGrid`, real authored pixel art) is unchanged from the previous
 * milestone — that "real puzzle behind glass" idea was already the right
 * one, only the housing around it changes.
 */
export const HomeCenterpiece = memo(function HomeCenterpiece({
  layout, preview, specs, worldAccent, active, reducedMotion, activation,
}: HomeCenterpieceProps) {
  const { center, machineRadius: R, orbitRadius } = layout;
  const side = R * 2;
  const cornerR = R * 0.26;
  const windowCornerR = Math.max(6, cornerR * 0.6);

  const breath = useSharedValue(0.5);

  useEffect(() => {
    cancelAnimation(breath);
    if (!active) return;
    breath.set(withRepeat(
      withTiming(1, { duration: reducedMotion ? 5200 : 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    ));
    return () => cancelAnimation(breath);
  }, [active, reducedMotion, breath]);

  const grid = useMemo(() => previewGrid(preview, { size: layout.preview.size }), [preview, layout.preview.size]);

  // Window box, local to the housing's own (0,0)-(side,side) canvas frame.
  const win = {
    x: R - layout.preview.size / 2,
    y: R - layout.preview.size / 2,
    size: layout.preview.size,
  };

  const glowOpacity = useDerivedValue(() => 0.35 + breath.value * 0.25 + activation.value * 0.4);
  const ringOpacity = useDerivedValue(() => 0.45 + breath.value * 0.15 + activation.value * 0.4);
  const previewTransform = useDerivedValue(() => {
    const s = 1 + (breath.value - 0.5) * 0.018 + activation.value * 0.045;
    return [{ scale: s }];
  });

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { left: center.x - R, top: center.y - R, width: side, height: side }]}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Outer housing — dimensional block, corner-to-corner directional lighting. */}
        <RoundedRect x={1} y={1} width={side - 2} height={side - 2} r={cornerR}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(side, side)}
            colors={[material.raisedSurface, material.structuralSurface, material.recessedSurface]}
          />
        </RoundedRect>
        {/* Bevel edge: upper-left highlight, lower-right shadow, in one diagonal stroke. */}
        <RoundedRect x={1} y={1} width={side - 2} height={side - 2} r={cornerR} style="stroke" strokeWidth={2}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(side, side)}
            colors={[material.bevelHighlight, material.outline, material.bevelShadow]}
          />
        </RoundedRect>

        {/* Faint world-accent aura on the OUTER edge only — environment hint, not a recolor. */}
        <RoundedRect x={-3} y={-3} width={side + 6} height={side + 6} r={cornerR + 3} style="stroke" strokeWidth={3} color={worldAccent} opacity={0.16} />

        {/* Recessed window. */}
        <RoundedRect x={win.x} y={win.y} width={win.size} height={win.size} r={windowCornerR} color={material.recessedSurface} />

        {/* Warm inner glow behind the artwork, breathing + press-activated. */}
        <Group opacity={glowOpacity}>
          <RoundedRect
            x={win.x - win.size * 0.08}
            y={win.y - win.size * 0.08}
            width={win.size * 1.16}
            height={win.size * 1.16}
            r={windowCornerR}
          >
            <RadialGradient
              c={vec(R, R)}
              r={win.size * 0.7}
              colors={[material.energyGlow, 'rgba(255,178,77,0)']}
            />
          </RoundedRect>
        </Group>

        {/* Current-level preview — real authored board data, inside the window. */}
        <Group origin={vec(R, R)} transform={previewTransform}>
          {preview.cells.map((c) => {
            const m = pixelMaterial(c.color);
            const size = Math.max(2, grid.cell - (preview.simplify ? 0.6 : 1.4));
            const x = win.x + grid.originX + c.x * grid.cell;
            const y = win.y + grid.originY + c.y * grid.cell;
            const rad = preview.simplify ? 1 : Math.max(1.5, grid.cell * 0.22);
            return (
              <Group key={`${c.x},${c.y}`}>
                <RoundedRect x={x} y={y} width={size} height={size} r={rad} color={orbColors[c.color]} />
                {preview.simplify ? null : (
                  <RoundedRect x={x} y={y} width={size} height={size * 0.4} r={rad} color={m.top} opacity={0.3} />
                )}
              </Group>
            );
          })}
        </Group>

        {/* Cyan accent boundary — the portal's "informational" edge. */}
        <Group opacity={ringOpacity}>
          <RoundedRect x={win.x} y={win.y} width={win.size} height={win.size} r={windowCornerR} style="stroke" strokeWidth={1.5} color={material.accentCyan} />
        </Group>
      </Canvas>

      <PortalMotes specs={specs} center={{ x: R, y: R }} restRadius={orbitRadius} active={active} reducedMotion={reducedMotion} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
});
