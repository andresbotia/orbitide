import { useCallback } from 'react';
import { router, useFocusEffect, type Href } from 'expo-router';

import { HomeScreen } from '@/screens/HomeScreen';
import { useProgress } from '@/hooks/useProgress';

export default function HomeRoute() {
  const { progress, loading, reset, reload } = useProgress();

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
      onShop={() => router.replace('/shop' as Href)}
      onLeaderboard={() => router.replace('/leaderboard' as Href)}
      onSettings={() => router.push('/settings' as Href)}
      onSecretReset={() => void reset()}
    />
  );
}
