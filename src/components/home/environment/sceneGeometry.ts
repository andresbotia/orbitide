/**
 * Shared geometry for the Home arcade scene. Pure functions over the viewport
 * only — no React, no Skia — so the layers stay thin and the numbers stay
 * testable. Every layer derives from the same horizon and vanishing point, which
 * is what lets them drift independently without coming apart.
 */

/** Horizon as a fraction of viewport height. The sun sits on this line. */
export const HORIZON_RATIO = 0.52;

/**
 * Vanishing point x as a fraction of layer width: the sun's centre in
 * assets/home-sky.png, so the floor grid converges on the painted sun. The art
 * and the floor share one overscanned frame, so this holds on every width.
 */
export const VANISH_X_RATIO = 0.339;

/** Intrinsic size of the registered Home art (home-sky.png, home-city-b.png). */
export const HOME_ART = { width: 1254, height: 1570 } as const;

/**
 * Ratio between adjacent grid-row distances from the horizon. Rows form a pure
 * geometric series, so scaling the floor by exactly this much about the
 * vanishing point lands row i on row i+1 — the loop reset is invisible.
 */
export const GRID_RATIO = 1.3;

/** Rows drawn below the horizon. The farthest are ~3px apart and fade out. */
export const GRID_ROWS = 20;

/** Verticals converging on the vanishing point, counted across the full floor. */
export const GRID_COLUMNS = 17;

export type NeonTone = 'cyan' | 'magenta' | 'gold';

export interface SceneFrame {
  width: number;
  height: number;
  /** y of the horizon line. */
  horizon: number;
  /** Vanishing point x — the sun's centre, where the floor converges. */
  vanishX: number;
  /** Height of the floor plane, horizon to bottom edge. */
  floorHeight: number;
  sunRadius: number;
}

export function sceneFrame(width: number, height: number): SceneFrame {
  const horizon = Math.round(height * HORIZON_RATIO);
  return {
    width,
    height,
    horizon,
    vanishX: width * VANISH_X_RATIO,
    floorHeight: height - horizon,
    sunRadius: Math.round(width * 0.17),
  };
}

/**
 * Box for the registered sky/city art: full layer width at the art's intrinsic
 * aspect, bottom edge on the horizon. At that aspect resizeMode="cover" crops
 * nothing, so the art's bottom row lands exactly on the grid's horizon and its
 * sun on the vanishing point, on every device height. Anything above the art's
 * top edge falls back to the screen's inkDeep ground.
 */
export function artBox(frame: SceneFrame): Rect {
  const h = (frame.width * HOME_ART.height) / HOME_ART.width;
  return { x: 0, y: frame.horizon - h, w: frame.width, h };
}

const n = (v: number) => v.toFixed(1);

/** Row y positions, nearest (bottom edge) first. Distance from horizon = floorHeight · r^-i. */
export function gridRowOffsets(frame: SceneFrame, rows = GRID_ROWS): number[] {
  const out: number[] = [];
  for (let i = 0; i < rows; i += 1) {
    out.push(frame.horizon + frame.floorHeight * Math.pow(GRID_RATIO, -i));
  }
  return out;
}

/** x where a converging vertical crosses the bottom edge. Fans well past the viewport. */
export function gridColumnBase(frame: SceneFrame, index: number, columns = GRID_COLUMNS): number {
  const mid = (columns - 1) / 2;
  const step = (frame.width * 2.4) / (columns - 1);
  return frame.vanishX + (index - mid) * step;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Building extends Rect {
  windows: Rect[];
}

/**
 * Skyline standing on the horizon, overhanging both edges by 10% for drift.
 * Buildings are shortest at the centre so the sun keeps its silhouette.
 */
export function skyline(frame: SceneFrame): Building[] {
  const rand = seededRandom(0x41524341); // "ARCA"
  const out: Building[] = [];
  let x = -frame.width * 0.1;
  const end = frame.width * 1.1;
  while (x < end) {
    const w = frame.width * (0.06 + rand() * 0.07);
    const fromCentre = Math.abs(x + w / 2 - frame.vanishX) / (frame.width / 2);
    const maxH = frame.height * (0.05 + 0.23 * Math.min(1, fromCentre * 1.3));
    const h = maxH * (0.55 + rand() * 0.45);
    const bx = Math.round(x);
    const by = Math.round(frame.horizon - h);
    const bw = Math.round(w);
    const bh = Math.round(h);

    const windows: Rect[] = [];
    const cols = Math.max(1, Math.floor((bw - 4) / 7));
    const rows = Math.floor((bh - 6) / 9);
    const colStep = (bw - 4) / cols;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (rand() > 0.76) {
          windows.push({ x: Math.round(bx + 2 + c * colStep + (colStep - 3) / 2), y: by + 5 + r * 9, w: 3, h: 4 });
        }
      }
    }

    out.push({ x: bx, y: by, w: bw, h: bh, windows });
    x += w + frame.width * (0.004 + rand() * 0.012);
  }
  return out;
}

