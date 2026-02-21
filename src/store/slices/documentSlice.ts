/**
 * Document slice — SVG document state, path mutations, and undo/redo history.
 *
 * Owns: svgDocument, history, historyIndex
 * Actions: setSVGDocument, updatePath, deletePath, togglePathVisibility,
 *          clearProject, undo, redo, canUndo, canRedo
 */
import type { SVGDocument, Path, HistoryEntry } from '../../types/svg';
import type { SelectionSlice } from './selectionSlice';
import { saveToLocalStorage, initialPersistedState } from './localStorage';

// ── Public interface ──────────────────────────────────────────────────────────

export interface DocumentSlice {
  svgDocument:  SVGDocument | null;
  history:      HistoryEntry[];
  historyIndex: number;

  setSVGDocument:       (doc: SVGDocument, skipHistory?: boolean) => void;
  updatePath:           (pathId: string, newPath: Path, action?: string) => void;
  deletePath:           (pathId: string, action?: string) => void;
  togglePathVisibility: (pathId: string) => void;
  clearProject:         () => void;
  undo:                 () => void;
  redo:                 () => void;
  canUndo:              () => boolean;
  canRedo:              () => boolean;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function pushHistory(
  history: HistoryEntry[],
  historyIndex: number,
  entry: HistoryEntry,
): { history: HistoryEntry[]; historyIndex: number } {
  const next = [...history.slice(0, historyIndex + 1), entry];
  if (next.length > 50) next.shift();
  return { history: next, historyIndex: next.length - 1 };
}

// ── Slice factory ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDocumentSlice(set: (fn: any) => void, get: () => any): DocumentSlice {
  return {
    // ── State ────────────────────────────────────────────────────────────────
    svgDocument:  initialPersistedState.doc,
    history:      initialPersistedState.history,
    historyIndex: initialPersistedState.historyIndex,

    // ── Actions ──────────────────────────────────────────────────────────────

    setSVGDocument: (doc, skipHistory = false) => {
      if (skipHistory) {
        set(() => ({ svgDocument: doc }));
        return;
      }

      const state = get();
      const action = state.svgDocument ? 'Update SVG' : 'Load SVG';
      const entry: HistoryEntry = { svgDocument: doc, timestamp: Date.now(), action };

      const { history: newHistory, historyIndex: newIndex } =
        state.historyIndex >= 0
          ? pushHistory(state.history, state.historyIndex, entry)
          : { history: [entry], historyIndex: 0 };

      saveToLocalStorage(doc, newHistory, newIndex);
      set(() => ({
        svgDocument:   doc,
        history:       newHistory,
        historyIndex:  newIndex,
        selectedPathIds: [],
        editingPathId:   null,
      }));
    },

    updatePath: (pathId, newPath, action = 'Edit path') => {
      set((state: DocumentSlice) => {
        if (!state.svgDocument) return state;
        const paths = state.svgDocument.paths.map((p: Path) => p.id === pathId ? newPath : p);
        const newDocument = { ...state.svgDocument, paths };
        const entry: HistoryEntry = { svgDocument: newDocument, timestamp: Date.now(), action };
        const { history: newHistory, historyIndex: newIndex } =
          pushHistory(state.history, state.historyIndex, entry);
        saveToLocalStorage(newDocument, newHistory, newIndex);
        return { svgDocument: newDocument, history: newHistory, historyIndex: newIndex };
      });
    },

    deletePath: (pathId, action = 'Delete path') => {
      set((state: DocumentSlice & Pick<SelectionSlice, 'selectedPathIds' | 'editingPathId'>) => {
        if (!state.svgDocument) return state;
        const paths = state.svgDocument.paths.filter((p: Path) => p.id !== pathId);
        const newDocument = { ...state.svgDocument, paths };
        const entry: HistoryEntry = { svgDocument: newDocument, timestamp: Date.now(), action };
        const { history: newHistory, historyIndex: newIndex } =
          pushHistory(state.history, state.historyIndex, entry);
        saveToLocalStorage(newDocument, newHistory, newIndex);
        return {
          svgDocument:    newDocument,
          history:        newHistory,
          historyIndex:   newIndex,
          selectedPathIds: state.selectedPathIds.filter((id: string) => id !== pathId),
          editingPathId:   state.editingPathId === pathId ? null : state.editingPathId,
        };
      });
    },

    togglePathVisibility: (pathId) => {
      set((state: DocumentSlice) => {
        if (!state.svgDocument) return state;
        const paths = state.svgDocument.paths.map((p: Path) =>
          p.id === pathId ? { ...p, visible: p.visible === false ? true : false } : p,
        );
        const newDocument = { ...state.svgDocument, paths };
        const entry: HistoryEntry = {
          svgDocument: newDocument, timestamp: Date.now(), action: 'Toggle path visibility',
        };
        const { history: newHistory, historyIndex: newIndex } =
          pushHistory(state.history, state.historyIndex, entry);
        saveToLocalStorage(newDocument, newHistory, newIndex);
        return { svgDocument: newDocument, history: newHistory, historyIndex: newIndex };
      });
    },

    clearProject: () => {
      saveToLocalStorage(null, [], -1);
      set(() => ({
        svgDocument:      null,
        history:          [],
        historyIndex:     -1,
        selectedPathIds:  [],
        editingPathId:    null,
        selectedPointIndex:   null,
        selectedPointIndices: [],
        alignment:    null,
        hoveredPoint: null,
        codeMappings: null,
      }));
    },

    undo: () => {
      set((state: DocumentSlice) => {
        if (state.historyIndex <= 0) return state;
        const newIndex = state.historyIndex - 1;
        const newDoc   = state.history[newIndex].svgDocument;
        saveToLocalStorage(newDoc, state.history, newIndex);
        return {
          svgDocument:          newDoc,
          historyIndex:         newIndex,
          selectedPointIndex:   null,
          selectedPointIndices: [],
        };
      });
    },

    redo: () => {
      set((state: DocumentSlice) => {
        if (state.historyIndex >= state.history.length - 1) return state;
        const newIndex = state.historyIndex + 1;
        const newDoc   = state.history[newIndex].svgDocument;
        saveToLocalStorage(newDoc, state.history, newIndex);
        return {
          svgDocument:          newDoc,
          historyIndex:         newIndex,
          selectedPointIndex:   null,
          selectedPointIndices: [],
        };
      });
    },

    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,
  };
}
