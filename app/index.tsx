import { useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';

import { HomeScreen } from '@/screens/HomeScreen';
import { useProgress } from '@/hooks/useProgress';

export default function HomeRoute() {
  const { progress, loading, reset, reload } = useProgress();

  // Refresh unlocked level whenever we return to Home (e.g. after a win).
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <HomeScreen
      highestUnlockedLevel={progress.highestUnlockedLevel}
      loading={loading}
      onPlay={() =>
        router.push({
          pathname: '/game',
          params: { level: String(progress.highestUnlockedLevel) },
        })
      }
      onWorlds={() => router.push('/worlds')}
      onSecretReset={() => void reset()}
    />
  );
}
