import React, { useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  label: string;
  /** Keyboard shortcut displayed in a <kbd> chip, e.g. "H" or "⇧A" */
  shortcut?: string;
  /** One-line description shown below the label */
  description?: string;
  children: React.ReactNode;
}

/**
 * Wraps a single child (typically a toolbar button) and shows a rich tooltip
 * to its right after a 300 ms hover delay.
 *
 * Uses createPortal + position:fixed to escape any overflow:hidden/auto
 * parent containers (e.g. the scrollable toolbar column).
 */
export const Tooltip: React.FC<TooltipProps> = ({ label, shortcut, description, children }) => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos]         = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const r = triggerRef.current.getBoundingClientRect();
        setPos({ x: r.right + 10, y: r.top + r.height / 2 });
        setVisible(true);
      }
    }, 300);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  return (
    <>
      <div ref={triggerRef} onMouseEnter={show} onMouseLeave={hide}>
        {children}
      </div>

      {visible && createPortal(
        <div
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            transform: 'translateY(-50%)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          {/* Arrow pointing left toward the toolbar */}
          <div
            style={{
              position: 'absolute',
              right: '100%',
              top: '50%',
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: '5px solid transparent',
              borderBottom: '5px solid transparent',
              borderRight: '6px solid #404040',
            }}
          />

          <div className="animate-tooltip-in bg-bg-secondary border border-border rounded-xl px-3 py-2.5 shadow-2xl min-w-[148px] max-w-[220px]">
            {/* Label row */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-white text-[13px] font-semibold leading-tight">
                {label}
              </span>
              {shortcut && (
                <kbd className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono bg-bg-primary border border-border rounded-md text-text-secondary leading-none">
                  {shortcut}
                </kbd>
              )}
            </div>

            {/* Description */}
            {description && (
              <p className="mt-1 text-[11px] text-text-secondary leading-snug">
                {description}
              </p>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
