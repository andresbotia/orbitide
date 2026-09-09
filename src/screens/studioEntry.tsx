/**
 * Native (and any non-web) placeholder for the Level Studio entry. The Studio is
 * web-only; Metro resolves `studioEntry.web.tsx` on web and this file elsewhere,
 * so `LevelStudioScreen` and every `src/components/studio/*` module — including
 * the web CanvasKit loader — are kept out of the iOS / Android bundle entirely.
 *
 * `app/studio.tsx` also guards on `Platform.OS === 'web'`, so this is never
 * rendered; it exists purely as the native resolution target.
 */
export function StudioEntry(): null {
  return null;
}
