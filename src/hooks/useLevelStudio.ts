import { useCallback, useMemo, useReducer, useState } from 'react';

import type { ChargeSpec, LevelDefinition, ModifierKind, OrbColor } from '@/game/engine/types';
import {
  addCharge, canRedo as histCanRedo, canUndo as histCanUndo, clearCanvas, commit,
  createBlankLevel, duplicateCharge, eraseCell, initHistory, loadCampaignLevel,
  moveCharge, paintCell, redo, removeCharge, setGridSize, setMeta, undo, updateCharge,
  type History,
} from '@/game/studio/model';
import {
  removeModifier, setModifier, updateModifierConfig,
} from '@/game/studio/modifiers';
import {
  addRevealNode, clearReveal, deleteRevealLine, deleteRevealNode, ensureReveal,
  moveRevealNode, reorderRevealNode, setRevealCollectionId, setRevealName,
  toggleAccentNode, toggleRevealLine,
} from '@/game/studio/reveal';
import { fromLevelDefinition } from '@/game/studio/serialize';
import {
  mirrorHorizontal, mirrorVertical, replaceColor, rotate90,
} from '@/game/studio/transforms';
import { validateStudioLevel } from '@/game/studio/validate';
import type { ModifierConfig, StudioLevel, ValidationReport } from '@/game/studio/types';

interface Tool {
  mode: 'paint' | 'erase';
  color: OrbColor;
}

export type CanvasMode = 'pixels' | 'modifiers' | 'reveal';

interface StudioState {
  history: History<StudioLevel>;
  tool: Tool;
  showCoords: boolean;
  mode: 'edit' | 'play';
  canvasMode: CanvasMode;
  /** Modifier kind the MODIFIERS canvas paints; `null` = remove modifier. */
  modifierBrush: ModifierKind | null;
  /** Selected cell (MODIFIERS inspector) / selected reveal node (REVEAL). */
  selectedCell: { x: number; y: number } | null;
  selectedNode: number | null;
  /** First endpoint chosen for a new reveal line. */
  linkFrom: number | null;
}

type Action =
  | { type: 'edit'; apply: (level: StudioLevel) => StudioLevel }
  | { type: 'load'; level: StudioLevel }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'selectColor'; color: OrbColor }
  | { type: 'selectErase' }
  | { type: 'toggleCoords' }
  | { type: 'setMode'; mode: 'edit' | 'play' }
  | { type: 'setCanvasMode'; canvasMode: CanvasMode }
  | { type: 'setModifierBrush'; kind: ModifierKind | null }
  | { type: 'selectCell'; cell: { x: number; y: number } | null }
  | { type: 'selectNode'; index: number | null }
  | { type: 'setLinkFrom'; index: number | null };

function reducer(state: StudioState, action: Action): StudioState {
  switch (action.type) {
    case 'edit': {
      const next = action.apply(state.history.present);
      return { ...state, history: commit(state.history, next) };
    }
    case 'load':
      return {
        ...state, history: initHistory(action.level), mode: 'edit',
        selectedCell: null, selectedNode: null, linkFrom: null,
      };
    case 'setMode':
      return { ...state, mode: action.mode };
    case 'undo':
      return { ...state, history: undo(state.history) };
    case 'redo':
      return { ...state, history: redo(state.history) };
    case 'selectColor':
      return { ...state, tool: { mode: 'paint', color: action.color } };
    case 'selectErase':
      return { ...state, tool: { ...state.tool, mode: 'erase' } };
    case 'toggleCoords':
      return { ...state, showCoords: !state.showCoords };
    case 'setCanvasMode':
      return { ...state, canvasMode: action.canvasMode, selectedNode: null, linkFrom: null };
    case 'setModifierBrush':
      return { ...state, modifierBrush: action.kind };
    case 'selectCell':
      return { ...state, selectedCell: action.cell };
    case 'selectNode':
      return { ...state, selectedNode: action.index };
    case 'setLinkFrom':
      return { ...state, linkFrom: action.index };
    default:
      return state;
  }
}

