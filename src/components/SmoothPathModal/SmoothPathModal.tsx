import { useContext, useEffect, useMemo, useState, useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { smoothPath } from '../../engine/pathSmoothing';
import { shouldIgnoreKeyboardShortcut } from '../../utils/keyboard';
import type { Path } from '../../types/svg';
import { ProFeaturesContext } from '../../main';

type SmoothMode = 'polish' | 'organic';

interface SmoothPathModalProps {
  onClose: () => void;
  onApply: (
    mode: SmoothMode,
    smoothness: number,
    convertLinesToCurves: boolean,
    selectedPointsOnly: boolean,
    preserveSmooth: boolean,
    cornerAngle: number
  ) => void;
}

export function SmoothPathModal({ onClose, onApply }: SmoothPathModalProps) {
  // Get PRO features from context
  const proFeatures = useContext(ProFeaturesContext);
  if (!proFeatures) throw new Error('ProFeaturesContext not found');
  const { organicSmoothPath } = proFeatures.engine;
  
  const svgDocument = useEditorStore(state => state.svgDocument);
  const selectedPathIds = useEditorStore(state => state.selectedPathIds);
  const editingPathId = useEditorStore(state => state.editingPathId);
  const selectedPointIndices = useEditorStore(state => state.selectedPointIndices);

  const [mode, setMode] = useState<SmoothMode>('polish');
  const [smoothness, setSmoothness] = useState(0.5);
  const [convertLinesToCurves, setConvertLinesToCurves] = useState(false);
  const [selectedPointsOnly, setSelectedPointsOnly] = useState(
    !!(editingPathId && selectedPointIndices.length > 0) // Default to true if points are selected
  );
  const [preserveSmooth, setPreserveSmooth] = useState(false); // Changed to false for immediate visible effect
  const [cornerAngle, setCornerAngle] = useState(30);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showControlPoints, setShowControlPoints] = useState(true);
  
  // Jitter reduction is a PRO feature - always null in free tier
  const jitterReduction = null;
  
  const originalPreviewRef = useRef<HTMLDivElement>(null);
  const smoothPreviewRef = useRef<HTMLDivElement>(null);
  
  // Store the original document state when modal opens (never changes)
  const [originalDocument] = useState(() => 
    svgDocument ? JSON.parse(JSON.stringify(svgDocument)) : null
  );

  // Determine if we're in point-editing mode
  const hasSelectedPoints = editingPathId && selectedPointIndices.length > 0;

  console.log('Modal state:', {
    editingPathId,
    selectedPointIndices,
    hasSelectedPoints,
    selectedPathIds,
    originalDocument: !!originalDocument
  });

  // Generate preview SVG with control points visualization
  const previewSVG = useMemo(() => {
    if (!originalDocument || selectedPathIds.length === 0) return null;

    // Create a copy of the original document for preview
    const previewDoc = JSON.parse(JSON.stringify(originalDocument));
    
    // Only apply smoothing if smoothness > 0 or convertLinesToCurves is enabled
    if (smoothness > 0 || convertLinesToCurves) {
      let _totalJitter = 0;
      let _pathsProcessed = 0;
      
      // Apply smoothing to selected paths
      selectedPathIds.forEach(pathId => {
        const pathIndex = previewDoc.paths.findIndex((p: Path) => p.id === pathId);
        if (pathIndex !== -1) {
          const path = previewDoc.paths[pathIndex];
          
          if (mode === 'organic') {
            const result = organicSmoothPath(path, smoothness, true, cornerAngle);
            previewDoc.paths[pathIndex] = result;
            // Note: jitterReduction is a PRO feature metric
            // if (result.jitterReduction !== undefined) {
            //   _totalJitter += result.jitterReduction;
            //   _pathsProcessed++;
            // }
          } else {
            const smoothed = smoothPath(
              path,
              smoothness,
              convertLinesToCurves,
              selectedPointsOnly && editingPathId === pathId ? selectedPointIndices : undefined,
              preserveSmooth
            );
            previewDoc.paths[pathIndex] = smoothed;
          }
        }
      });
    }

    // Generate SVG string with control points
    const pathElements: string[] = [];
    const controlPointElements: string[] = [];
    
    // Calculate container scale: SVG is scaled to fit ~270px container height
    const viewBoxHeight = previewDoc.viewBox?.height || 24;
    const containerSize = 270; // Approximate container height (90% of 300px)
    const containerScale = containerSize / viewBoxHeight;
    
    previewDoc.paths.forEach((path: Path) => {
      const isSelected = selectedPathIds.includes(path.id);
      const d = path.d;

      const fill = path.fill || 'none';
      const stroke = path.stroke || 'none';
      const strokeWidth = path.strokeWidth || 1;
      const opacity = isSelected ? '1' : '0.3';
      const transformAttr = path.transform?.raw ? ` transform="${path.transform.raw}"` : '';

      pathElements.push(`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"${transformAttr}/>`);
      
      // Add control points for selected paths
      if (isSelected && path.id === editingPathId) {
        let pointIndex = 0;
        const pointsForPath: string[] = [];
        
        path.segments.forEach((seg, _segIdx) => {
          if (seg.type === 'M' || seg.type === 'L') {
            // Anchor point (matches Canvas styling exactly)
            const isSelectedPoint = selectedPointIndices.includes(pointIndex);
            const color = isSelectedPoint ? '#f59e0b' : '#6366f1'; // amber-500 selected : indigo-500
            const size = (isSelectedPoint ? 8 : 6) / (previewZoom * containerScale);
            const strokeColor = isSelectedPoint ? '#fbbf24' : '#ffffff'; // amber-400 : white
            const strokeWidth = (isSelectedPoint ? 3 : 2) / (previewZoom * containerScale);
            pointsForPath.push(
              `<circle cx="${seg.end.x}" cy="${seg.end.y}" r="${size}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`
            );
            pointIndex += 1;
          } else if (seg.type === 'C') {
            const cp1 = seg.points[0];
            const cp2 = seg.points[1];
            const end = seg.end;
            
            // Check if any point in this segment is selected
            const cp1Selected = selectedPointIndices.includes(pointIndex);
            const cp2Selected = selectedPointIndices.includes(pointIndex + 1);
            const endSelected = selectedPointIndices.includes(pointIndex + 2);
            
            // Bezier handles (lines from anchor to control points)
            const lineWidth = 1 / (previewZoom * containerScale);
            pointsForPath.push(
              `<line x1="${seg.start.x}" y1="${seg.start.y}" x2="${cp1.x}" y2="${cp1.y}" stroke="#6b7280" stroke-width="${lineWidth}" stroke-dasharray="2,2" opacity="0.5"/>`
            );
            pointsForPath.push(
              `<line x1="${end.x}" y1="${end.y}" x2="${cp2.x}" y2="${cp2.y}" stroke="#6b7280" stroke-width="${lineWidth}" stroke-dasharray="2,2" opacity="0.5"/>`
            );
            
            // Control points (matches Canvas styling exactly)
            const cp1Color = cp1Selected ? '#f59e0b' : '#10b981'; // amber-500 selected : green-500
            const cp2Color = cp2Selected ? '#f59e0b' : '#10b981';
            const cp1Size = (cp1Selected ? 6 : 4) / (previewZoom * containerScale);
            const cp2Size = (cp2Selected ? 6 : 4) / (previewZoom * containerScale);
            const cp1Stroke = cp1Selected ? '#fbbf24' : '#ffffff';
            const cp2Stroke = cp2Selected ? '#fbbf24' : '#ffffff';
            const cpStrokeWidth = (cp1Selected || cp2Selected ? 3 : 2) / (previewZoom * containerScale);
            
            pointsForPath.push(
              `<circle cx="${cp1.x}" cy="${cp1.y}" r="${cp1Size}" fill="${cp1Color}" stroke="${cp1Stroke}" stroke-width="${cpStrokeWidth}"/>`
            );
            pointsForPath.push(
              `<circle cx="${cp2.x}" cy="${cp2.y}" r="${cp2Size}" fill="${cp2Color}" stroke="${cp2Stroke}" stroke-width="${cpStrokeWidth}"/>`
            );
            
            // Anchor point (end, matches Canvas styling exactly)
            const endColor = endSelected ? '#f59e0b' : '#6366f1';
            const endSize = (endSelected ? 8 : 6) / (previewZoom * containerScale);
            const endStroke = endSelected ? '#fbbf24' : '#ffffff';
            const endStrokeWidth = (endSelected ? 3 : 2) / (previewZoom * containerScale);
            pointsForPath.push(
              `<circle cx="${end.x}" cy="${end.y}" r="${endSize}" fill="${endColor}" stroke="${endStroke}" stroke-width="${endStrokeWidth}"/>`
            );
            
            pointIndex += 3;
          } else if (seg.type === 'Q') {
            const cp = seg.points[0];
            const end = seg.end;
            
            const cpSelected = selectedPointIndices.includes(pointIndex);
            const endSelected = selectedPointIndices.includes(pointIndex + 1);
            
            // Bezier handle
            const qLineWidth = 1 / (previewZoom * containerScale);
            pointsForPath.push(
              `<line x1="${seg.start.x}" y1="${seg.start.y}" x2="${cp.x}" y2="${cp.y}" stroke="#6b7280" stroke-width="${qLineWidth}" stroke-dasharray="2,2" opacity="0.5"/>`
            );
            
            // Control point (matches Canvas styling exactly)
            const cpColor = cpSelected ? '#f59e0b' : '#10b981';
            const cpSize = (cpSelected ? 6 : 4) / (previewZoom * containerScale);
            const cpStroke = cpSelected ? '#fbbf24' : '#ffffff';
            const cpStrokeWidth = (cpSelected ? 3 : 2) / (previewZoom * containerScale);
            pointsForPath.push(
              `<circle cx="${cp.x}" cy="${cp.y}" r="${cpSize}" fill="${cpColor}" stroke="${cpStroke}" stroke-width="${cpStrokeWidth}"/>`
            );
            
            // Anchor point (matches Canvas styling exactly)
            const endColor = endSelected ? '#f59e0b' : '#6366f1';
            const endSize = (endSelected ? 8 : 6) / (previewZoom * containerScale);
            const endStroke = endSelected ? '#fbbf24' : '#ffffff';
            const endStrokeWidth = (endSelected ? 3 : 2) / (previewZoom * containerScale);
            pointsForPath.push(
              `<circle cx="${end.x}" cy="${end.y}" r="${endSize}" fill="${endColor}" stroke="${endStroke}" stroke-width="${endStrokeWidth}"/>`
            );
            
            pointIndex += 2;
          }
        });
        
        // Wrap all control points for this path in a transform group (if path has transform)
        if (pointsForPath.length > 0) {
          const transformAttrForPoints = path.transform?.raw ? ` transform="${path.transform.raw}"` : '';
          controlPointElements.push(`<g${transformAttrForPoints}>${pointsForPath.join('\n')}</g>`);
        }
      }
    });

    const viewBox = previewDoc.viewBox 
      ? `${previewDoc.viewBox.x} ${previewDoc.viewBox.y} ${previewDoc.viewBox.width} ${previewDoc.viewBox.height}`
      : '0 0 24 24';
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
${pathElements.join('\n')}
${showControlPoints ? controlPointElements.join('\n') : ''}
</svg>`;
    console.log('Preview SVG length:', svg.length, 'First 200 chars:', svg.substring(0, 200));
    return svg;
  }, [originalDocument, selectedPathIds, editingPathId, selectedPointIndices, mode, smoothness, convertLinesToCurves, selectedPointsOnly, preserveSmooth, cornerAngle, showControlPoints]);

  // Generate original SVG with control points visualization
  const originalSVG = useMemo(() => {
    if (!originalDocument || selectedPathIds.length === 0) return null;

    const pathElements: string[] = [];
    const controlPointElements: string[] = [];
    
    // Calculate container scale: SVG is scaled to fit ~270px container height
    const viewBoxHeight = originalDocument.viewBox?.height || 24;
    const containerSize = 270; // Approximate container height (90% of 300px)
    const containerScale = containerSize / viewBoxHeight;
    
    originalDocument.paths.forEach((path: Path) => {
      const isSelected = selectedPathIds.includes(path.id);
      const d = path.d;

      const fill = path.fill || 'none';
      const stroke = path.stroke || 'none';
      const strokeWidth = path.strokeWidth || 1;
      const opacity = isSelected ? '1' : '0.3';
      const transformAttr = path.transform?.raw ? ` transform="${path.transform.raw}"` : '';

      pathElements.push(`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"${transformAttr}/>`);
      
      // Add control points for selected paths
      if (isSelected && path.id === editingPathId) {
        let pointIndex = 0;
        const pointsForPath: string[] = [];
        
        path.segments.forEach((seg, _segIdx) => {
          if (seg.type === 'M' || seg.type === 'L') {
            // Anchor point (matches Canvas styling exactly)
            const isSelectedPoint = selectedPointIndices.includes(pointIndex);
            const color = isSelectedPoint ? '#f59e0b' : '#6366f1'; // amber-500 selected : indigo-500
            const size = (isSelectedPoint ? 8 : 6) / (previewZoom * containerScale);
            const strokeColor = isSelectedPoint ? '#fbbf24' : '#ffffff'; // amber-400 : white
            const strokeWidth = (isSelectedPoint ? 3 : 2) / (previewZoom * containerScale);
            pointsForPath.push(
              `<circle cx="${seg.end.x}" cy="${seg.end.y}" r="${size}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`
            );
            pointIndex += 1;
          } else if (seg.type === 'C') {
            const cp1 = seg.points[0];
            const cp2 = seg.points[1];
            const end = seg.end;
            
            // Check if any point in this segment is selected
            const cp1Selected = selectedPointIndices.includes(pointIndex);
            const cp2Selected = selectedPointIndices.includes(pointIndex + 1);
            const endSelected = selectedPointIndices.includes(pointIndex + 2);
            
            // Bezier handles (lines from anchor to control points)
            const lineWidth = 1 / (previewZoom * containerScale);
            pointsForPath.push(
              `<line x1="${seg.start.x}" y1="${seg.start.y}" x2="${cp1.x}" y2="${cp1.y}" stroke="#6b7280" stroke-width="${lineWidth}" stroke-dasharray="2,2" opacity="0.5"/>`
            );
            pointsForPath.push(
              `<line x1="${end.x}" y1="${end.y}" x2="${cp2.x}" y2="${cp2.y}" stroke="#6b7280" stroke-width="${lineWidth}" stroke-dasharray="2,2" opacity="0.5"/>`
            );
            
            // Control points (matches Canvas styling exactly)
            const cp1Color = cp1Selected ? '#f59e0b' : '#10b981'; // amber-500 selected : green-500
            const cp2Color = cp2Selected ? '#f59e0b' : '#10b981';
            const cp1Size = (cp1Selected ? 6 : 4) / (previewZoom * containerScale);
            const cp2Size = (cp2Selected ? 6 : 4) / (previewZoom * containerScale);
            const cp1Stroke = cp1Selected ? '#fbbf24' : '#ffffff';
            const cp2Stroke = cp2Selected ? '#fbbf24' : '#ffffff';
            const cpStrokeWidth = (cp1Selected || cp2Selected ? 3 : 2) / (previewZoom * containerScale);
            
            pointsForPath.push(
              `<circle cx="${cp1.x}" cy="${cp1.y}" r="${cp1Size}" fill="${cp1Color}" stroke="${cp1Stroke}" stroke-width="${cpStrokeWidth}"/>`
            );
            pointsForPath.push(
              `<circle cx="${cp2.x}" cy="${cp2.y}" r="${cp2Size}" fill="${cp2Color}" stroke="${cp2Stroke}" stroke-width="${cpStrokeWidth}"/>`
            );
            
            // Anchor point (end, matches Canvas styling exactly)
            const endColor = endSelected ? '#f59e0b' : '#6366f1';
            const endSize = (endSelected ? 8 : 6) / (previewZoom * containerScale);
            const endStroke = endSelected ? '#fbbf24' : '#ffffff';
            const endStrokeWidth = (endSelected ? 3 : 2) / (previewZoom * containerScale);
            pointsForPath.push(
              `<circle cx="${end.x}" cy="${end.y}" r="${endSize}" fill="${endColor}" stroke="${endStroke}" stroke-width="${endStrokeWidth}"/>`
            );
            
            pointIndex += 3;
          } else if (seg.type === 'Q') {
            const cp = seg.points[0];
            const end = seg.end;
            
            const cpSelected = selectedPointIndices.includes(pointIndex);
            const endSelected = selectedPointIndices.includes(pointIndex + 1);
            
            // Bezier handle
            const qLineWidth = 1 / (previewZoom * containerScale);
            pointsForPath.push(
              `<line x1="${seg.start.x}" y1="${seg.start.y}" x2="${cp.x}" y2="${cp.y}" stroke="#6b7280" stroke-width="${qLineWidth}" stroke-dasharray="2,2" opacity="0.5"/>`
            );
            
            // Control point (matches Canvas styling exactly)
            const cpColor = cpSelected ? '#f59e0b' : '#10b981';
            const cpSize = (cpSelected ? 6 : 4) / (previewZoom * containerScale);
            const cpStroke = cpSelected ? '#fbbf24' : '#ffffff';
            const cpStrokeWidth = (cpSelected ? 3 : 2) / (previewZoom * containerScale);
            pointsForPath.push(
              `<circle cx="${cp.x}" cy="${cp.y}" r="${cpSize}" fill="${cpColor}" stroke="${cpStroke}" stroke-width="${cpStrokeWidth}"/>`
            );
            
            // Anchor point (matches Canvas styling exactly)
            const endColor = endSelected ? '#f59e0b' : '#6366f1';
            const endSize = (endSelected ? 8 : 6) / (previewZoom * containerScale);
            const endStroke = endSelected ? '#fbbf24' : '#ffffff';
            const endStrokeWidth = (endSelected ? 3 : 2) / (previewZoom * containerScale);
            pointsForPath.push(
              `<circle cx="${end.x}" cy="${end.y}" r="${endSize}" fill="${endColor}" stroke="${endStroke}" stroke-width="${endStrokeWidth}"/>`
            );
            
            pointIndex += 2;
          }
        });
        
        // Wrap all control points for this path in a transform group (if path has transform)
        if (pointsForPath.length > 0) {
          const transformAttrForPoints = path.transform?.raw ? ` transform="${path.transform.raw}"` : '';
          controlPointElements.push(`<g${transformAttrForPoints}>${pointsForPath.join('\n')}</g>`);
        }
      }
    });

    const viewBox = originalDocument.viewBox 
      ? `${originalDocument.viewBox.x} ${originalDocument.viewBox.y} ${originalDocument.viewBox.width} ${originalDocument.viewBox.height}`
      : '0 0 24 24';
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
${pathElements.join('\n')}
${showControlPoints ? controlPointElements.join('\n') : ''}
</svg>`;
    console.log('Original SVG length:', svg.length, 'First 200 chars:', svg.substring(0, 200));
    return svg;
  }, [originalDocument, selectedPathIds, editingPathId, selectedPointIndices, showControlPoints]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !shouldIgnoreKeyboardShortcut(e, true)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Setup wheel event listeners with passive: false
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Slower, more precise zoom - Steve Jobs would approve
      const delta = e.deltaY > 0 ? 0.95 : 1.05; // 5% change instead of 10%
      setPreviewZoom(prev => Math.max(0.1, Math.min(5, prev * delta)));
    };

    const original = originalPreviewRef.current;
    const smooth = smoothPreviewRef.current;

    if (original) {
      original.addEventListener('wheel', handleWheel, { passive: false });
    }
    if (smooth) {
      smooth.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (original) {
        original.removeEventListener('wheel', handleWheel);
      }
      if (smooth) {
        smooth.removeEventListener('wheel', handleWheel);
      }
    };
  }, []);

  const handleApply = () => {
    onApply(mode, smoothness, convertLinesToCurves, selectedPointsOnly, preserveSmooth, cornerAngle);
    onClose();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsPanning(true);
      setPanStart({ x: e.clientX - previewPan.x, y: e.clientY - previewPan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPreviewPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const resetView = () => {
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-bg-secondary rounded-lg shadow-xl w-[800px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">Smooth Path</h2>
            {jitterReduction !== null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Jitter Reduction:</span>
                <span className={`text-sm font-semibold px-2 py-1 rounded ${
                  jitterReduction >= 70 ? 'bg-green-500/20 text-green-400' :
                  jitterReduction >= 40 ? 'bg-blue-500/20 text-blue-400' :
                  jitterReduction >= 20 ? 'bg-amber-500/20 text-amber-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {jitterReduction.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            {/* Preview Section */}
        <div className="mb-4">

          <div className="grid grid-cols-2 gap-4">
            {/* Original */}
            <div>
              <h3 className="text-sm font-medium mb-2 text-gray-400">Original</h3>
              <div 
                ref={originalPreviewRef}
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
                  dangerouslySetInnerHTML={originalSVG ? { __html: originalSVG } : undefined}
                />
              </div>
            </div>

            {/* Preview */}
            <div>
              <h3 className="text-sm font-medium mb-2 text-gray-400">Preview</h3>
              <div 
                ref={smoothPreviewRef}
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
            </div>
          </div>
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-gray-500">💡 Scroll to zoom, drag to pan</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={showControlPoints}
                  onChange={(e) => setShowControlPoints(e.target.checked)}
                  className="rounded"
                />
                <span>Show control points</span>
              </label>
              <span className="text-xs text-gray-500">Zoom: {(previewZoom * 100).toFixed(0)}%</span>
              <button
                onClick={resetView}
                className="text-xs px-2 py-1 bg-bg-tertiary hover:bg-opacity-80 rounded"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4 mb-6">
          {/* Mode Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Smoothing Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('polish')}
                className={`px-4 py-2 rounded border transition-all ${
                  mode === 'polish'
                    ? 'bg-accent-primary border-accent-primary text-white'
                    : 'bg-bg-primary border-border text-gray-400 hover:border-gray-500'
                }`}
              >
                <div className="font-medium">✨ Polish</div>
                <div className="text-xs opacity-80">Adjust control points</div>
              </button>
              <button
                onClick={() => setMode('organic')}
                className={`px-4 py-2 rounded border transition-all relative ${
                  mode === 'organic'
                    ? 'bg-accent-primary border-accent-primary text-white'
                    : 'bg-bg-primary border-border text-gray-400 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="font-medium">🌊 Organic</span>
                </div>
                <div className="text-xs opacity-80">Laplacian smoothing</div>
              </button>
            </div>
          </div>

          {/* Scope Selection - only show if points are available AND in polish mode */}
          {hasSelectedPoints && mode === 'polish' && (
            <div>
              <label className="block text-sm font-medium mb-2">Smoothing Scope</label>
              <select
                value={selectedPointsOnly ? 'points' : 'path'}
                onChange={(e) => setSelectedPointsOnly(e.target.value === 'points')}
                className="w-full px-3 py-2 bg-bg-primary text-white rounded border border-border"
              >
                <option value="path">📐 Smooth entire path</option>
                <option value="points">🎯 Smooth selected points only ({selectedPointIndices.length} points)</option>
              </select>
            </div>
          )}

          {/* Smoothness Slider */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {mode === 'organic' ? 'Smoothing Factor' : 'Smoothness'}: {smoothness.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={smoothness}
              onChange={(e) => setSmoothness(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-0.5">
              <span>No change</span>
              <span>Maximum</span>
            </div>
          </div>

          {/* Corner Angle - only for Organic mode */}
          {mode === 'organic' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Corner Detection Angle: {cornerAngle}°
              </label>
              <input
                type="range"
                min="10"
                max="90"
                step="5"
                value={cornerAngle}
                onChange={(e) => setCornerAngle(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                <span>Preserve more (10°)</span>
                <span>Smooth more (90°)</span>
              </div>
            </div>
          )}

          {/* Options - only for Polish mode */}
          {mode === 'polish' && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={convertLinesToCurves}
                  onChange={(e) => setConvertLinesToCurves(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Convert straight lines to curves</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preserveSmooth}
                  onChange={(e) => setPreserveSmooth(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Preserve already-smooth curves</span>
              </label>
            </div>
          )}
        </div>
          </div>
        </div>

        {/* Action Buttons */}
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
            Apply Smoothing
          </button>
        </div>
      </div>
    </div>
  );
}
