/**
 * Editor store — composed from independent slices.
 *
 * Public API is unchanged: all consumers import `useEditorStore` from this file.
 * Internal implementation is split across `./slices/*` so each concern stays
 * under ~200 lines and can be tested in isolation.
 *
 * Slices:
 *   documentSlice     — SVG document, path mutations, undo/redo history
 *   selectionSlice    — selected paths/points, active tool, marquee
 *   uiSlice           — zoom, pan, grid, panels, heatmap
 *   codeEditorSlice   — code ↔ canvas mapping state
 *   proFeaturesSlice  — PRO tier status and upgrade modal
 */
import { create } from 'zustand';

import { createDocumentSlice,    type DocumentSlice    } from './slices/documentSlice';
import { createSelectionSlice,   type SelectionSlice   } from './slices/selectionSlice';
import { createUISlice,          type UISlice          } from './slices/uiSlice';
import { createCodeEditorSlice,  type CodeEditorSlice  } from './slices/codeEditorSlice';
import { createProFeaturesSlice, type ProFeaturesSlice } from './slices/proFeaturesSlice';

// Combined store type (intersection of all slices)
export type StoreState =
  DocumentSlice &
  SelectionSlice &
  UISlice &
  CodeEditorSlice &
  ProFeaturesSlice;

// Re-export slice types for consumers that need them
export type {
  DocumentSlice,
  SelectionSlice,
  UISlice,
  CodeEditorSlice,
  ProFeaturesSlice,
};

export const useEditorStore = create<StoreState>()((set, get) => ({
  ...createDocumentSlice(set, get),
  ...createSelectionSlice(set, get),
  ...createUISlice(set, get),
  ...createCodeEditorSlice(set, get),
  ...createProFeaturesSlice(set, get),
}));
