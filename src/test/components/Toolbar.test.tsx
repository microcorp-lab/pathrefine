/**
 * Component tests — Toolbar
 *
 * Covers:
 * - Buttons correctly disabled when preconditions are not met (no document / no path selected)
 * - Buttons correctly enabled when preconditions are met
 * - View toggles (snap-to-grid, heatmap) update store state on click
 * - No alert() calls — state guards use disabled props or toast
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Toolbar } from '../../components/Toolbar/Toolbar';
import { useEditorStore } from '../../store/editorStore';
import {
  renderWithProviders,
  createTestDocument,
  createTestPath,
  resetEditorStore,
} from '../helpers/renderWithProviders';

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderToolbar() {
  return renderWithProviders(<Toolbar />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Toolbar', () => {
  beforeEach(() => {
    resetEditorStore();
    vi.clearAllMocks();
  });

  // ── No document loaded ────────────────────────────────────────────────────

  describe('when no document is loaded', () => {
    it('Smart Heal button is disabled', () => {
      renderToolbar();
      expect(screen.getByTitle(/Smart Heal/i)).toBeDisabled();
    });

    it('Smooth Path button is disabled', () => {
      renderToolbar();
      expect(screen.getByTitle(/Smooth Path/i)).toBeDisabled();
    });

    it('Perfect Square button is disabled', () => {
      renderToolbar();
      expect(screen.getByTitle(/Perfect Square/i)).toBeDisabled();
    });

    it('Merge Paths button is disabled', () => {
      renderToolbar();
      // The title text varies depending on selectedPathIds.length, match the base key
      expect(screen.getByTitle(/Merge Paths/i)).toBeDisabled();
    });

    it('Path Alignment button is disabled', () => {
      renderToolbar();
      expect(screen.getByTitle(/Path Alignment/i)).toBeDisabled();
    });

    it('Join Points button is disabled', () => {
      renderToolbar();
      expect(screen.getByTitle(/Join Points/i)).toBeDisabled();
    });
  });

  // ── Document loaded, no path selected ────────────────────────────────────

  describe('when a document is loaded but no path is selected', () => {
    beforeEach(() => {
      useEditorStore.setState({
        svgDocument: createTestDocument([createTestPath(), createTestPath()]),
        selectedPathIds: [],
      });
    });

    it('Smart Heal button is disabled', () => {
      renderToolbar();
      expect(screen.getByTitle(/Smart Heal/i)).toBeDisabled();
    });

    it('Smooth Path button is disabled', () => {
      renderToolbar();
      expect(screen.getByTitle(/Smooth Path/i)).toBeDisabled();
    });

    it('Merge Paths button is enabled (document has 2 paths)', () => {
      renderToolbar();
      expect(screen.getByTitle(/Merge Paths/i)).not.toBeDisabled();
    });

    it('Path Alignment button is enabled (document has 2 paths)', () => {
      renderToolbar();
      expect(screen.getByTitle(/Path Alignment/i)).not.toBeDisabled();
    });

    it('Perfect Square button is enabled (document has paths)', () => {
      renderToolbar();
      expect(screen.getByTitle(/Perfect Square/i)).not.toBeDisabled();
    });
  });

  // ── Document loaded and a path is selected ───────────────────────────────

  describe('when a document is loaded and a path is selected', () => {
    beforeEach(() => {
      const path = createTestPath();
      useEditorStore.setState({
        svgDocument: createTestDocument([path]),
        selectedPathIds: [path.id],
      });
    });

    it('Smart Heal button is enabled', () => {
      renderToolbar();
      expect(screen.getByTitle(/Smart Heal/i)).not.toBeDisabled();
    });

    it('Smooth Path button is enabled', () => {
      renderToolbar();
      expect(screen.getByTitle(/Smooth Path/i)).not.toBeDisabled();
    });
  });

  // ── Join Points — requires editing path + 2+ points selected ────────────

  describe('Join Points button', () => {
    it('is disabled when no editing path is set', () => {
      useEditorStore.setState({
        svgDocument: createTestDocument(),
        editingPathId: null,
        selectedPointIndices: [],
      });
      renderToolbar();
      expect(screen.getByTitle(/Join Points/i)).toBeDisabled();
    });

    it('is disabled when fewer than 2 points are selected', () => {
      const path = createTestPath();
      useEditorStore.setState({
        svgDocument: createTestDocument([path]),
        editingPathId: path.id,
        selectedPointIndices: [0], // Only one point
      });
      renderToolbar();
      expect(screen.getByTitle(/Join Points/i)).toBeDisabled();
    });

    it('is enabled when editing and 2+ points selected', () => {
      const path = createTestPath();
      useEditorStore.setState({
        svgDocument: createTestDocument([path]),
        editingPathId: path.id,
        selectedPointIndices: [0, 1],
      });
      renderToolbar();
      expect(screen.getByTitle(/Join Points/i)).not.toBeDisabled();
    });
  });

  // ── View toggles ─────────────────────────────────────────────────────────

  describe('view toggles', () => {
    beforeEach(() => {
      useEditorStore.setState({
        svgDocument: createTestDocument(),
        snapToGrid: false,
        showHeatmap: false,
      });
    });

    it('clicking Snap to Grid toggles snapToGrid in the store', () => {
      renderToolbar();
      expect(useEditorStore.getState().snapToGrid).toBe(false);
      fireEvent.click(screen.getByTitle(/Snap to Grid/i));
      expect(useEditorStore.getState().snapToGrid).toBe(true);
    });

    it('clicking Snap to Grid again toggles it back off', () => {
      useEditorStore.setState({ snapToGrid: true });
      renderToolbar();
      fireEvent.click(screen.getByTitle(/Snap to Grid/i));
      expect(useEditorStore.getState().snapToGrid).toBe(false);
    });

    it('clicking Complexity Heatmap toggles showHeatmap in the store', () => {
      renderToolbar();
      expect(useEditorStore.getState().showHeatmap).toBe(false);
      fireEvent.click(screen.getByTitle(/Complexity Heatmap/i));
      expect(useEditorStore.getState().showHeatmap).toBe(true);
    });

    it('clicking Complexity Heatmap again toggles it back off', () => {
      useEditorStore.setState({ showHeatmap: true });
      renderToolbar();
      fireEvent.click(screen.getByTitle(/Complexity Heatmap/i));
      expect(useEditorStore.getState().showHeatmap).toBe(false);
    });
  });

  // ── PRO buttons suppressed in free tier ──────────────────────────────────

  describe('PRO feature buttons in free tier', () => {
    it('Auto Refine button is not rendered (requires PRO)', () => {
      useEditorStore.setState({ svgDocument: createTestDocument() });
      renderToolbar(); // isProVersion: false
      // The Wand2 icon button is only rendered when hasProFeatures is true
      expect(screen.queryByTitle(/Auto Refine/i)).toBeNull();
    });

    it('Auto Colorize button is not rendered (requires PRO)', () => {
      useEditorStore.setState({ svgDocument: createTestDocument() });
      renderToolbar();
      expect(screen.queryByTitle(/Auto.*[Cc]oloriz/i)).toBeNull();
    });
  });
});
