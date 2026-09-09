import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { OrbColor } from '@/game/engine/types';
import { cellKey } from '@/game/studio/grid';
import { MODIFIER_SPECS } from '@/game/studio/modifiers';
import type { StudioLevel } from '@/game/studio/types';
import type { CanvasMode } from '@/hooks/useLevelStudio';
import { orbColors } from '@/theme/colors';
import { studioTheme } from './theme';

interface PixelCanvasProps {
  level: StudioLevel;
  tool: { mode: 'paint' | 'erase'; color: OrbColor };
  showCoords: boolean;
  canvasMode: CanvasMode;
  selectedCell?: { x: number; y: number } | null;
  selectedNode?: number | null;
  maxPx?: number;
  onPaint: (x: number, y: number) => void;
  onErase: (x: number, y: number) => void;
  onModifierCell: (x: number, y: number) => void;
  onRevealCell: (x: number, y: number) => void;
}

/**
 * The pixel-art board editor. Click a cell to paint / erase / apply a modifier /
 * drop a reveal node depending on the active canvas mode. Hold and drag paints a
 * run (PIXELS mode only). Web-only.
 */
export function PixelCanvas({
  level, tool, showCoords, canvasMode, selectedCell, selectedNode, maxPx = 560,
  onPaint, onErase, onModifierCell, onRevealCell,
}: PixelCanvasProps) {
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

  const apply = useCallback((x: number, y: number, drag: boolean) => {
    if (canvasMode === 'modifiers') { if (!drag) onModifierCell(x, y); return; }
    if (canvasMode === 'reveal') { if (!drag) onRevealCell(x, y); return; }
    if (tool.mode === 'erase') onErase(x, y);
    else onPaint(x, y);
  }, [canvasMode, tool.mode, onErase, onPaint, onModifierCell, onRevealCell]);

  const rows = Array.from({ length: level.height }, (_, y) => y);
  const cols = Array.from({ length: level.width }, (_, x) => x);
  const reveal = level.reveal;

  return (
    <View style={styles.wrap}>
      {showCoords ? (
        <View style={[styles.rulerRow, { marginLeft: cell }]}>
          {cols.map((x) => (<Text key={x} style={[styles.rulerText, { width: cell }]}>{x}</Text>))}
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
                const mod = level.modifiers?.[cellKey(x, y)];
                const sel = selectedCell && selectedCell.x === x && selectedCell.y === y;
                return (
                  <Pressable
                    key={x}
                    onPressIn={() => { down.current = true; apply(x, y, false); }}
                    onHoverIn={() => { if (down.current) apply(x, y, true); }}
                    style={[
                      styles.cell,
                      { width: cell, height: cell },
                      color ? { backgroundColor: orbColors[color] } : styles.empty,
                      sel && styles.selectedCell,
                    ]}
                  >
                    {mod ? (
                      <Text style={[styles.marker, { fontSize: Math.max(9, cell * 0.5) }]}>
                        {MODIFIER_SPECS[mod.kind].marker}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}

          {/* Reveal overlay — lines then nodes, positioned in cell units. */}
          {reveal ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {reveal.lines.map(([a, b], i) => {
                const na = reveal.nodes[a];
                const nb = reveal.nodes[b];
                if (!na || !nb) return null;
                const x1 = (na.x + 0.5) * cell;
                const y1 = (na.y + 0.5) * cell;
                const x2 = (nb.x + 0.5) * cell;
                const y2 = (nb.y + 0.5) * cell;
                const len = Math.hypot(x2 - x1, y2 - y1);
                const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
                return (
                  <View
                    key={`l${i}`}
                    style={{
                      position: 'absolute',
                      left: (x1 + x2) / 2 - len / 2,
                      top: (y1 + y2) / 2 - 1,
                      width: len, height: 2,
                      backgroundColor: studioTheme.accent, opacity: 0.8,
                      transform: [{ rotateZ: `${ang}deg` }],
                    }}
                  />
                );
              })}
              {reveal.nodes.map((n, i) => {
                const accent = (reveal.accentNodes ?? []).includes(i);
                const isSel = selectedNode === i;
                const s = accent ? 12 : 9;
                return (
                  <View
                    key={`n${i}`}
                    style={{
                      position: 'absolute',
                      left: (n.x + 0.5) * cell - s / 2,
                      top: (n.y + 0.5) * cell - s / 2,
                      width: s, height: s, borderRadius: s,
                      backgroundColor: accent ? studioTheme.warning : studioTheme.text,
                      borderWidth: isSel ? 2 : 0, borderColor: studioTheme.accent,
                    }}
                  />
                );
              })}
            </View>
          ) : null}
        </View>
      </View>
      <Text style={styles.hint}>
        {canvasMode === 'modifiers' ? 'MODIFIERS · tap a pixel to apply the brush'
          : canvasMode === 'reveal' ? 'REVEAL · tap the board to drop a constellation node'
            : tool.mode === 'erase' ? 'ERASE' : `PAINT ${tool.color.toUpperCase()}`}
        {' · '}{level.width}×{level.height} · {Object.keys(level.cells).length} px
        {level.modifiers ? ` · ${Object.keys(level.modifiers).length} special` : ''}
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
    position: 'relative',
  },
  gridRow: { flexDirection: 'row' },
  cell: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { backgroundColor: 'transparent' },
  selectedCell: { borderWidth: 2, borderColor: studioTheme.accent },
  marker: { color: '#000c', fontWeight: '900' },
  rulerRow: { flexDirection: 'row' },
  rulerCol: { justifyContent: 'flex-start' },
  rulerText: { color: studioTheme.textFaint, fontSize: 9, textAlign: 'center' },
  hint: { color: studioTheme.textDim, fontSize: 11, marginTop: 6, fontFamily: studioTheme.mono },
});
