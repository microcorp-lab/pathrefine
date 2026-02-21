import React from 'react';
import { Info, X } from 'lucide-react';

interface CanvasHintsProps {
  showHints: boolean;
  isTouchDevice: boolean;
  onShow: () => void;
  onHide: () => void;
}

/**
 * Keyboard/touch interaction hints shown above the canvas in edit mode.
 * Receives show/hide callbacks so the parent controls persistence logic.
 */
export const CanvasHints: React.FC<CanvasHintsProps> = ({
  showHints,
  isTouchDevice,
  onShow,
  onHide,
}) => (
  <div
    className="absolute bottom-0 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center"
    onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
    onPointerDown={e => e.stopPropagation()}
  >
    {showHints ? (
      <div className="bg-bg-secondary/95 backdrop-blur border border-border border-b-0 rounded-t-lg text-sm text-text-secondary shadow-lg px-4 py-2">
        <div className="flex items-center gap-4">
          {isTouchDevice ? (
            <>
              <span>👆 Tap to select</span>
              <span className="hidden sm:inline">Drag to move points</span>
              <span className="hidden md:inline">Pinch to zoom</span>
            </>
          ) : (
            <>
              <span className="hidden sm:inline">🖱️ Drag points</span>
              <span className="hidden md:inline">⌥ + Click to add</span>
              <span className="hidden md:inline">⇧ + Drag multi-select</span>
              <span className="hidden lg:inline">Space + Drag pan</span>
              <span className="hidden lg:inline text-indigo-400">F Fit</span>
              <span className="hidden md:inline">⌫ Delete</span>
            </>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onHide(); }}
            className="ml-2 p-1 hover:bg-bg-tertiary rounded transition-colors"
            title={isTouchDevice ? 'Hide hints' : 'Hide hints (press i to toggle)'}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    ) : (
      <button
        onClick={(e) => { e.stopPropagation(); onShow(); }}
        className="flex items-center gap-1.5 bg-bg-secondary border border-border border-b-0 rounded-t px-3 py-1 hover:bg-bg-tertiary transition-colors text-text-secondary"
        title={isTouchDevice ? 'Show touch hints' : 'Show keyboard shortcuts (i)'}
      >
        <Info size={13} />
      </button>
    )}
  </div>
);
