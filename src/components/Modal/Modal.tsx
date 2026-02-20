/**
 * Base Modal component
 *
 * Features:
 * - AnimatePresence enter/exit animations (framer-motion)
 * - Portal render to document.body
 * - Backdrop click to close
 * - Escape key to close
 * - Focus trap (Tab/Shift+Tab cycles within modal only)
 * - Body scroll lock while open
 * - role="dialog", aria-modal, aria-labelledby
 * - Four size presets: sm | md | lg | xl
 */
import React, { useEffect, useRef, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const SIZE_CLASSES: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Optional icon shown to the left of the title */
  titleIcon?: React.ReactNode;
  /** Optional content appended to the right of the title (before close button) */
  titleExtra?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Whether clicking the backdrop closes the modal. Default true. */
  closeOnBackdrop?: boolean;
  /** Optional pinned footer area for action buttons */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  titleIcon,
  titleExtra,
  size = 'md',
  closeOnBackdrop = true,
  footer,
  children,
}) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Escape to close ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);

  // ── Body scroll lock ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // ── Focus management ─────────────────────────────────────────────────────
  // On open: focus the first focusable element inside the panel
  useEffect(() => {
    if (!isOpen) return;
    // Defer until after the animation starts
    const id = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTORS);
      first?.focus();
    }, 50);
    return () => clearTimeout(id);
  }, [isOpen]);

  // Focus trap: Tab / Shift+Tab stays within the modal
  const onKeyDownPanel = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;

    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(
      (el) => !el.closest('[aria-hidden]')
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        // Backdrop
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={closeOnBackdrop ? onClose : undefined}
          aria-hidden="false"
        >
          {/* Backdrop blur layer */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`
              relative w-full ${SIZE_CLASSES[size]}
              bg-bg-secondary border border-border rounded-xl shadow-2xl
              flex flex-col overflow-hidden
              max-h-[calc(100vh-2rem)]
            `}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDownPanel}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {titleIcon && (
                  <span className="flex-shrink-0 text-accent-primary">{titleIcon}</span>
                )}
                <h2
                  id={titleId}
                  className="text-base font-semibold text-white leading-none truncate"
                >
                  {title}
                </h2>
                {titleExtra && (
                  <div className="flex-shrink-0 ml-2">{titleExtra}</div>
                )}
              </div>
              <button
                onClick={onClose}
                className="ml-3 p-1.5 rounded-lg text-text-secondary hover:bg-bg-tertiary hover:text-white transition-colors"
                aria-label="Close dialog"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M1 1l12 12M13 1L1 13" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 p-5">
              {children}
            </div>

            {/* Pinned footer */}
            {footer && (
              <div className="flex-shrink-0 border-t border-border px-5 py-3">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
