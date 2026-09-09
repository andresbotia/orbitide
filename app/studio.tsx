import { Redirect } from 'expo-router';

/**
 * The Level Studio is a **dev-only, web-only** internal developer tool.
 *
 * This file is the native (and any non-web) implementation of the `/studio`
 * route: it does nothing but redirect Home, and — because Metro resolves
 * `studio.web.tsx` for web and this file everywhere else — the Studio screen and
 * all of its editor code are never bundled into an iOS or Android build.
 */
export default function StudioRouteNative() {
  return <Redirect href="/" />;
}
