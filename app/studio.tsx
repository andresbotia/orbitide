import { Platform } from 'react-native';
import { Redirect } from 'expo-router';

import { StudioEntry } from '@/screens/studioEntry';

/**
 * `/studio` — the internal Level Studio.
 *
 * Renders ONLY when `__DEV__ === true` AND `Platform.OS === 'web'`; otherwise it
 * redirects Home. `StudioEntry` is a platform-split module: `studioEntry.web.tsx`
 * is the real screen, `studioEntry.tsx` is a `null` stub — so a native (iOS /
 * Android) build never bundles the Studio screen, its editor components, or the
 * web-only CanvasKit loader.
 */
export default function StudioRoute() {
  if (!(__DEV__ && Platform.OS === 'web')) return <Redirect href="/" />;
  return <StudioEntry />;
}
