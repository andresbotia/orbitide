import { useCallback, useMemo, useReducer } from 'react';

import type { ChargeSpec, LevelDefinition, OrbColor } from '@/game/engine/types';
import {
  addCharge, canRedo as histCanRedo, canUndo as histCanUndo, clearCanvas, commit,
  createBlankLevel, duplicateCharge, eraseCell, initHistory, loadCampaignLevel,
  moveCharge, paintCell, redo, removeCharge, setGridSize, setMeta, undo, updateCharge,
  type History,
} from '@/game/studio/model';
import { fromLevelDefinition } from '@/game/studio/serialize';
import { validateStudioLevel } from '@/game/studio/validate';
import type { StudioLevel, ValidationReport } from '@/game/studio/types';

interface Tool {
  mode: 'paint' | 'erase';
  color: OrbColor;
}

interface StudioState {
  history: History<StudioLevel>;
  tool: Tool;
  showCoords: boolean;
  mode: 'edit' | 'play';
}

type Action =
  | { type: 'edit'; apply: (level: StudioLevel) => StudioLevel }
  | { type: 'load'; level: StudioLevel }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'selectColor'; color: OrbColor }
  | { type: 'selectErase' }
  | { type: 'toggleCoords' }
  | { type: 'setMode'; mode: 'edit' | 'play' };

function reducer(state: StudioState, action: Action): StudioState {
  switch (action.type) {
    case 'edit': {
      const next = action.apply(state.history.present);
      return { ...state, history: commit(state.history, next) };
    }
    case 'load':
      return { ...state, history: initHistory(action.level), mode: 'edit' };
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
  newLevel: () => void;
}

export function useLevelStudio(initial?: StudioLevel): LevelStudio {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    history: initHistory(initial ?? createBlankLevel()),
    tool: { mode: 'paint' as const, color: 'white' as OrbColor },
    showCoords: false,
    mode: 'edit' as const,
  }));

  const level = state.history.present;
  const report = useMemo(() => validateStudioLevel(level), [level]);

  const edit = useCallback(
    (apply: (level: StudioLevel) => StudioLevel) => dispatch({ type: 'edit', apply }),
    [],
  );

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
    newLevel: () => dispatch({ type: 'load', level: createBlankLevel() }),
  };
}
