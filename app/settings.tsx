import { router } from 'expo-router';

import { SettingsPlaceholderScreen } from '@/screens/SettingsPlaceholderScreen';

export default function SettingsRoute() {
  return <SettingsPlaceholderScreen onBack={() => router.back()} />;
}
