import { useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { GameScreen } from '@/screens/GameScreen';
import { useProgress } from '@/hooks/useProgress';
import { FIRST_LEVEL, levelExists } from '@/game/levels/levels';

export default function GameRoute() {
  const params = useLocalSearchParams<{ level?: string }>();
  const { completeLevel, reset } = useProgress();

  const parsed = Number.parseInt(params.level ?? '', 10);
  const levelId =
    Number.isFinite(parsed) && levelExists(parsed) ? parsed : FIRST_LEVEL;

  const handleWin = useCallback(
    (completed: number) => {
      void completeLevel(completed);
    },
    [completeLevel],
  );

  const handleAdvance = useCallback((nextId: number) => {
    router.setParams({ level: String(nextId) });
  }, []);

  const handleExit = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  return (
    <GameScreen
      key={levelId}
      levelId={levelId}
      onWin={handleWin}
      onAdvance={handleAdvance}
      onExit={handleExit}
      onResetProgress={() => void reset()}
    />
  );
}
