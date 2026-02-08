import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { perfectSquare } from '../../engine/perfectSquare';
import { exportSVG } from '../../engine/parser';
import { fitToContent, bakeTransforms } from '../../engine/viewBoxFitting';

interface PerfectSquareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_SIZES = [16, 24, 32, 64, 128] as const;

export const PerfectSquareModal: React.FC<PerfectSquareModalProps> = ({ isOpen, onClose }) => {
  const svgDocument = useEditorStore(state => state.svgDocument);
  const setSVGDocument = useEditorStore(state => state.setSVGDocument);
  
  const [size, setSize] = useState<number>(24);
  const [customSize, setCustomSize] = useState<string>('');
  const [padding, setPadding] = useState<number>(2);
  const [useCustomSize, setUseCustomSize] = useState(false);
  const [removeWhitespace, setRemoveWhitespace] = useState(true);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [showActualSize, setShowActualSize] = useState(false);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Generate live preview
  const previewSvg = useMemo(() => {
    if (!isOpen || !svgDocument) return '';
    
    const targetSize = useCustomSize 
      ? parseInt(customSize) || 24 
      : size;

    if (targetSize < 8 || targetSize > 512) return '';
    if (padding < 0 || padding > targetSize / 2) return '';

    // Always bake transforms first for clean output
    let processedDoc = bakeTransforms(svgDocument);
    
    // Then remove whitespace if requested
    if (removeWhitespace) {
      processedDoc = fitToContent(processedDoc, 0);
    }

    const previewDoc = perfectSquare(processedDoc, targetSize, padding, offsetX, offsetY);
    const svgString = exportSVG(previewDoc);
    
    // Calculate display size
    const displaySize = showActualSize ? targetSize : Math.min(targetSize * 8, 400);
    
    // Scale border thickness so it's always ~1-2px on screen regardless of viewBox size
    const borderThickness = showActualSize ? 1 : Math.max(0.5, 2 / (displaySize / targetSize));
    
    // Inject viewBox border visualization directly into the SVG
    const viewBoxBorder = `<rect x="0" y="0" width="${targetSize}" height="${targetSize}" fill="none" stroke="#6366f1" stroke-width="${borderThickness}" stroke-dasharray="${borderThickness * 4},${borderThickness * 2}" opacity="0.4" />`;
    
    // Replace existing width/height with scaled display size
    const modifiedSvg = svgString
      .replace(/width="[^"]*"/, `width="${displaySize}"`)
      .replace(/height="[^"]*"/, `height="${displaySize}"`)
      .replace(/(<svg[^>]*>)/, `$1${viewBoxBorder}`);
    
    return modifiedSvg;
  }, [isOpen, svgDocument, size, customSize, padding, useCustomSize, removeWhitespace, offsetX, offsetY, showActualSize]);

  const handleApply = useCallback(() => {
    if (!svgDocument) return;

    const targetSize = useCustomSize 
      ? parseInt(customSize) || 24 
      : size;

    if (targetSize < 8 || targetSize > 512) {
      alert('Size must be between 8 and 512 pixels');
      return;
    }

    if (padding < 0 || padding > targetSize / 2) {
      alert(`Padding must be between 0 and ${targetSize / 2} pixels`);
      return;
    }

    // Always bake transforms first for clean output
    let processedDoc = bakeTransforms(svgDocument);
    
    // Then remove whitespace if requested
    if (removeWhitespace) {
      processedDoc = fitToContent(processedDoc, 0);
    }

    const squared = perfectSquare(processedDoc, targetSize, padding, offsetX, offsetY);
    setSVGDocument(squared);
    onClose();
  }, [svgDocument, size, customSize, padding, useCustomSize, removeWhitespace, offsetX, offsetY, setSVGDocument, onClose]);

  if (!isOpen || !svgDocument) return null;

  const finalSize = useCustomSize ? parseInt(customSize) || 24 : size;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-secondary rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-semibold">Perfect Square</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content - Two Column Layout */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
            {/* Left Column - Controls */}
            <div className="space-y-6">
              {/* Size Selection */}
              <div>
                <label className="block text-sm font-medium mb-3">ViewBox Size</label>
                
                {/* Preset sizes */}
                <div className="flex gap-2 mb-3">
                  {PRESET_SIZES.map(presetSize => (
                    <button
                      key={presetSize}
                      onClick={() => {
                        setSize(presetSize);
                        setUseCustomSize(false);
                      }}
                      className={`
                        px-3 py-2 rounded transition-colors text-sm font-medium
                        ${!useCustomSize && size === presetSize
                          ? 'bg-accent-primary text-white' 
                          : 'bg-bg-tertiary text-text-secondary hover:bg-border'
                        }
                      `}
                    >
                      {presetSize}×{presetSize}
                    </button>
                  ))}
                </div>

                {/* Custom size */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useCustom"
                    checked={useCustomSize}
                    onChange={(e) => setUseCustomSize(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-bg-tertiary"
                  />
                  <label htmlFor="useCustom" className="text-sm text-text-secondary">
                    Custom size:
                  </label>
                  <input
                    type="number"
                    value={customSize}
                    onChange={(e) => setCustomSize(e.target.value)}
                    onFocus={() => setUseCustomSize(true)}
                    placeholder="e.g., 48"
                    min="8"
                    max="512"
                    className="flex-1 px-3 py-1.5 bg-bg-primary text-white rounded border border-border focus:outline-none focus:border-accent-primary text-sm"
                  />
                  <span className="text-sm text-text-secondary">px</span>
                </div>
              </div>

              {/* Remove Whitespace Option */}
              <div className="bg-bg-tertiary rounded p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={removeWhitespace}
                    onChange={(e) => setRemoveWhitespace(e.target.checked)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <div>
                    <div className="text-sm font-medium">Remove whitespace first</div>
                    <div className="text-xs text-text-secondary">
                      Fit viewBox to content before centering
                    </div>
                  </div>
                </label>
              </div>

              {/* Padding Control */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Padding: <span className="text-accent-primary">{padding}px</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max={Math.min(20, finalSize / 2)}
                  value={padding}
                  onChange={(e) => setPadding(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-text-secondary mt-1">
                  <span>0px (no padding)</span>
                  <span>Max: {Math.min(20, finalSize / 2)}px</span>
                </div>
              </div>

              {/* Offset Controls */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    X Offset: <span className="text-accent-primary">{offsetX}px</span>
                  </label>
                  <input
                    type="range"
                    min={-finalSize / 4}
                    max={finalSize / 4}
                    value={offsetX}
                    onChange={(e) => setOffsetX(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Y Offset: <span className="text-accent-primary">{offsetY}px</span>
                  </label>
                  <input
                    type="range"
                    min={-finalSize / 4}
                    max={finalSize / 4}
                    value={offsetY}
                    onChange={(e) => setOffsetY(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                {(offsetX !== 0 || offsetY !== 0) && (
                  <button
                    onClick={() => { setOffsetX(0); setOffsetY(0); }}
                    className="text-xs text-accent-primary hover:underline"
                  >
                    Reset to center
                  </button>
                )}
              </div>

              {/* Preview Info */}
              <div className="bg-bg-tertiary rounded p-3 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-text-secondary">Final ViewBox:</span>
                  <span className="font-mono">
                    0 0 {finalSize} {finalSize}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Content Area:</span>
                  <span className="font-mono">
                    {finalSize - (padding * 2)}×{finalSize - (padding * 2)}px
                  </span>
                </div>
              </div>

              {/* Help text */}
              <p className="text-xs text-text-secondary">
                💡 This will center your artwork and set a standard viewBox for icon consistency.
                Transforms will be baked into coordinates.
              </p>
            </div>

            {/* Right Column - Live Preview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">Live Preview</label>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={showActualSize}
                    onChange={(e) => setShowActualSize(e.target.checked)}
                    className="w-3 h-3 rounded border-border"
                  />
                  <span className="text-text-secondary">Show actual size</span>
                </label>
              </div>
              
              <div className="bg-bg-tertiary rounded-lg p-6 flex items-center justify-center min-h-[300px] border-2 border-border">
                  <div 
                    dangerouslySetInnerHTML={{ __html: previewSvg }}
                  />
              </div>
              
              {/* Preview info */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded p-2 text-xs text-blue-200">
                {showActualSize ? (
                  <span><strong>Actual size:</strong> Showing {finalSize}×{finalSize} at real dimensions</span>
                ) : (
                  <span><strong>Preview scaled:</strong> Showing {finalSize}×{finalSize} viewBox at {Math.min(finalSize * 8, 400)}px for visibility</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-bg-tertiary hover:bg-border rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 bg-accent-primary hover:bg-indigo-600 rounded transition-colors"
          >
            Apply Perfect Square
          </button>
        </div>
      </div>
    </div>
  );
};
