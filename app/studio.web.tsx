import { Platform } from 'react-native';
import { Redirect } from 'expo-router';

import { LevelStudioScreen } from '@/screens/LevelStudioScreen';

/**
 * Web implementation of `/studio`. The Studio renders ONLY when both:
 *   - `__DEV__ === true`  (never in a production/export build), and
 *   - `Platform.OS === 'web'`
 * Otherwise it redirects Home, so the tool can never be reached by a normal
 * production user on any platform.
 */
export default function StudioRouteWeb() {
  if (!(__DEV__ && Platform.OS === 'web')) return <Redirect href="/" />;
  return <LevelStudioScreen />;
}
