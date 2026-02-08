import { create } from 'zustand';
import type { EditorState, SVGDocument, Tool, PathAlignment, ControlPoint, Path, HistoryEntry } from '../types/svg';
import type { PathCodeMapping } from '../engine/codeMapping';

interface EditorActions {
  setSVGDocument: (doc: SVGDocument, skipHistory?: boolean) => void;
  selectPath: (pathId: string) => void;
  addPathToSelection: (pathId: string) => void;
  togglePathSelection: (pathId: string) => void;
  clearSelection: () => void;
  setTool: (tool: Tool) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setAlignment: (alignment: PathAlignment | null) => void;
  setEditingPath: (pathId: string | null) => void;
  setSelectedPoint: (index: number | null) => void;
  togglePointSelection: (index: number) => void;
  clearPointSelection: () => void;
  setHoveredPoint: (point: ControlPoint | null) => void;
  updatePath: (pathId: string, newPath: Path, action?: string) => void;
  deletePath: (pathId: string, action?: string) => void;
  togglePathVisibility: (pathId: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  toggleSnapToGrid: () => void;
  setGridSize: (size: number) => void;
  toggleHelp: () => void;
  toggleHeatmap: () => void;
  setMarqueeStart: (point: { x: number; y: number } | null) => void;
  setMarqueeEnd: (point: { x: number; y: number } | null) => void;
  toggleCodePanel: () => void;
  setCodePanelHeight: (height: number) => void;
  setCodeMappings: (mappings: Map<string, PathCodeMapping> | null) => void;
  clearProject: () => void;
  setPathAlignmentPreview: (paths: Path[] | null) => void;
  setPathAlignmentSelectionMode: (mode: 'none' | 'source' | 'target') => void;
  toggleUpgradeModal: () => void;
}

// Helper functions for localStorage
const saveToLocalStorage = (doc: SVGDocument | null, history: HistoryEntry[], historyIndex: number) => {
  try {
    if (doc) {
      localStorage.setItem('svgDocument', JSON.stringify(doc));
      localStorage.setItem('editHistory', JSON.stringify(history));
      localStorage.setItem('historyIndex', historyIndex.toString());
    } else {
      localStorage.removeItem('svgDocument');
      localStorage.removeItem('editHistory');
      localStorage.removeItem('historyIndex');
    }
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
};

const loadFromLocalStorage = (): { doc: SVGDocument | null; history: HistoryEntry[]; historyIndex: number } => {
  try {
    const docString = localStorage.getItem('svgDocument');
    const historyString = localStorage.getItem('editHistory');
    const indexString = localStorage.getItem('historyIndex');
    
    if (docString && historyString && indexString) {
      return {
        doc: JSON.parse(docString),
        history: JSON.parse(historyString),
        historyIndex: parseInt(indexString, 10)
      };
    }
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
  }
  
  return { doc: null, history: [], historyIndex: -1 };
};

// Load initial state from localStorage
const initialState = loadFromLocalStorage();

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  // State
  svgDocument: initialState.doc,
  selectedPathIds: [],
  activeTool: 'edit',
  zoom: 1,
  pan: { x: 0, y: 0 },
  alignment: null,
  editingPathId: null,
  selectedPointIndex: null,
  selectedPointIndices: [],
  hoveredPoint: null,
  history: initialState.history,
  historyIndex: initialState.historyIndex,
  snapToGrid: false,
  gridSize: 20,
  showHelp: false,
  showHeatmap: false,
  marqueeStart: null,
  marqueeEnd: null,
  showCodePanel: localStorage.getItem('showCodePanel') === 'true',
  codePanelHeight: parseFloat(localStorage.getItem('codePanelHeight') || '0.35'),
  codeMappings: null,
  pathAlignmentPreview: null,
  pathAlignmentSelectionMode: 'none',
  isPro: false, // Free tier by default
  showUpgradeModal: false,

  // Actions
  setSVGDocument: (doc, skipHistory = false) => {
    const state = get();
    
    // Skip history creation if requested (used when syncing from code editor)
    if (skipHistory) {
      set({ svgDocument: doc });
      return;
    }
    
    const action = state.svgDocument ? 'Update SVG' : 'Load SVG';
    
    const entry: HistoryEntry = {
      svgDocument: doc,
      timestamp: Date.now(),
      action
    };
    
    // If we already have history, add to it instead of replacing
    let newHistory: HistoryEntry[];
    let newIndex: number;
    
    if (state.historyIndex >= 0) {
      // Truncate future history and add new entry
      newHistory = [...state.history.slice(0, state.historyIndex + 1), entry];
      // Limit to 50 entries
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      newIndex = newHistory.length - 1;
    } else {
      // First document load
      newHistory = [entry];
      newIndex = 0;
    }
    
    saveToLocalStorage(doc, newHistory, newIndex);
    
    set({ 
      svgDocument: doc, 
      selectedPathIds: [], 
      editingPathId: null,
      history: newHistory,
      historyIndex: newIndex
    });
  },
  
  selectPath: (pathId) => set({ selectedPathIds: [pathId] }),
  
  addPathToSelection: (pathId) => set((state) => {
    if (!state.selectedPathIds.includes(pathId)) {
      return { selectedPathIds: [...state.selectedPathIds, pathId] };
    }
    return state;
  }),
  
  togglePathSelection: (pathId) => set((state) => {
    const isSelected = state.selectedPathIds.includes(pathId);
    if (isSelected) {
      return {
        selectedPathIds: state.selectedPathIds.filter(id => id !== pathId)
      };
    } else {
      return {
        selectedPathIds: [...state.selectedPathIds, pathId]
      };
    }
  }),
  
  clearSelection: () => set({ 
    selectedPathIds: [], 
    editingPathId: null, 
    selectedPointIndex: null,
    selectedPointIndices: []
  }),
  
  setTool: (tool) => set({ activeTool: tool }),
  
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(10, zoom)) }),
  
  setPan: (x, y) => set({ pan: { x, y } }),
  
  setAlignment: (alignment) => set({ alignment }),

  setEditingPath: (pathId) => set({ 
    editingPathId: pathId, 
    selectedPointIndex: null,
    selectedPointIndices: []
  }),

  setSelectedPoint: (index) => set({ 
    selectedPointIndex: index,
    selectedPointIndices: index !== null ? [index] : []
  }),

  togglePointSelection: (index) => set((state) => {
    const isSelected = state.selectedPointIndices.includes(index);
    if (isSelected) {
      const newIndices = state.selectedPointIndices.filter(i => i !== index);
      return {
        selectedPointIndices: newIndices,
        selectedPointIndex: newIndices.length > 0 ? newIndices[0] : null
      };
    } else {
      const newIndices = [...state.selectedPointIndices, index];
      return {
        selectedPointIndices: newIndices,
        selectedPointIndex: index
      };
    }
  }),

  clearPointSelection: () => set({ 
    selectedPointIndex: null,
    selectedPointIndices: []
  }),

  setHoveredPoint: (point) => set({ hoveredPoint: point }),

  togglePathVisibility: (pathId) => set((state) => {
    if (!state.svgDocument) return state;
    
    const paths = state.svgDocument.paths.map(p => 
      p.id === pathId ? { ...p, visible: p.visible === false ? true : false } : p
    );
    
    const newDocument = {
      ...state.svgDocument,
      paths
    };

    // Add to history
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    const entry: HistoryEntry = {
      svgDocument: newDocument,
      timestamp: Date.now(),
      action: `Toggle path visibility`
    };
    newHistory.push(entry);

    if (newHistory.length > 50) {
      newHistory.shift();
    }

    const newIndex = newHistory.length - 1;
    saveToLocalStorage(newDocument, newHistory, newIndex);

    return {
      svgDocument: newDocument,
      history: newHistory,
      historyIndex: newIndex
    };
  }),

  updatePath: (pathId, newPath, action = 'Edit path') => set((state) => {
    if (!state.svgDocument) return state;
    
    const paths = state.svgDocument.paths.map(p => 
      p.id === pathId ? newPath : p
    );
    
    const newDocument = {
      ...state.svgDocument,
      paths
    };

    // Add to history (truncate future history if we're not at the end)
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    const entry: HistoryEntry = {
      svgDocument: newDocument,
      timestamp: Date.now(),
      action
    };
    newHistory.push(entry);

    // Limit history to 50 entries
    if (newHistory.length > 50) {
      newHistory.shift();
    }

    const newIndex = newHistory.length - 1;
    saveToLocalStorage(newDocument, newHistory, newIndex);

    return {
      svgDocument: newDocument,
      history: newHistory,
      historyIndex: newIndex
    };
  }),

  deletePath: (pathId, action = 'Delete path') => set((state) => {
    if (!state.svgDocument) return state;
    
    const paths = state.svgDocument.paths.filter(p => p.id !== pathId);
    
    const newDocument = {
      ...state.svgDocument,
      paths
    };

    // Add to history
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    const entry: HistoryEntry = {
      svgDocument: newDocument,
      timestamp: Date.now(),
      action
    };
    newHistory.push(entry);

    if (newHistory.length > 50) {
      newHistory.shift();
    }

    const newIndex = newHistory.length - 1;
    saveToLocalStorage(newDocument, newHistory, newIndex);

    return {
      svgDocument: newDocument,
      history: newHistory,
      historyIndex: newIndex,
      selectedPathIds: state.selectedPathIds.filter(id => id !== pathId),
      editingPathId: state.editingPathId === pathId ? null : state.editingPathId
    };
  }),

  undo: () => set((state) => {
    if (state.historyIndex <= 0) return state;
    
    const newIndex = state.historyIndex - 1;
    const newDoc = state.history[newIndex].svgDocument;
    saveToLocalStorage(newDoc, state.history, newIndex);
    
    return {
      svgDocument: newDoc,
      historyIndex: newIndex,
      selectedPointIndex: null,
      selectedPointIndices: []
    };
  }),

  redo: () => set((state) => {
    if (state.historyIndex >= state.history.length - 1) return state;
    
    const newIndex = state.historyIndex + 1;
    const newDoc = state.history[newIndex].svgDocument;
    saveToLocalStorage(newDoc, state.history, newIndex);
    
    return {
      svgDocument: newDoc,
      historyIndex: newIndex,
      selectedPointIndex: null, // Clear point selection on redo
      selectedPointIndices: [] // Clear multi-point selection on redo
    };
  }),

  canUndo: () => {
    const state = get();
    return state.historyIndex > 0;
  },

  canRedo: () => {
    const state = get();
    return state.historyIndex < state.history.length - 1;
  },

  toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

  setGridSize: (size) => set({ gridSize: Math.max(5, Math.min(100, size)) }),

  toggleHelp: () => set((state) => ({ showHelp: !state.showHelp })),

  toggleHeatmap: () => set((state) => ({ showHeatmap: !state.showHeatmap })),

  setMarqueeStart: (point) => set({ marqueeStart: point }),

  setMarqueeEnd: (point) => set({ marqueeEnd: point }),

  toggleCodePanel: () => set((state) => {
    const newValue = !state.showCodePanel;
    localStorage.setItem('showCodePanel', newValue.toString());
    return { showCodePanel: newValue };
  }),
  
  setCodePanelHeight: (height) => {
    const clampedHeight = Math.max(0.2, Math.min(0.8, height));
    localStorage.setItem('codePanelHeight', clampedHeight.toString());
    set({ codePanelHeight: clampedHeight });
  },

  setCodeMappings: (mappings) => set({ codeMappings: mappings }),

  clearProject: () => {
    saveToLocalStorage(null, [], -1);
    set({
      svgDocument: null,
      selectedPathIds: [],
      editingPathId: null,
      selectedPointIndex: null,
      selectedPointIndices: [],
      history: [],
      historyIndex: -1,
      alignment: null,
      hoveredPoint: null,
      codeMappings: null
    });
  },

  setPathAlignmentPreview: (paths) => {
    set({ pathAlignmentPreview: paths });
  },

  setPathAlignmentSelectionMode: (mode) => {
    set({ pathAlignmentSelectionMode: mode });
  },

  toggleUpgradeModal: () => {
    set((state) => ({ showUpgradeModal: !state.showUpgradeModal }));
  },
}));