export interface LevelStudio {
  level: StudioLevel;
  report: ValidationReport;
  tool: Tool;
  showCoords: boolean;
  mode: 'edit' | 'play';
  canUndo: boolean;
  canRedo: boolean;
  enterPlay: () => void;
  exitPlay: () => void;
  paint: (x: number, y: number) => void;
  erase: (x: number, y: number) => void;
  clearBoard: () => void;
  resize: (width: number, height: number) => void;
  setMetadata: (patch: Partial<Pick<StudioLevel, 'id' | 'title' | 'themeId' | 'difficulty'>>) => void;
  addCharge: (tunnel: number) => void;
  removeCharge: (tunnel: number, index: number) => void;
  updateCharge: (tunnel: number, index: number, patch: Partial<ChargeSpec>) => void;
  moveCharge: (tunnel: number, index: number, direction: -1 | 1) => void;
  duplicateCharge: (tunnel: number, index: number) => void;
  undo: () => void;
  redo: () => void;
  selectColor: (color: OrbColor) => void;
  selectErase: () => void;
  toggleCoords: () => void;
  loadCampaign: (id: number) => void;
  loadDefinition: (def: LevelDefinition) => void;
  loadStudioLevel: (level: StudioLevel) => void;
  newLevel: () => void;

  // ── special pixels + reveal (M3C) ─────────────────────────────────────────
  canvasMode: CanvasMode;
  setCanvasMode: (m: CanvasMode) => void;
  modifierBrush: ModifierKind | null;
  setModifierBrush: (k: ModifierKind | null) => void;
  selectedCell: { x: number; y: number } | null;
  selectCell: (cell: { x: number; y: number } | null) => void;
  applyModifierAt: (x: number, y: number) => void;
  setModifierAt: (x: number, y: number, kind: ModifierKind) => void;
  removeModifierAt: (x: number, y: number) => void;
  updateModifierAt: (x: number, y: number, patch: Partial<ModifierConfig>) => void;

  selectedNode: number | null;
  linkFrom: number | null;
  selectNode: (index: number | null) => void;
  startReveal: () => void;
  removeReveal: () => void;
  setRevealName: (name: string) => void;
  setRevealCollectionId: (id: string | undefined) => void;
  addRevealNodeAt: (x: number, y: number) => void;
  moveRevealNodeTo: (index: number, x: number, y: number) => void;
  deleteRevealNodeAt: (index: number) => void;
  reorderRevealNodeAt: (index: number, direction: -1 | 1) => void;
  revealCanvasTap: (x: number, y: number) => void;
  toggleRevealLineAt: (a: number, b: number) => void;
  deleteRevealLineAt: (index: number) => void;
  toggleAccentNodeAt: (index: number) => void;

  // ── transforms (M3C) ─────────────────────────────────────────────────────
  transformWarning: string | null;
  mirrorH: () => void;
  mirrorV: () => void;
  rotate: () => void;
  replaceColor: (from: OrbColor, to: OrbColor) => void;
}

