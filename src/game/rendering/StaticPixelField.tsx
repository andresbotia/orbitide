import { Canvas, Group, Path, Skia, rect, rrect, type SkPath } from '@shopify/react-native-skia';
import { memo, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import type { Pixel } from '@/game/engine/types';
import { markContrast, markDetail, simplifiedMark, type MarkDetail, type MarkPart } from '@/theme/colorAssist';
import { pixelMaterial } from '@/theme/arcade';
import type { BoardGeometry } from './boardGeometry';
import { buildPixelBuckets, DIM_STEPS, sameMembers } from './pixelField';

/**
 * Every resting board pixel, drawn as a handful of batched Skia paths inside a
 * single canvas.
 *
 * Why this exists: the previous renderer emitted one `<Pixel>` React subtree per
 * cell — measured at **3.14 native views each, 2,415 views on a 28x28 board**.
 * One pixel clear produced a new `state.pixels` array, which re-created all 770
 * elements and reconciled every one: **14.6 ms of JS per clear** on desktop V8,
 * before the native view diff and shadow-tree layout that run on the UI thread.
 * That was the board's "blocky" feel, and the 254 ms mount was most of the
 * Home -> Gameplay delay.
 *
 * Pixels are bucketed by everything that affects their paint — colour,
 * reachability, modifier dim — so each bucket draws as one set of paths. A
 * bucket's paths are rebuilt only when that bucket's membership actually
 * changes, which for a single clear is one bucket out of ~16. Cleared pixels and
 * pixels an active flight is popping are simply absent from the buckets; the
 * popping ones are still drawn by the flight's own animated `Pixel`, so hit and
 * final-clear feedback is untouched.
 *
 * Geometry is unchanged: same cell centres, same `cell - gutter` size, same
 * adaptive corner radius, bevel, highlight/shade bands and reachability rim as
 * `Pixel.tsx` draws, so the resting board is the same picture.
 */
interface StaticPixelFieldProps {
  pixels: readonly Pixel[];
  geo: BoardGeometry;
  /** Pixel ids an active flight will pop — that flight renders them instead. */
  hiddenIds: ReadonlySet<string>;
  /** 0..1 presence compromise per pixel id (locked desaturation, concealment). */
  dimById: ReadonlyMap<string, number>;
  /** Reachability, resolved by the caller from the engine's exterior mask. */
  isReachable: (pixel: Pixel) => boolean;
  colorAssist: boolean;
}

/** A bucket's built paths, already wrapped in the subtree that draws them. */
interface CacheEntry {
  /** The membership this subtree was built for. */
  members: number[];
  node: ReactNode;
}

/** Trace the top + left of one rounded rect as an open sub-path. */
function addLightBevel(path: SkPath, x: number, y: number, size: number, r: number): void {
  const right = x + size;
  const bottom = y + size;
  if (r <= 0.01) {
    path.moveTo(x, bottom);
    path.lineTo(x, y);
    path.lineTo(right, y);
    return;
  }
  const d = r * 2;
  path.moveTo(x, bottom - r);
  path.lineTo(x, y + r);
  path.arcToOval(rect(x, y, d, d), 180, 90, false);
  path.lineTo(right - r, y);
  path.arcToOval(rect(right - d, y, d, d), 270, 90, false);
}

/** Trace the bottom + right of one rounded rect as an open sub-path. */
function addDarkBevel(path: SkPath, x: number, y: number, size: number, r: number): void {
  const right = x + size;
  const bottom = y + size;
  if (r <= 0.01) {
    path.moveTo(right, y);
    path.lineTo(right, bottom);
    path.lineTo(x, bottom);
    return;
  }
  const d = r * 2;
  path.moveTo(right, y + r);
  path.lineTo(right, bottom - r);
  path.arcToOval(rect(right - d, bottom - d, d, d), 0, 90, false);
  path.lineTo(x + r, bottom);
  path.arcToOval(rect(x, bottom - d, d, d), 90, 90, false);
}

/**
 * Append one Color Assist mark, centred on a cell, to a shared path.
 *
 * Mirrors `ColorAssistMark`'s view geometry part for part. Stroked parts (bar,
 * ring, outline triangle/square, arc) are traced as outlines and stroked by the
 * caller; filled parts (dot, filled triangle/square) are closed and filled. The
 * two are kept in separate paths so one stroke width applies cleanly.
 */
function addMark(stroke: SkPath, fill: SkPath, parts: readonly MarkPart[], cx: number, cy: number, s: number): void {
  for (const part of parts) {
    switch (part.p) {
      case 'dot': {
        fill.addCircle(cx, cy, (s * 0.34 * (part.scale ?? 1)) / 2);
        break;
      }
      case 'ring': {
        stroke.addCircle(cx, cy, (s * 0.66 * (part.scale ?? 1)) / 2);
        break;
      }
      case 'bar': {
        const len = s * (part.len ?? 0.62);
        const [ox, oy] = part.offset ?? [0, 0];
        const a = (part.angle * Math.PI) / 180;
        const dx = (Math.cos(a) * len) / 2;
        const dy = (Math.sin(a) * len) / 2;
        const mx = cx + ox * s;
        const my = cy + oy * s;
        stroke.moveTo(mx - dx, my - dy);
        stroke.lineTo(mx + dx, my + dy);
        break;
      }
      case 'tri': {
        const up = part.dir === 'up';
        const w = s * 0.3;
        const h = s * 0.52;
        const shift = up ? -h * 0.12 : h * 0.12;
        const apexY = (up ? cy - h / 2 : cy + h / 2) + shift;
        const baseY = (up ? cy + h / 2 : cy - h / 2) + shift;
        const target = part.fill ? fill : stroke;
        target.moveTo(cx, apexY);
        target.lineTo(cx + w, baseY);
        target.lineTo(cx - w, baseY);
        target.close();
        break;
      }
      case 'sq': {
        const d = s * 0.46;
        const a = (part.angle * Math.PI) / 180;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const h = d / 2;
        const target = part.fill ? fill : stroke;
        const corners: readonly [number, number][] = [[-h, -h], [h, -h], [h, h], [-h, h]];
        for (let i = 0; i < corners.length; i += 1) {
          const [px, py] = corners[i]!;
          const rx = cx + px * cos - py * sin;
          const ry = cy + px * sin + py * cos;
          if (i === 0) target.moveTo(rx, ry);
          else target.lineTo(rx, ry);
        }
        target.close();
        break;
      }
      case 'arc': {
        // The view renderer draws a half-capsule: the lower half for `up`
        // (bottom borders + bottom radii), the upper half for `down`.
        const w = s * 0.62;
        const h = s * 0.36;
        stroke.arcToOval(rect(cx - w / 2, cy - h / 2, w, h), part.dir === 'down' ? 180 : 0, 180, true);
        break;
      }
    }
  }
}

export const StaticPixelField = memo(function StaticPixelField({
  pixels, geo, hiddenIds, dimById, isReachable, colorAssist,
}: StaticPixelFieldProps) {
  // One O(n) pass groups every drawn pixel by its paint variant. Measured at
  // ~0.35 ms on 770 cells, so it is cheap to redo per commit; it is the path
  // building and element creation this bucketing exists to avoid repeating.
  const buckets = useMemo(
    () => buildPixelBuckets(pixels, hiddenIds, dimById, isReachable),
    [pixels, hiddenIds, dimById, isReachable],
  );

  const { adaptive, cell, gridOrigin, density } = geo;
  const size = Math.max(4, cell - adaptive.gutter);
  const bevel = Math.min(adaptive.bevel, size * 0.22);
  const cornerRadius = Math.max(1.5, cell * adaptive.cornerRadius);
  const markSize = Math.max(6, cell * 0.52);
  const detail: MarkDetail = markDetail(density);

  // Cache of built paths AND the rendered subtree per bucket. Reusing the
  // element itself is what lets React bail out of the ~16 buckets a single
  // clear does not touch, instead of re-creating every `<Path>` each commit.
  // Dropped wholesale when the board's geometry changes (resize, level change).
  const cache = useRef(new Map<string, CacheEntry>());
  const signature = `${cell}|${gridOrigin.x}|${gridOrigin.y}|${size}|${bevel}|${cornerRadius}|${colorAssist}|${detail}`;
  const cachedSignature = useRef(signature);
  if (cachedSignature.current !== signature) {
    cache.current = new Map();
    cachedSignature.current = signature;
  }

  const layers = useMemo<ReactNode[]>(() => {
    const next = new Map<string, CacheEntry>();
    const nodes: ReactNode[] = [];

    const bandInset = Math.min(cornerRadius * 0.5, size * 0.2);
    const bandWidth = Math.max(1, size - bandInset * 2);
    const bandRadius = Math.max(0.5, cornerRadius * 0.6);
    const rimInset = Math.max(0.5, bevel * 0.4);
    const bevelSize = Math.max(1, size - bevel);
    const bevelRadius = Math.max(0, cornerRadius - bevel / 2);

    for (const [key, bucket] of buckets) {
      const hit = cache.current.get(key);
      if (hit && sameMembers(hit.members, bucket.members)) {
        next.set(key, hit);
        nodes.push(hit.node);
        continue;
      }

      const base = Skia.Path.Make();
      const bevelLight = Skia.Path.Make();
      const bevelDark = Skia.Path.Make();
      const highlight = Skia.Path.Make();
      const shade = Skia.Path.Make();
      const rim = bucket.reachable ? Skia.Path.Make() : null;
      const assist = colorAssist ? simplifiedMark(bucket.color, detail) : null;
      const markStroke = assist ? Skia.Path.Make() : null;
      const markFill = assist ? Skia.Path.Make() : null;

      for (const index of bucket.members) {
        const p = pixels[index]!;
        const cx = gridOrigin.x + p.x * cell + cell / 2;
        const cy = gridOrigin.y + p.y * cell + cell / 2;
        const left = cx - size / 2;
        const top = cy - size / 2;

        base.addRRect(rrect(rect(left, top, size, size), cornerRadius, cornerRadius));
        addLightBevel(bevelLight, left + bevel / 2, top + bevel / 2, bevelSize, bevelRadius);
        addDarkBevel(bevelDark, left + bevel / 2, top + bevel / 2, bevelSize, bevelRadius);
        highlight.addRRect(rrect(
          rect(left + bandInset, top + bevel, bandWidth, size * 0.42),
          bandRadius, bandRadius,
        ));
        shade.addRRect(rrect(
          rect(left + bandInset, top + size - bevel - size * 0.32, bandWidth, size * 0.32),
          bandRadius, bandRadius,
        ));
        rim?.addRRect(rrect(
          rect(left + rimInset, top + rimInset, size - rimInset * 2, size - rimInset * 2),
          Math.max(1, cornerRadius - 1), Math.max(1, cornerRadius - 1),
        ));
        if (markStroke && markFill && assist) {
          addMark(markStroke, markFill, assist.parts, cx, cy, markSize);
        }
      }

      const material = pixelMaterial(bucket.color);
      const dim = bucket.dimStep / DIM_STEPS;
      // Identical to `Pixel.tsx`'s resting opacity and rim strength.
      const restOpacity = (bucket.reachable ? 1 : 0.62) * (1 - dim * 0.55);
      const rimOpacity = (0.35 + adaptive.glow * 0.5) * (1 - dim);
      const contrast = markContrast(bucket.color);
      const markStrokeWidth = Math.max(1, markSize * Math.max(assist?.minStroke ?? 0.09, 0.09));

      const node = (
        <Group key={key} opacity={restOpacity}>
          <Path path={base} color={material.base} />
          <Path path={bevelDark} color={material.bottom} style="stroke" strokeWidth={bevel} />
          <Path path={bevelLight} color={material.top} style="stroke" strokeWidth={bevel} />
          <Path path={highlight} color={material.top} opacity={adaptive.highlight} />
          <Path path={shade} color={material.bottom} opacity={adaptive.shadow} />
          {rim ? (
            <Path
              path={rim}
              color={material.rim}
              style="stroke"
              strokeWidth={Math.max(1, bevel * 0.8)}
              opacity={rimOpacity}
            />
          ) : null}
          {markStroke ? (
            <Path
              path={markStroke}
              color={contrast.fill}
              style="stroke"
              strokeWidth={markStrokeWidth}
              strokeCap="round"
              strokeJoin="round"
            />
          ) : null}
          {markFill ? <Path path={markFill} color={contrast.fill} /> : null}
        </Group>
      );

      const entry: CacheEntry = { members: bucket.members, node };
      next.set(key, entry);
      nodes.push(node);
    }

    cache.current = next;
    return nodes;
  }, [
    buckets, pixels, cell, gridOrigin, size, bevel, cornerRadius,
    colorAssist, detail, markSize, adaptive.glow, adaptive.highlight, adaptive.shadow,
  ]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {layers}
    </Canvas>
  );
});
