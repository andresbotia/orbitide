import React from 'react';
const mk = (n: string) => (p: any) => React.createElement(n, p, p.children);
export const Canvas = mk('SkCanvas');
export const Group = mk('SkGroup');
export const Rect = mk('SkRect');
export const RoundedRect = mk('SkRRect');
export const Path = mk('SkPath');
export const Circle = mk('SkCircle');
export const Line = mk('SkLine');
export const LinearGradient = mk('SkLinearGradient');
export const RadialGradient = mk('SkRadialGradient');
export const Blur = mk('SkBlur');
export const Shadow = mk('SkShadow');
export const Paint = mk('SkPaint');
export const Image = mk('SkImage');
export const Text = mk('SkText');
export const Fill = mk('SkFill');
export const BlurMask = mk('SkBlurMask');
export const vec = (x: number, y: number) => ({ x, y });
export const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
export const rrect = (r: any, rx: number, ry: number) => ({ rect: r, rx, ry });
export let SKIA_PATH_OPS = 0;
export const resetSkiaOps = () => { SKIA_PATH_OPS = 0; };
const mkPath = (): any => ({
  addRRect(..._a: any[]) { SKIA_PATH_OPS++; }, addRect(..._a: any[]) { SKIA_PATH_OPS++; },
  addCircle(..._a: any[]) { SKIA_PATH_OPS++; }, moveTo(..._a: any[]) { SKIA_PATH_OPS++; },
  lineTo(..._a: any[]) { SKIA_PATH_OPS++; }, arcToOval(..._a: any[]) { SKIA_PATH_OPS++; },
  close(..._a: any[]) { SKIA_PATH_OPS++; },
});
export const Skia = { Path: { Make: mkPath }, Color: (c: any) => c };
export const useImage = () => null;
export const useFont = () => null;
export const Mask = mk('SkMask');
export const Paragraph = mk('SkParagraph');
