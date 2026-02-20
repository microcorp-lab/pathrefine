/**
 * Component tests — ExportSVGModal
 *
 * Covers:
 * - Modal not rendered when isOpen=false
 * - Modal not rendered when svgDocument is null (even if isOpen=true)
 * - Modal renders with correct ARIA attributes: role="dialog", aria-modal="true"
 * - Escape key triggers onClose
 * - Clicking the backdrop area triggers onClose
 * - Step 1 shows "Next →" button; step 2 shows "Download SVG" button
 *
 * framer-motion is transparently mocked so AnimatePresence/motion.div
 * don't require real animation frames in JSDOM.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { ExportSVGModal } from '../../components/ExportSVGModal/ExportSVGModal';
import { useEditorStore } from '../../store/editorStore';
import {
  renderWithProviders,
  createTestDocument,
  resetEditorStore,
} from '../helpers/renderWithProviders';

// ── framer-motion mock ────────────────────────────────────────────────────────
// Replace AnimatePresence + motion.* with transparent passthrough components so
// animation doesn't require a real requestAnimationFrame loop or DOM measurements.
vi.mock('framer-motion', async () => {
  const React = await import('react');
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: new Proxy(
      {},
      {
        get: (_target, tag: string) =>
          React.forwardRef(
            (
              { children, initial, animate, exit, transition, layout, ...rest }: React.ComponentProps<'div'> & Record<string, unknown>,
              ref: React.ForwardedRef<HTMLElement>,
            ) =>
              React.createElement(tag, { ...rest, ref }, children),
          ),
      },
    ),
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderModal(isOpen: boolean, onClose = vi.fn()) {
  return { onClose, ...renderWithProviders(<ExportSVGModal isOpen={isOpen} onClose={onClose} />) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ExportSVGModal', () => {
  beforeEach(() => {
    resetEditorStore();
    vi.clearAllMocks();
  });

  // ── Visibility guards ─────────────────────────────────────────────────────

  describe('visibility', () => {
    it('does not render a dialog when isOpen=false', () => {
      useEditorStore.setState({ svgDocument: createTestDocument() });
      renderModal(false);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('does not render a dialog when isOpen=true but svgDocument is null', () => {
      // svgDocument defaults to null after resetEditorStore()
      renderModal(true);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('renders a dialog when isOpen=true and a document is loaded', () => {
      useEditorStore.setState({ svgDocument: createTestDocument() });
      renderModal(true);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // ── ARIA attributes ───────────────────────────────────────────────────────

  describe('ARIA attributes', () => {
    beforeEach(() => {
      useEditorStore.setState({ svgDocument: createTestDocument() });
    });

    it('dialog has aria-modal="true"', () => {
      renderModal(true);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('dialog has an aria-labelledby attribute pointing to the title', () => {
      renderModal(true);
      const dialog = screen.getByRole('dialog');
      const labelId = dialog.getAttribute('aria-labelledby');
      expect(labelId).toBeTruthy();
      // The element that carries the label ID should contain the modal title
      const titleEl = document.getElementById(labelId!);
      expect(titleEl?.textContent).toMatch(/Export to SVG/i);
    });
  });

  // ── Keyboard & backdrop close ─────────────────────────────────────────────

  describe('closing the modal', () => {
    beforeEach(() => {
      useEditorStore.setState({ svgDocument: createTestDocument() });
    });

    it('pressing Escape calls onClose', () => {
      const { onClose } = renderModal(true);
      // The Modal listens on the document in capture phase
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('clicking the backdrop area calls onClose', () => {
      const { onClose } = renderModal(true);
      // The backdrop is the outermost motion.div (rendered as div) with aria-hidden="false".
      // Clicking it fires the onClose via the onClick prop.
      const backdrop = document.body.querySelector('[aria-hidden="false"]') as HTMLElement;
      expect(backdrop).not.toBeNull();
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('clicking the Close (×) button calls onClose', () => {
      const { onClose } = renderModal(true);
      fireEvent.click(screen.getByRole('button', { name: /Close dialog/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Two-step flow ─────────────────────────────────────────────────────────

  describe('step navigation', () => {
    beforeEach(() => {
      useEditorStore.setState({ svgDocument: createTestDocument() });
    });

    it('renders Step 1 with a "Next →" button on open', () => {
      renderModal(true);
      expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Download SVG/i })).toBeNull();
    });

    it('clicking "Next →" advances to Step 2', () => {
      renderModal(true);
      fireEvent.click(screen.getByRole('button', { name: /Next/i }));
      expect(screen.getByRole('button', { name: /Download SVG/i })).toBeInTheDocument();
    });

    it('Step 2 shows a "← Back" button to return to Step 1', () => {
      renderModal(true);
      fireEvent.click(screen.getByRole('button', { name: /Next/i }));
      expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
    });

    it('clicking "← Back" from Step 2 returns to Step 1', () => {
      renderModal(true);
      fireEvent.click(screen.getByRole('button', { name: /Next/i }));
      fireEvent.click(screen.getByRole('button', { name: /Back/i }));
      expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument();
    });

    it('Step 2 shows a filename input', () => {
      renderModal(true);
      fireEvent.click(screen.getByRole('button', { name: /Next/i }));
      expect(screen.getByPlaceholderText('icon')).toBeInTheDocument();
    });

    it('Step 2 shows the path count in the export summary', () => {
      const paths = [createTestDocument().paths[0]];
      useEditorStore.setState({ svgDocument: createTestDocument(paths) });
      renderModal(true);
      fireEvent.click(screen.getByRole('button', { name: /Next/i }));
      expect(screen.getByText(/Paths:/i)).toBeInTheDocument();
    });
  });
});
