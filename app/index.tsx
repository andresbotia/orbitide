import { useCallback } from 'react';
import { router, useFocusEffect, type Href } from 'expo-router';

import { HomeScreen } from '@/screens/HomeScreen';
import { useProgress } from '@/hooks/useProgress';
import { useEconomy } from '@/hooks/useEconomy';

export default function HomeRoute() {
  const { progress, loading, reset, reload } = useProgress();
  const { economy, reload: reloadEconomy } = useEconomy();

  useFocusEffect(
    useCallback(() => {
      void reload();
      void reloadEconomy();
    }, [reload, reloadEconomy]),
  );

  return (
    <HomeScreen
      highestUnlockedLevel={progress.highestUnlockedLevel}
      loading={loading}
      coins={economy.coins}
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
