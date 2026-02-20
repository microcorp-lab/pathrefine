/**
 * Component tests — PropertiesPanel
 *
 * Covers:
 * - Empty state when no document is loaded
 * - Document info (path count, dimensions) render correctly
 * - Path list renders all path IDs
 * - Delete confirmation two-step pattern (first click = pending, second click = confirm)
 * - Escape key cancels a pending delete without deleting the path
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { PropertiesPanel } from '../../components/PropertiesPanel/PropertiesPanel';
import { useEditorStore } from '../../store/editorStore';
import {
  renderWithProviders,
  createTestDocument,
  createTestPath,
  resetEditorStore,
} from '../helpers/renderWithProviders';

// ── Window size setup ─────────────────────────────────────────────────────────
// PropertiesPanel auto-collapses when innerWidth < 768 (JSDOM default is 0).
// Force a desktop width so the panel stays open during tests.
const originalInnerWidth = window.innerWidth;

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
});

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPanel() {
  return renderWithProviders(<PropertiesPanel />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PropertiesPanel', () => {
  beforeEach(() => {
    resetEditorStore();
    vi.clearAllMocks();
  });

  // ── Empty state ───────────────────────────────────────────────────────────

  describe('when no document is loaded', () => {
    it('shows "No document loaded" message', () => {
      renderPanel();
      expect(screen.getByText('No document loaded')).toBeInTheDocument();
    });

    it('does not show a path list', () => {
      renderPanel();
      expect(screen.queryByText('All Paths')).toBeNull();
    });
  });

  // ── Document info ─────────────────────────────────────────────────────────

  describe('when a document is loaded', () => {
    beforeEach(() => {
      const paths = [createTestPath(), createTestPath()];
      useEditorStore.setState({ svgDocument: createTestDocument(paths) });
    });

    it('shows the document section heading', () => {
      renderPanel();
      expect(screen.getByText('Properties')).toBeInTheDocument();
    });

    it('shows the correct path count', () => {
      renderPanel();
      // "Paths:" label + the count value
      expect(screen.getByText('Paths:')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('shows the document width and height', () => {
      renderPanel();
      // Both width and height are 100 → two elements share the same text
      const dimensionEls = screen.getAllByText('100px');
      expect(dimensionEls.length).toBeGreaterThanOrEqual(2);
    });

    it('renders the All Paths section header', () => {
      renderPanel();
      expect(screen.getByText('All Paths')).toBeInTheDocument();
    });

    it('renders each path ID in the path list', () => {
      const paths = [
        createTestPath({ id: 'rect-alpha' }),
        createTestPath({ id: 'rect-beta' }),
      ];
      useEditorStore.setState({ svgDocument: createTestDocument(paths) });
      renderPanel();
      expect(screen.getByText('rect-alpha')).toBeInTheDocument();
      expect(screen.getByText('rect-beta')).toBeInTheDocument();
    });
  });

  // ── Delete confirmation two-step ─────────────────────────────────────────

  describe('path delete confirmation', () => {
    const PATH_ID = 'deletable-path';

    beforeEach(() => {
      const path = createTestPath({ id: PATH_ID });
      useEditorStore.setState({
        svgDocument: createTestDocument([path]),
        selectedPathIds: [PATH_ID],
      });
    });

    it('shows a delete button for the selected path', () => {
      renderPanel();
      const deleteBtn = screen.getByRole('button', { name: new RegExp(`Delete path ${PATH_ID}`, 'i') });
      expect(deleteBtn).toBeInTheDocument();
    });

    it('first click puts the button in a pending/confirm state', () => {
      renderPanel();
      const deleteBtn = screen.getByRole('button', { name: new RegExp(`Delete path ${PATH_ID}`, 'i') });
      fireEvent.click(deleteBtn);

      // After first click the button label changes to "Confirm delete ..."
      expect(
        screen.getByRole('button', { name: new RegExp(`Confirm delete ${PATH_ID}`, 'i') }),
      ).toBeInTheDocument();
    });

    it('does NOT delete the path after only the first click', () => {
      renderPanel();
      const deleteBtn = screen.getByRole('button', { name: new RegExp(`Delete path ${PATH_ID}`, 'i') });
      fireEvent.click(deleteBtn);

      // Path should still be in the store
      const store = useEditorStore.getState();
      expect(store.svgDocument?.paths.some((p) => p.id === PATH_ID)).toBe(true);
    });

    it('second click on the confirm button removes the path', () => {
      renderPanel();

      // First click
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`Delete path ${PATH_ID}`, 'i') }));
      // Second click (button is now in confirm state)
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`Confirm delete ${PATH_ID}`, 'i') }));

      const store = useEditorStore.getState();
      expect(store.svgDocument?.paths.some((p) => p.id === PATH_ID)).toBe(false);
    });

    it('pressing Escape after first click cancels the pending delete', () => {
      renderPanel();
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`Delete path ${PATH_ID}`, 'i') }));

      // Pending confirm state should be visible
      expect(
        screen.getByRole('button', { name: new RegExp(`Confirm delete ${PATH_ID}`, 'i') }),
      ).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape' });

      // Button should return to initial "Delete path" state
      expect(
        screen.getByRole('button', { name: new RegExp(`Delete path ${PATH_ID}`, 'i') }),
      ).toBeInTheDocument();
      // Path must still exist
      expect(useEditorStore.getState().svgDocument?.paths.some((p) => p.id === PATH_ID)).toBe(true);
    });
  });

  // ── Multi-path delete ─────────────────────────────────────────────────────

  describe('multi-path delete ("Delete All" button)', () => {
    const IDS = ['path-one', 'path-two'];

    beforeEach(() => {
      const paths = IDS.map((id) => createTestPath({ id }));
      useEditorStore.setState({
        svgDocument: createTestDocument(paths),
        selectedPathIds: [...IDS],
      });
    });

    it('shows a "Delete All" button when multiple paths are selected', () => {
      renderPanel();
      expect(screen.getByRole('button', { name: /Delete All/i })).toBeInTheDocument();
    });

    it('first click on Delete All shows a "Confirm?" label', () => {
      renderPanel();
      fireEvent.click(screen.getByRole('button', { name: /Delete all selected paths/i }));
      // After first click the aria-label changes to "Confirm delete all …"
      expect(screen.getByRole('button', { name: /Confirm delete all/i })).toBeInTheDocument();
    });

    it('second click on Confirm? removes all selected paths', () => {
      renderPanel();
      fireEvent.click(screen.getByRole('button', { name: /Delete all selected paths/i }));
      fireEvent.click(screen.getByRole('button', { name: /Confirm delete all/i }));

      const paths = useEditorStore.getState().svgDocument?.paths ?? [];
      expect(paths.length).toBe(0);
    });

    it('pressing Escape after first click cancels the pending delete-all', () => {
      renderPanel();
      fireEvent.click(screen.getByRole('button', { name: /Delete All/i }));
      fireEvent.keyDown(window, { key: 'Escape' });
      // Button should be back to "Delete All"
      expect(screen.getByRole('button', { name: /Delete All/i })).toBeInTheDocument();
      // Paths are unchanged
      expect(useEditorStore.getState().svgDocument?.paths.length).toBe(2);
    });
  });
});