export function useLevelStudio(initial?: StudioLevel): LevelStudio {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    history: initHistory(initial ?? createBlankLevel()),
    tool: { mode: 'paint' as const, color: 'white' as OrbColor },
    showCoords: false,
    mode: 'edit' as const,
    canvasMode: 'pixels' as CanvasMode,
    modifierBrush: 'frozen' as ModifierKind | null,
    selectedCell: null,
    selectedNode: null,
    linkFrom: null,
  }));

  const level = state.history.present;
  const report = useMemo(() => validateStudioLevel(level), [level]);
  const [transformWarning, setTransformWarning] = useState<string | null>(null);

  const edit = useCallback(
    (apply: (level: StudioLevel) => StudioLevel) => dispatch({ type: 'edit', apply }),
    [],
  );

  const runTransform = (fn: (l: StudioLevel) => { level: StudioLevel; revealWarning?: string }) => {
    const { level: next, revealWarning } = fn(level);
    setTransformWarning(revealWarning ?? null);
    if (next !== level) dispatch({ type: 'edit', apply: () => next });
  };

  return {
    level,
    report,
    tool: state.tool,
    showCoords: state.showCoords,
    mode: state.mode,
    canUndo: histCanUndo(state.history),
    canRedo: histCanRedo(state.history),
    enterPlay: () => dispatch({ type: 'setMode', mode: 'play' }),
    exitPlay: () => dispatch({ type: 'setMode', mode: 'edit' }),
    paint: (x, y) => edit((l) => paintCell(l, x, y, state.tool.color)),
    erase: (x, y) => edit((l) => eraseCell(l, x, y)),
    clearBoard: () => edit(clearCanvas),
    resize: (w, h) => edit((l) => setGridSize(l, w, h)),
    setMetadata: (patch) => edit((l) => setMeta(l, patch)),
    addCharge: (t) => edit((l) => addCharge(l, t)),
    removeCharge: (t, i) => edit((l) => removeCharge(l, t, i)),
    updateCharge: (t, i, patch) => edit((l) => updateCharge(l, t, i, patch)),
    moveCharge: (t, i, d) => edit((l) => moveCharge(l, t, i, d)),
    duplicateCharge: (t, i) => edit((l) => duplicateCharge(l, t, i)),
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    selectColor: (color) => dispatch({ type: 'selectColor', color }),
    selectErase: () => dispatch({ type: 'selectErase' }),
    toggleCoords: () => dispatch({ type: 'toggleCoords' }),
    loadCampaign: (id) => dispatch({ type: 'load', level: loadCampaignLevel(id) }),
    loadDefinition: (def) => dispatch({ type: 'load', level: fromLevelDefinition(def) }),
    loadStudioLevel: (l) => dispatch({ type: 'load', level: l }),
    newLevel: () => dispatch({ type: 'load', level: createBlankLevel() }),

    // ── special pixels + reveal (M3C) ───────────────────────────────────────
    canvasMode: state.canvasMode,
    setCanvasMode: (m) => dispatch({ type: 'setCanvasMode', canvasMode: m }),
    modifierBrush: state.modifierBrush,
    setModifierBrush: (k) => dispatch({ type: 'setModifierBrush', kind: k }),
    selectedCell: state.selectedCell,
    selectCell: (cell) => dispatch({ type: 'selectCell', cell }),
    applyModifierAt: (x, y) => {
      dispatch({ type: 'selectCell', cell: { x, y } });
      edit((l) => (state.modifierBrush ? setModifier(l, x, y, state.modifierBrush) : removeModifier(l, x, y)));
    },
    setModifierAt: (x, y, kind) => edit((l) => setModifier(l, x, y, kind)),
    removeModifierAt: (x, y) => edit((l) => removeModifier(l, x, y)),
    updateModifierAt: (x, y, patch) => edit((l) => updateModifierConfig(l, x, y, patch)),

    selectedNode: state.selectedNode,
    linkFrom: state.linkFrom,
    selectNode: (index) => dispatch({ type: 'selectNode', index }),
    startReveal: () => edit((l) => ensureReveal(l)),
    removeReveal: () => edit((l) => clearReveal(l)),
    setRevealName: (name) => edit((l) => setRevealName(l, name)),
    setRevealCollectionId: (id) => edit((l) => setRevealCollectionId(l, id)),
    addRevealNodeAt: (x, y) => edit((l) => addRevealNode(l, x, y)),
    moveRevealNodeTo: (index, x, y) => edit((l) => moveRevealNode(l, index, x, y)),
    deleteRevealNodeAt: (index) => {
      dispatch({ type: 'selectNode', index: null });
      edit((l) => deleteRevealNode(l, index));
    },
    reorderRevealNodeAt: (index, direction) => edit((l) => reorderRevealNode(l, index, direction)),
    revealCanvasTap: (x, y) => {
      // In REVEAL mode a canvas tap drops a new node at that cell.
      edit((l) => addRevealNode(ensureReveal(l), x, y));
    },
    toggleRevealLineAt: (a, b) => {
      dispatch({ type: 'setLinkFrom', index: null });
      edit((l) => toggleRevealLine(l, a, b));
    },
    deleteRevealLineAt: (index) => edit((l) => deleteRevealLine(l, index)),
    toggleAccentNodeAt: (index) => edit((l) => toggleAccentNode(l, index)),

    // ── transforms (M3C) ───────────────────────────────────────────────────
    transformWarning,
    mirrorH: () => runTransform(mirrorHorizontal),
    mirrorV: () => runTransform(mirrorVertical),
    rotate: () => runTransform(rotate90),
    replaceColor: (from, to) => {
      setTransformWarning(null);
      edit((l) => replaceColor(l, from, to));
    },
  };
}
