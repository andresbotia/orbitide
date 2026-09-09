import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { LevelDefinition } from '@/game/engine/types';
import { GameScreen } from '@/screens/GameScreen';
import { StudioButton } from './StudioButton';
import { studioSpace, studioTheme } from './theme';

export interface PlaytestStageProps {
  level: LevelDefinition;
  onExit: () => void;
}

/**
 * Runs a Studio level through the REAL `GameScreen` / `useGameSession` / engine.
 * Loaded lazily behind `<WithSkiaWeb>` (see `StudioPlaytest.tsx`) so CanvasKit is
 * ready before the Skia board mounts. Reset = remount with a fresh key.
 */
export default function PlaytestStage({ level, onExit }: PlaytestStageProps) {
  const [runId, setRunId] = useState(0);
  const reset = () => setRunId((n) => n + 1);

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <Text style={styles.label}>PLAYTEST · Level {level.id} · {level.title}</Text>
        <View style={styles.spacer} />
        <StudioButton label="Reset" compact onPress={reset} />
        <StudioButton label="Back to editor" compact variant="primary" onPress={onExit} />
      </View>
      <View style={styles.stage}>
        <GameScreen
          key={`${level.id}-${runId}`}
          level={level}
          levelId={level.id}
          onWin={() => undefined}
          onAdvance={reset}
          onExit={onExit}
          onResetProgress={() => undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: studioTheme.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: studioSpace.sm,
    paddingHorizontal: studioSpace.lg,
    paddingVertical: studioSpace.sm,
    borderBottomWidth: 1,
    borderBottomColor: studioTheme.border,
    backgroundColor: studioTheme.panel,
  },
  label: { color: studioTheme.textDim, fontSize: 11, fontFamily: studioTheme.mono, letterSpacing: 1 },
  spacer: { flex: 1 },
  stage: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: 480 },
});
