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
  /** Mobile bottom drawer — open/close state and which path it shows */
  mobileDrawerOpen:           boolean;
  mobileDrawerPathId:         string | null;

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
  openMobileDrawer:             (pathId: string) => void;
  closeMobileDrawer:            () => void;
}

// ── Slice factory ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createUISlice(set: (fn: any) => void, _get: () => any): UISlice {
  return {
    // ── State ────────────────────────────────────────────────────────────────
    zoom:                       parseFloat(localStorage.getItem('zoom') || '1'),
    pan:                        JSON.parse(localStorage.getItem('pan') || '{"x":0,"y":0}'),
    snapToGrid:                 localStorage.getItem('snapToGrid') === 'true',
    gridSize:                   parseInt(localStorage.getItem('gridSize') || '20', 10),
    showHelp:                   false,
    showHeatmap:                localStorage.getItem('showHeatmap') === 'true',
    showCodePanel:              localStorage.getItem('showCodePanel') === 'true',
    codePanelHeight:            parseFloat(localStorage.getItem('codePanelHeight') || '0.35'),
    pathAlignmentPreview:       null,
    pathAlignmentSelectionMode: 'none',
    mobileDrawerOpen:           false,
    mobileDrawerPathId:         null,

    // ── Actions ──────────────────────────────────────────────────────────────

    setZoom: (zoom) => {
      const clamped = Math.max(0.1, Math.min(10, zoom));
      localStorage.setItem('zoom', clamped.toString());
      set(() => ({ zoom: clamped }));
    },

    setPan: (x, y) => {
      localStorage.setItem('pan', JSON.stringify({ x, y }));
      set(() => ({ pan: { x, y } }));
    },

    toggleSnapToGrid: () =>
      set((state: UISlice) => {
        const newValue = !state.snapToGrid;
        localStorage.setItem('snapToGrid', newValue.toString());
        return { snapToGrid: newValue };
      }),

    setGridSize: (size) => {
      const clamped = Math.max(5, Math.min(100, size));
      localStorage.setItem('gridSize', clamped.toString());
      set(() => ({ gridSize: clamped }));
    },

    toggleHelp: () => set((state: UISlice) => ({ showHelp: !state.showHelp })),

    toggleHeatmap: () =>
      set((state: UISlice) => {
        const newValue = !state.showHeatmap;
        localStorage.setItem('showHeatmap', newValue.toString());
        return { showHeatmap: newValue };
      }),

    toggleCodePanel: () =>
      set((state: UISlice) => {
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

    openMobileDrawer:  (pathId) => set(() => ({ mobileDrawerOpen: true, mobileDrawerPathId: pathId })),
    closeMobileDrawer: ()       => set(() => ({ mobileDrawerOpen: false })),
  };
}
