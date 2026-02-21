/**
 * Selection slice — what is currently selected on the canvas.
 *
 * Owns: selectedPathIds, activeTool, alignment, editingPathId,
 *       selectedPointIndex, selectedPointIndices, hoveredPoint,
 *       marqueeStart, marqueeEnd
 */
import type { Tool, PathAlignment, ControlPoint } from '../../types/svg';

// ── Public interface ──────────────────────────────────────────────────────────

export interface SelectionSlice {
  selectedPathIds:      string[];
  activeTool:           Tool;
  alignment:            PathAlignment | null;
  editingPathId:        string | null;
  selectedPointIndex:   number | null;
  selectedPointIndices: number[];
  hoveredPoint:         ControlPoint | null;
  marqueeStart:         { x: number; y: number } | null;
  marqueeEnd:           { x: number; y: number } | null;

  selectPath:           (pathId: string) => void;
  addPathToSelection:   (pathId: string) => void;
  togglePathSelection:  (pathId: string) => void;
  clearSelection:       () => void;
  setTool:              (tool: Tool) => void;
  setAlignment:         (alignment: PathAlignment | null) => void;
  setEditingPath:       (pathId: string | null) => void;
  setSelectedPoint:     (index: number | null) => void;
  togglePointSelection: (index: number) => void;
  clearPointSelection:  () => void;
  setHoveredPoint:      (point: ControlPoint | null) => void;
  setMarqueeStart:      (point: { x: number; y: number } | null) => void;
  setMarqueeEnd:        (point: { x: number; y: number } | null) => void;
}

// ── Slice factory ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSelectionSlice(set: (fn: any) => void, _get: () => any): SelectionSlice {
  return {
    // ── State ────────────────────────────────────────────────────────────────
    selectedPathIds:      [],
    activeTool:           'edit',
    alignment:            null,
    editingPathId:        null,
    selectedPointIndex:   null,
    selectedPointIndices: [],
    hoveredPoint:         null,
    marqueeStart:         null,
    marqueeEnd:           null,

    // ── Actions ──────────────────────────────────────────────────────────────

    selectPath: (pathId) => set(() => ({ selectedPathIds: [pathId] })),

    addPathToSelection: (pathId) =>
      set((state: SelectionSlice) =>
        state.selectedPathIds.includes(pathId)
          ? state
          : { selectedPathIds: [...state.selectedPathIds, pathId] },
      ),

    togglePathSelection: (pathId) =>
      set((state: SelectionSlice) => ({
        selectedPathIds: state.selectedPathIds.includes(pathId)
          ? state.selectedPathIds.filter((id: string) => id !== pathId)
          : [...state.selectedPathIds, pathId],
      })),

    clearSelection: () =>
      set(() => ({
        selectedPathIds:      [],
        editingPathId:        null,
        selectedPointIndex:   null,
        selectedPointIndices: [],
      })),

    setTool:      (tool)      => set(() => ({ activeTool: tool })),
    setAlignment: (alignment) => set(() => ({ alignment })),

    setEditingPath: (pathId) =>
      set(() => ({
        editingPathId:        pathId,
        selectedPointIndex:   null,
        selectedPointIndices: [],
      })),

    setSelectedPoint: (index) =>
      set(() => ({
        selectedPointIndex:   index,
        selectedPointIndices: index !== null ? [index] : [],
      })),

    togglePointSelection: (index) =>
      set((state: SelectionSlice) => {
        const isSelected = state.selectedPointIndices.includes(index);
        const newIndices = isSelected
          ? state.selectedPointIndices.filter((i: number) => i !== index)
          : [...state.selectedPointIndices, index];
        return {
          selectedPointIndices: newIndices,
          selectedPointIndex:   newIndices.length > 0 ? newIndices[0] : null,
        };
      }),

    clearPointSelection: () =>
      set(() => ({ selectedPointIndex: null, selectedPointIndices: [] })),

    setHoveredPoint: (point) => set(() => ({ hoveredPoint: point })),
    setMarqueeStart: (point) => set(() => ({ marqueeStart: point })),
    setMarqueeEnd:   (point) => set(() => ({ marqueeEnd: point })),
  };
}
