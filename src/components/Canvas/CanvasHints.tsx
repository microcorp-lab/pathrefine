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
  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none">
    <div className="pointer-events-auto">
      {showHints ? (
        <div className="bg-bg-secondary/90 backdrop-blur px-4 py-2 rounded-lg text-sm text-text-secondary relative shadow-lg">
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
                <span className="hidden md:inline">⌫ Delete</span>
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onHide();
              }}
              className="ml-2 p-1 hover:bg-bg-tertiary rounded transition-colors"
              title={isTouchDevice ? 'Hide hints' : 'Hide hints (press i to toggle)'}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onShow();
          }}
          className="bg-bg-secondary/90 backdrop-blur px-3 py-2 rounded-lg hover:bg-bg-tertiary transition-colors shadow-lg"
          title={isTouchDevice ? 'Show touch hints' : 'Show hints (press i)'}
        >
          <Info size={16} className="text-text-secondary" />
        </button>
      )}
    </div>
  </div>
);