export interface NeonSign extends Rect {
  tone: NeonTone;
  /** Horizontal strokes standing in for lettering — abstract, never real text. */
  bars: Rect[];
}

/** Two tall side panels and a small marquee, framing the sun without crowding it. */
export function neonSigns(frame: SceneFrame): NeonSign[] {
  const { width: W, height: H, horizon } = frame;
  const specs: { x: number; y: number; w: number; h: number; tone: NeonTone; lines: number[] }[] = [
    { x: 0.03 * W, y: horizon - 0.21 * H, w: 0.17 * W, h: 0.15 * H, tone: 'cyan', lines: [0.7, 0.85, 0.6, 0.75] },
    { x: 0.8 * W, y: horizon - 0.25 * H, w: 0.17 * W, h: 0.17 * H, tone: 'magenta', lines: [0.8, 0.55, 0.9, 0.65] },
    { x: 0.61 * W, y: horizon - 0.12 * H, w: 0.11 * W, h: 0.035 * H, tone: 'gold', lines: [0.7] },
  ];
  return specs.map((s) => {
    const pad = Math.max(4, s.w * 0.12);
    const lineGap = (s.h - pad * 2) / s.lines.length;
    const barH = Math.max(2, Math.min(4, lineGap * 0.4));
    return {
      x: Math.round(s.x),
      y: Math.round(s.y),
      w: Math.round(s.w),
      h: Math.round(s.h),
      tone: s.tone,
      bars: s.lines.map((frac, i) => ({
        x: Math.round(s.x + pad),
        y: Math.round(s.y + pad + i * lineGap + (lineGap - barH) / 2),
        w: Math.round((s.w - pad * 2) * frac),
        h: barH,
      })),
    };
  });
}

export interface Palm {
  trunk: string;
  fronds: string;
}

/** Two palm silhouettes rooted on the horizon, leaning away from the sun. */
export function palms(frame: SceneFrame): Palm[] {
  const specs = [
    { at: 0.19, lean: -1, scale: 1 },
    { at: 0.85, lean: 1, scale: 0.85 },
  ];
  const spread = [-1, -0.55, -0.1, 0.35, 0.8, 1.05];
  return specs.map(({ at, lean, scale }) => {
    const baseX = frame.width * at;
    const baseY = frame.horizon;
    const h = frame.height * 0.14 * scale;
    const topX = baseX + lean * h * 0.18;
    const topY = baseY - h;
    const r = h * 0.42;
    const trunk = `M ${n(baseX)} ${n(baseY)} Q ${n(baseX + lean * h * 0.02)} ${n(baseY - h * 0.55)} ${n(topX)} ${n(topY)}`;
    const fronds = spread
      .map((dx) => {
        const ex = topX + dx * r;
        const ey = topY + Math.abs(dx) * r * 0.45 - (1 - Math.abs(dx)) * r * 0.15;
        return `M ${n(topX)} ${n(topY)} Q ${n(topX + dx * r * 0.5)} ${n(topY - r * 0.3)} ${n(ex)} ${n(ey)}`;
      })
      .join(' ');
    return { trunk, fronds };
  });
}

/**
 * Deterministic 32-bit PRNG (mulberry32). Star, building and window placement
 * must be stable across renders and between runs — the scene is authored.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
