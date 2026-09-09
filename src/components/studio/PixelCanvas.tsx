import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { OrbColor } from '@/game/engine/types';
import { orbColors } from '@/theme/colors';
import { cellKey } from '@/game/studio/grid';
import type { StudioLevel } from '@/game/studio/types';
import { studioTheme } from './theme';

interface PixelCanvasProps {
  level: StudioLevel;
  tool: { mode: 'paint' | 'erase'; color: OrbColor };
  showCoords: boolean;
  maxPx?: number;
  onPaint: (x: number, y: number) => void;
  onErase: (x: number, y: number) => void;
}

/**
 * The pixel-art board editor. Click a cell to paint / erase; hold and drag to
 * paint a run. Web-only (the Studio route is gated to `__DEV__` + web), so it
 * relies on hover + a window mouseup listener for drag state.
 */
export function PixelCanvas({ level, tool, showCoords, maxPx = 560, onPaint, onErase }: PixelCanvasProps) {
  const down = useRef(false);
  useEffect(() => {
    const up = () => { down.current = false; };
    window.addEventListener('mouseup', up);
    window.addEventListener('mouseleave', up);
    return () => {
      window.removeEventListener('mouseup', up);
      window.removeEventListener('mouseleave', up);
    };
  }, []);

  const cell = useMemo(() => {
    const longest = Math.max(level.width, level.height, 1);
    return Math.max(14, Math.min(40, Math.floor(maxPx / longest)));
  }, [level.width, level.height, maxPx]);

  const apply = useCallback((x: number, y: number) => {
    if (tool.mode === 'erase') onErase(x, y);
    else onPaint(x, y);
  }, [tool.mode, onErase, onPaint]);

  const rows = Array.from({ length: level.height }, (_, y) => y);
  const cols = Array.from({ length: level.width }, (_, x) => x);

  return (
    <View style={styles.wrap}>
      {showCoords ? (
        <View style={[styles.rulerRow, { marginLeft: cell }]}>
          {cols.map((x) => (
            <Text key={x} style={[styles.rulerText, { width: cell }]}>{x}</Text>
          ))}
        </View>
      ) : null}
      <View style={styles.body}>
        {showCoords ? (
          <View style={styles.rulerCol}>
            {rows.map((y) => (
              <Text key={y} style={[styles.rulerText, { height: cell, lineHeight: cell }]}>{y}</Text>
            ))}
          </View>
        ) : null}
        <View style={[styles.grid, { width: level.width * cell, height: level.height * cell }]}>
          {rows.map((y) => (
            <View key={y} style={styles.gridRow}>
              {cols.map((x) => {
                const color = level.cells[cellKey(x, y)];
                return (
                  <Pressable
                    key={x}
                    onPressIn={() => { down.current = true; apply(x, y); }}
                    onHoverIn={() => { if (down.current) apply(x, y); }}
                    style={[
                      styles.cell,
                      { width: cell, height: cell },
                      color ? { backgroundColor: orbColors[color] } : styles.empty,
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>
      <Text style={styles.hint}>
        {tool.mode === 'erase' ? 'ERASE' : `PAINT ${tool.color.toUpperCase()}`} · {level.width}×{level.height} · {Object.keys(level.cells).length} px · click or drag
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
  body: { flexDirection: 'row' },
  grid: {
    borderWidth: 1,
    borderColor: studioTheme.borderStrong,
    backgroundColor: studioTheme.bg,
  },
  gridRow: { flexDirection: 'row' },
  cell: { borderWidth: StyleSheet.hairlineWidth, borderColor: studioTheme.border },
  empty: { backgroundColor: 'transparent' },
  rulerRow: { flexDirection: 'row' },
  rulerCol: { justifyContent: 'flex-start' },
  rulerText: { color: studioTheme.textFaint, fontSize: 9, textAlign: 'center' },
  hint: { color: studioTheme.textDim, fontSize: 11, marginTop: 6, fontFamily: studioTheme.mono },
});
