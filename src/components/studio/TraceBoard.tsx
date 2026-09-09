import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { GameState } from '@/game/engine/types';
import { orbColors } from '@/theme/colors';
import { studioTheme } from './theme';

interface TraceBoardProps {
  /** A real engine frame from a witness trace. */
  frame: GameState;
  /** Pixel ids cleared on the step that produced this frame. */
  cleared?: string[];
  /** Pixel ids newly exposed on that step. */
  exposed?: string[];
  maxPx?: number;
}

/**
 * Read-only board render of one trace frame. Cleared cells fade out; the step's
 * cleared and newly-exposed pixels are ringed. Deliberately plain — this is the
 * internal witness visualiser, not the game board.
 */
export function TraceBoard({ frame, cleared = [], exposed = [], maxPx = 320 }: TraceBoardProps) {
  const clearedSet = useMemo(() => new Set(cleared), [cleared]);
  const exposedSet = useMemo(() => new Set(exposed), [exposed]);
  const cell = Math.max(10, Math.min(34, Math.floor(maxPx / Math.max(frame.width, frame.height, 1))));

  const byPos = useMemo(() => {
    const map = new Map<string, GameState['pixels'][number]>();
    for (const p of frame.pixels) map.set(`${p.x},${p.y}`, p);
    return map;
  }, [frame.pixels]);

  return (
    <View style={[styles.grid, { width: frame.width * cell, height: frame.height * cell }]}>
      {Array.from({ length: frame.height }, (_, y) => (
        <View key={y} style={styles.row}>
          {Array.from({ length: frame.width }, (_, x) => {
            const p = byPos.get(`${x},${y}`);
            const wasCleared = clearedSet.has(p?.id ?? '');
            const isExposed = exposedSet.has(p?.id ?? '');
            return (
              <View
                key={x}
                style={[
                  styles.cell,
                  { width: cell, height: cell },
                  p && !p.cleared ? { backgroundColor: orbColors[p.color] } : undefined,
                  p?.cleared ? styles.gone : undefined,
                  wasCleared ? styles.clearedRing : undefined,
                  isExposed ? styles.exposedRing : undefined,
                ]}
              />
            );
          })}
        </View>
      ))}
      {frame.pixels.length === 0 ? <Text style={styles.empty}>no pixels</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { borderWidth: 1, borderColor: studioTheme.borderStrong, backgroundColor: studioTheme.bg },
  row: { flexDirection: 'row' },
  cell: { borderWidth: StyleSheet.hairlineWidth, borderColor: studioTheme.border },
  gone: { backgroundColor: 'transparent', opacity: 0.15 },
  clearedRing: { borderWidth: 2, borderColor: studioTheme.warning },
  exposedRing: { borderWidth: 2, borderColor: studioTheme.ok },
  empty: { color: studioTheme.textFaint, fontSize: 10, padding: 6 },
});
