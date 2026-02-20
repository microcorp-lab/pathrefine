/**
 * UI slice — viewport controls, toggles, and panel layout state.
 *
 * Owns: zoom, pan, snapToGrid, gridSize, showHelp, showHeatmap,
 *       showCodePanel, codePanelHeight, pathAlignmentPreview,
 *       pathAlignmentSelectionMode
 */
import type { Path } from '../../types/svg';

// ── Public interface ──────────────────────────────────────────────────────────

export interface UISlice {
  zoom:                       number;
  pan:                        { x: number; y: number };
  snapToGrid:                 boolean;
  gridSize:                   number;
  showHelp:                   boolean;
  showHeatmap:                boolean;
  showCodePanel:              boolean;
  codePanelHeight:            number;
  pathAlignmentPreview:       Path[] | null;
  pathAlignmentSelectionMode: 'none' | 'source' | 'target';

  setZoom:                      (zoom: number) => void;
  setPan:                       (x: number, y: number) => void;
  toggleSnapToGrid:             () => void;
  setGridSize:                  (size: number) => void;
  toggleHelp:                   () => void;
  toggleHeatmap:                () => void;
  toggleCodePanel:              () => void;
  setCodePanelHeight:           (height: number) => void;
  setPathAlignmentPreview:      (paths: Path[] | null) => void;
  setPathAlignmentSelectionMode:(mode: 'none' | 'source' | 'target') => void;
}

// ── Slice factory ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createUISlice(set: (fn: any) => void, _get: () => any): UISlice {
  return {
    // ── State ────────────────────────────────────────────────────────────────
    zoom:                       1,
    pan:                        { x: 0, y: 0 },
    snapToGrid:                 false,
    gridSize:                   20,
    showHelp:                   false,
    showHeatmap:                false,
    showCodePanel:              localStorage.getItem('showCodePanel') === 'true',
    codePanelHeight:            parseFloat(localStorage.getItem('codePanelHeight') || '0.35'),
    pathAlignmentPreview:       null,
    pathAlignmentSelectionMode: 'none',

    // ── Actions ──────────────────────────────────────────────────────────────

    setZoom: (zoom) => set(() => ({ zoom: Math.max(0.1, Math.min(10, zoom)) })),

    setPan: (x, y) => set(() => ({ pan: { x, y } })),

    toggleSnapToGrid: () => set((state: any) => ({ snapToGrid: !state.snapToGrid })),

    setGridSize: (size) => set(() => ({ gridSize: Math.max(5, Math.min(100, size)) })),

    toggleHelp: () => set((state: any) => ({ showHelp: !state.showHelp })),

    toggleHeatmap: () => set((state: any) => ({ showHeatmap: !state.showHeatmap })),

    toggleCodePanel: () =>
      set((state: any) => {
        const newValue = !state.showCodePanel;
        localStorage.setItem('showCodePanel', newValue.toString());
        return { showCodePanel: newValue };
      }),

    setCodePanelHeight: (height) => {
      const clamped = Math.max(0.2, Math.min(0.8, height));
      localStorage.setItem('codePanelHeight', clamped.toString());
      set(() => ({ codePanelHeight: clamped }));
    },

    setPathAlignmentPreview:       (paths) => set(() => ({ pathAlignmentPreview: paths })),
    setPathAlignmentSelectionMode: (mode)  => set(() => ({ pathAlignmentSelectionMode: mode })),
  };
}
