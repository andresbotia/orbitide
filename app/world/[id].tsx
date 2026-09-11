import { useCallback, useEffect } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { WorldLevelsScreen } from '@/screens/WorldLevelsScreen';
import { CAMPAIGN_MANIFEST } from '@/game/levels/campaign';
import { useProgress } from '@/hooks/useProgress';

export default function WorldLevelsRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const { progress, loading, reload } = useProgress();

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const index = CAMPAIGN_MANIFEST.worlds.findIndex((w) => w.id === params.id);
  const world = index >= 0 ? CAMPAIGN_MANIFEST.worlds[index] : undefined;

  // Unknown/stale world id — bounce back to the map rather than render nothing.
  useEffect(() => {
    if (!world) router.replace('/worlds');
  }, [world]);

  if (!world) return null;

  return (
    <WorldLevelsScreen
      world={world}
      displayIndex={index + 1}
      progress={progress}
      loading={loading}
      onSelectLevel={(levelId) =>
        router.push({ pathname: '/game', params: { level: String(levelId) } })
      }
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/worlds'))}
    />
  );
}
