import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AlignVerticalDistributeCenter, Info } from 'lucide-react';
import type { PathAlignment, Path } from '../../types/svg';
import { useEditorStore } from '../../store/editorStore';
import { alignPathsToPath } from '../../engine/alignment';

interface PathAlignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (alignment: PathAlignment) => void;
  availablePaths: Path[];
  selectedPathIds: string[];
}

export const PathAlignmentModal: React.FC<PathAlignmentModalProps> = ({
  isOpen,
  onClose,
  onApply,
  availablePaths,
  selectedPathIds,
}) => {
  const svgDocument = useEditorStore(state => state.svgDocument);
  const setPathAlignmentSelectionMode = useEditorStore(state => state.setPathAlignmentSelectionMode);
  const setPathAlignmentPreview = useEditorStore(state => state.setPathAlignmentPreview);
  const pathAlignmentSelectionMode = useEditorStore(state => state.pathAlignmentSelectionMode);
  
  // Local preview state (don't use store for modal preview)
  const [localPreview, setLocalPreview] = useState<Path[] | null>(null);
  
  // State for all alignment parameters
  const [sourcePathId, setSourcePathId] = useState('');
  const [targetPathId, setTargetPathId] = useState('');
  const [repeatCount, setRepeatCount] = useState(1);
  const [scale, setScale] = useState(100);
  const [pathRangeStart, setPathRangeStart] = useState(0);
  const [pathRangeEnd, setPathRangeEnd] = useState(100);
  const [offset, setOffset] = useState(0);
  const [perpOffset, setPerpOffset] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [preserveShape, setPreserveShape] = useState(true);
  
  // Variation controls (collapsed by default)
  const [showVariation, setShowVariation] = useState(false);
  const [randomRotation, setRandomRotation] = useState(0);
  const [randomScale, setRandomScale] = useState(0);
  const [randomOffset, setRandomOffset] = useState(0);
  const [randomSeed, setRandomSeed] = useState(Date.now());

  // View controls
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const originalPreviewRef = useRef<HTMLDivElement>(null);
  const alignedPreviewRef = useRef<HTMLDivElement>(null);

  // Initialize source/target from selected paths
  useEffect(() => {
    if (isOpen && selectedPathIds.length >= 1 && !sourcePathId) {
      setSourcePathId(selectedPathIds[0]);
      if (selectedPathIds.length >= 2) {
        setTargetPathId(selectedPathIds[1]);
      }
    }
  }, [isOpen, selectedPathIds, sourcePathId]);

  // Update preview when settings change
  const updatePreview = useCallback(() => {
    if (!sourcePathId || !targetPathId) {
      setLocalPreview(null);
      return;
    }

    const sourcePath = availablePaths.find(p => p.id === sourcePathId);
    const targetPath = availablePaths.find(p => p.id === targetPathId);

    if (!sourcePath || !targetPath) {
      setLocalPreview(null);
      return;
    }

    const alignment: PathAlignment = {
      sourcePathId,
      targetPathId,
      offset: offset / 100,
      perpOffset,
      rotation,
      preserveShape,
      repeatCount,
      scale: scale / 100,
      pathRangeStart: pathRangeStart / 100,
      pathRangeEnd: pathRangeEnd / 100,
      randomRotation,
      randomScale,
      randomOffset,
      randomSeed,
    };

    try {
      const previewPaths = alignPathsToPath(sourcePath, targetPath, alignment);
      console.log('Preview generated:', previewPaths.length, 'paths');
      setLocalPreview(previewPaths);
    } catch (error) {
      console.error('Preview generation failed:', error);
      setLocalPreview(null);
    }
  }, [
    sourcePathId,
    targetPathId,
    availablePaths,
    repeatCount,
    scale,
    pathRangeStart,
    pathRangeEnd,
    offset,
    perpOffset,
    rotation,
    preserveShape,
    randomRotation,
    randomScale,
    randomOffset,
    randomSeed,
    setPathAlignmentPreview,
  ]);

  // Update preview when any setting changes
  useEffect(() => {
    if (isOpen) {
      updatePreview();
    }
  }, [
    isOpen,
    updatePreview,
  ]);

  // Clean up on close
  useEffect(() => {
    if (!isOpen) {
      setLocalPreview(null);
      setPathAlignmentSelectionMode('none');
    }
  }, [isOpen, setPathAlignmentSelectionMode]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // If in selection mode, cancel selection mode first
        if (pathAlignmentSelectionMode !== 'none') {
          setPathAlignmentSelectionMode('none');
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose, pathAlignmentSelectionMode, setPathAlignmentSelectionMode]);

  // Listen for path selection from canvas
  useEffect(() => {
    const handlePathSelected = (e: CustomEvent) => {
      const { pathId, mode } = e.detail;
      if (mode === 'source') {
        setSourcePathId(pathId);
        setPathAlignmentSelectionMode('none');
      } else if (mode === 'target') {
        setTargetPathId(pathId);
        setPathAlignmentSelectionMode('none');
      }
    };
    
    if (isOpen) {
      window.addEventListener('pathAlignmentPathSelected', handlePathSelected as EventListener);
      return () => window.removeEventListener('pathAlignmentPathSelected', handlePathSelected as EventListener);
    }
  }, [isOpen, setPathAlignmentSelectionMode]);

  // Handle Panning and Zooming
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsPanning(true);
    setPanStart({ x: e.clientX - previewPan.x, y: e.clientY - previewPan.y });
  }, [previewPan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    e.preventDefault();
    setPreviewPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    });
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Handle Zoom with Wheel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scaleChange = -e.deltaY * 0.001;
      setPreviewZoom(z => Math.max(0.1, Math.min(5, z + scaleChange)));
    };

    const originalDiv = originalPreviewRef.current;
    const alignedDiv = alignedPreviewRef.current;

    if (originalDiv) {
      originalDiv.addEventListener('wheel', handleWheel, { passive: false });
    }
    if (alignedDiv) {
      alignedDiv.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (originalDiv) {
        originalDiv.removeEventListener('wheel', handleWheel);
      }
      if (alignedDiv) {
        alignedDiv.removeEventListener('wheel', handleWheel);
      }
    };
  }, []);

  const resetView = () => {
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
  };

  if (!isOpen) return null;

  const handleApply = () => {
    if (!sourcePathId || !targetPathId) {
      alert('Please select both source and target paths');
      return;
    }

    const alignment: PathAlignment = {
      sourcePathId,
      targetPathId,
      offset: offset / 100,
      perpOffset,
      rotation,
      preserveShape,
      repeatCount,
      scale: scale / 100,
      pathRangeStart: pathRangeStart / 100,
      pathRangeEnd: pathRangeEnd / 100,
      randomRotation,
      randomScale,
      randomOffset,
      randomSeed,
    };

    onApply(alignment);
    setLocalPreview(null);
    setPathAlignmentSelectionMode('none');
    onClose();
  };

  const targetPath = availablePaths.find(p => p.id === targetPathId);

  // Generate SVG for original preview (clickable paths)
  const originalSVG = useMemo(() => {
    if (!isOpen || !svgDocument || availablePaths.length === 0) return null;

    const viewBox = svgDocument.viewBox 
      ? `${svgDocument.viewBox.x} ${svgDocument.viewBox.y} ${svgDocument.viewBox.width} ${svgDocument.viewBox.height}`
      : '0 0 800 400';
    
    const pathElements = availablePaths.map(path => {
      const isSource = path.id === sourcePathId;
      const isTarget = path.id === targetPathId;
      const fill = path.fill || 'none';
      const stroke = path.stroke || (fill === 'none' ? '#666' : 'none');
      const strokeWidth = path.strokeWidth || 1;
      const opacity = isSource || isTarget ? 1 : 0.3;
      const highlightStroke = isSource ? '#10b981' : isTarget ? '#3b82f6' : stroke;
      const highlightWidth = (isSource || isTarget) ? strokeWidth + 2 : strokeWidth;
      
      return `<path 
        data-path-id="${path.id}" 
        d="${path.d}" 
        fill="${fill}" 
        stroke="${highlightStroke}" 
        stroke-width="${highlightWidth}" 
        opacity="${opacity}"
        style="cursor: pointer;"
      />`;
    }).join('\n');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${pathElements}</svg>`;
  }, [availablePaths, sourcePathId, targetPathId, svgDocument]);

  // Generate SVG for preview (aligned paths)
  const previewSVG = useMemo(() => {
    if (!isOpen || !svgDocument || !localPreview || localPreview.length === 0) return null;

    const viewBox = svgDocument.viewBox 
      ? `${svgDocument.viewBox.x} ${svgDocument.viewBox.y} ${svgDocument.viewBox.width} ${svgDocument.viewBox.height}`
      : '0 0 800 400';
    
    // Show target path in blue (faint)
    let pathElements = '';
    if (targetPath) {
      pathElements += `<path 
        d="${targetPath.d}" 
        fill="none" 
        stroke="#3b82f6" 
        stroke-width="2" 
        opacity="0.3"
      />`;
    }
    
    // Show aligned paths in cyan
    pathElements += localPreview.map(path => {
      return `<path 
        d="${path.d}" 
        fill="none" 
        stroke="#06b6d4" 
        stroke-width="2" 
        opacity="0.8"
      />`;
    }).join('\n');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${pathElements}</svg>`;
  }, [svgDocument, localPreview, targetPath]);

  // Handle click on original preview to select source/target
  const handleOriginalClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as SVGPathElement;
    if (target.tagName === 'path') {
      const pathId = target.getAttribute('data-path-id');
      if (pathId) {
        // Toggle selection: if already selected, deselect; otherwise select as appropriate
        if (pathId === sourcePathId) {
          setSourcePathId('');
        } else if (pathId === targetPathId) {
          setTargetPathId('');
        } else if (!sourcePathId) {
          setSourcePathId(pathId);
        } else if (!targetPathId) {
          setTargetPathId(pathId);
        } else {
          // Both selected, replace source
          setSourcePathId(pathId);
        }
      }
    }
  }, [sourcePathId, targetPathId]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-bg-secondary rounded-lg shadow-xl w-[900px] max-h-[90vh] flex flex-col"
        data-source-path-id={sourcePathId}
        data-target-path-id={targetPathId}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlignVerticalDistributeCenter className="text-accent-primary" size={24} strokeWidth={1.5} />
              <h2 className="text-xl font-semibold">Path Alignment</h2>
            </div>
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-white transition-colors text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Preview Section - AT THE TOP */}
            <div className="mb-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Original - Clickable to select paths */}
                <div>
                  <h3 className="text-sm font-medium mb-2 text-gray-400">
                    Original 
                    <span className="text-xs ml-2 text-gray-500">
                      (Click to select 
                      <span className="text-green-400"> source</span> and 
                      <span className="text-blue-400"> target</span>)
                    </span>
                  </h3>
                  <div 
                    ref={originalPreviewRef}
                    className="bg-bg-primary rounded border border-border overflow-hidden cursor-move select-none relative"
                    style={{ height: '300px' }}
                    onClick={handleOriginalClick}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    <div
                      className="absolute inset-0 flex items-center justify-center [&>svg]:max-w-[90%] [&>svg]:max-h-[90%]"
                      style={{
                        transform: `scale(${previewZoom}) translate(${previewPan.x / previewZoom}px, ${previewPan.y / previewZoom}px)`,
                        transformOrigin: 'center',
                        transition: isPanning ? 'none' : 'transform 0.1s'
                      }}
                      dangerouslySetInnerHTML={originalSVG ? { __html: originalSVG } : undefined}
                    />
                  </div>
                  <div className="mt-2 text-xs text-text-secondary">
                    {sourcePathId && (
                      <div className="text-green-400">✓ Source: {sourcePathId}</div>
                    )}
                    {targetPathId && (
                      <div className="text-blue-400">✓ Target: {targetPathId}</div>
                    )}
                    {!sourcePathId && !targetPathId && (
                      <div className="text-gray-500">Click paths to select</div>
                    )}
                  </div>
                </div>

                {/* Preview - Shows result */}
                <div>
                  <h3 className="text-sm font-medium mb-2 text-gray-400">Preview</h3>
                  <div 
                    ref={alignedPreviewRef}
                    className="bg-bg-primary rounded border border-border overflow-hidden cursor-move select-none relative"
                    style={{ height: '300px' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    <div
                      className="absolute inset-0 flex items-center justify-center [&>svg]:max-w-[90%] [&>svg]:max-h-[90%]"
                      style={{
                        transform: `scale(${previewZoom}) translate(${previewPan.x / previewZoom}px, ${previewPan.y / previewZoom}px)`,
                        transformOrigin: 'center',
                        transition: isPanning ? 'none' : 'transform 0.1s'
                      }}
                      dangerouslySetInnerHTML={previewSVG ? { __html: previewSVG } : undefined}
                    />
                  </div>
                  <div className="mt-2 text-xs text-text-secondary text-center">
                    {localPreview ? (
                      <span className="text-cyan-400">
                        ✓ {localPreview.length} aligned {localPreview.length === 1 ? 'shape' : 'shapes'}
                      </span>
                    ) : (
                      <span className="text-gray-500">Select both paths to see preview</span>
                    )}
                  </div>
                </div>
              </div>

              {/* View Controls */}
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-gray-500">💡 Scroll to zoom, drag to pan</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">Zoom: {(previewZoom * 100).toFixed(0)}%</span>
                  <button
                    onClick={resetView}
                    className="text-xs px-2 py-1 bg-bg-tertiary hover:bg-opacity-80 rounded text-text-secondary"
                  >
                    Reset View
                  </button>
                </div>
              </div>
            </div>

            {/* Rest of the controls below preview */}
            <div className="space-y-4 mb-6">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-text-secondary">Basic</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Repeat Count: {repeatCount}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Scale: {scale}%
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

          {/* Positioning */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-text-secondary">Positioning</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Target Path Range: {pathRangeStart}% - {pathRangeEnd}%
                </label>
                <div className="flex gap-3 items-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={pathRangeStart}
                    onChange={(e) => setPathRangeStart(Math.min(Number(e.target.value), pathRangeEnd))}
                    className="flex-1"
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={pathRangeEnd}
                    onChange={(e) => setPathRangeEnd(Math.max(Number(e.target.value), pathRangeStart))}
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Start Offset: {offset}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={offset}
                  onChange={(e) => setOffset(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Perpendicular Offset: {perpOffset}px
                </label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={perpOffset}
                  onChange={(e) => setPerpOffset(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Rotation */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-text-secondary">Rotation</h3>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Base Rotation: {rotation}°
              </label>
              <input
                type="range"
                min="-180"
                max="180"
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Variation (Collapsible) */}
          <div className="space-y-4">
            <button
              onClick={() => setShowVariation(!showVariation)}
              className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wide text-text-secondary hover:text-white transition-colors"
            >
              <span className={`transform transition-transform ${showVariation ? 'rotate-90' : ''}`}>▶</span>
              Variation (Optional)
            </button>
            
            {showVariation && (
              <div className="space-y-3 pl-6">
                <div className="flex items-start gap-2 text-xs text-text-secondary bg-bg-tertiary p-3 rounded">
                  <Info size={14} className="flex-shrink-0 mt-0.5" />
                  <span>Add randomness for organic, natural-looking patterns</span>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Random Rotation: ±{randomRotation}°
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="45"
                    value={randomRotation}
                    onChange={(e) => setRandomRotation(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Random Scale: ±{randomScale}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={randomScale}
                    onChange={(e) => setRandomScale(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Random Offset: ±{randomOffset}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={randomOffset}
                    onChange={(e) => setRandomOffset(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Random Seed
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={randomSeed}
                      onChange={(e) => setRandomSeed(Number(e.target.value))}
                      className="flex-1 px-3 py-2 bg-bg-tertiary border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
                    />
                    <button
                      onClick={() => setRandomSeed(Date.now())}
                      className="px-3 py-2 bg-bg-tertiary hover:bg-border border border-border rounded text-sm transition-colors"
                    >
                      Randomize
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mode */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-text-secondary">Mode</h3>
            
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={preserveShape}
                  onChange={() => setPreserveShape(true)}
                  className="text-accent-primary"
                />
                <span className="text-sm">Preserve Shape</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!preserveShape}
                  onChange={() => setPreserveShape(false)}
                  className="text-accent-primary"
                />
                <span className="text-sm">Deform to Path</span>
              </label>
            </div>
            
            <div className="text-xs text-text-secondary bg-bg-tertiary p-3 rounded">
              <strong>Preserve Shape:</strong> Keeps original shape, only translates and rotates.<br />
              <strong>Deform to Path:</strong> Warps the shape to follow the curve.
            </div>
          </div>
        </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-bg-tertiary hover:bg-bg-primary rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!sourcePathId || !targetPathId}
            className="flex-1 px-6 py-3 bg-accent-primary hover:bg-indigo-600 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <AlignVerticalDistributeCenter size={20} strokeWidth={1.5} />
            Apply Alignment
          </button>
        </div>
      </div>
    </div>
  );
};
