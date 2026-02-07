import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { mergePaths, groupPathsByColor, groupPathsByProximity, simplifyPath } from '../../engine/pathMerging';
import { Eye, Circle } from 'lucide-react';
import type { Path } from '../../types/svg';

interface MergePathsModalProps {
  onClose: () => void;
}

type MergeMode = 'selected' | 'byColor' | 'flatten';

export function MergePathsModal({ onClose }: MergePathsModalProps) {
  const { svgDocument, selectedPathIds, setSVGDocument } = useEditorStore();
  
  // Modal state
  const [mergeMode, setMergeMode] = useState<MergeMode>(
    selectedPathIds.length >= 2 ? 'selected' : 'byColor'
  );
  const [colorThreshold, setColorThreshold] = useState(0.95);
  const [proximityThreshold, setProximityThreshold] = useState(10);
  const [customFillColor, setCustomFillColor] = useState<string>('');
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [groupCustomColors, setGroupCustomColors] = useState<Map<number, string>>(new Map());
  const [groupCustomStrokes, setGroupCustomStrokes] = useState<Map<number, { color: string; width: number; enabled: boolean }>>(new Map());
  const [groupOpacities, setGroupOpacities] = useState<Map<number, number>>(new Map());
  const [keepOriginals, setKeepOriginals] = useState(false);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number | null>(null);
  const [strokeMode, setStrokeMode] = useState<'fromFirst' | 'custom' | 'remove'>('fromFirst');
  const [customStrokeColor, setCustomStrokeColor] = useState<string>('#000000');
  const [customStrokeWidth, setCustomStrokeWidth] = useState<number>(1);
  const [opacity, setOpacity] = useState<number>(1);
  const [closeOpenPaths, setCloseOpenPaths] = useState<boolean>(false);
  const [layerPosition, setLayerPosition] = useState<'top' | 'bottom' | 'afterSelection'>('afterSelection');
  const [simplifyResult, setSimplifyResult] = useState<boolean>(false);
  const [simplifyTolerance, setSimplifyTolerance] = useState<number>(0.1); // Percentage (0-2%)
  
  // Preview zoom/pan state (shared between both previews)
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  const originalPreviewRef = useRef<HTMLDivElement>(null);
  const mergedPreviewRef = useRef<HTMLDivElement>(null);

  // Generate distinct colors for group visualization
  const groupColors = useMemo(() => {
    const colors = [
      '#ef4444', // red
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#f97316', // orange
      '#84cc16', // lime
      '#6366f1', // indigo
    ];
    return colors;
  }, []);

  // Get paths that will be merged
  const pathsToMerge = useMemo(() => {
    if (!svgDocument) return [];
    
    if (mergeMode === 'selected') {
      return svgDocument.paths.filter(p => selectedPathIds.includes(p.id));
    } else if (mergeMode === 'byColor') {
      // Group by color and return all groups with 2+ paths
      const groups = groupPathsByColor(svgDocument.paths, colorThreshold);
      return groups.flat();
    } else {
      // Flatten mode - group by proximity
      const groups = groupPathsByProximity(svgDocument.paths, proximityThreshold);
      return groups.flat();
    }
  }, [svgDocument, mergeMode, selectedPathIds, colorThreshold, proximityThreshold]);

  // Get color groups for byColor mode
  const colorGroups = useMemo(() => {
    if (!svgDocument || mergeMode !== 'byColor') return [];
    return groupPathsByColor(svgDocument.paths, colorThreshold);
  }, [svgDocument, mergeMode, colorThreshold]);
  
  // Get proximity groups for flatten mode
  const proximityGroups = useMemo(() => {
    if (!svgDocument || mergeMode !== 'flatten') return [];
    return groupPathsByProximity(svgDocument.paths, proximityThreshold);
  }, [svgDocument, mergeMode, proximityThreshold]);

  // Generate preview document
  const previewDocument = useMemo(() => {
    if (!svgDocument) return null;
    
    // Check if we have valid groups to merge
    const hasValidMerge = 
      (mergeMode === 'selected' && pathsToMerge.length >= 2) ||
      (mergeMode === 'byColor' && colorGroups.length > 0) ||
      (mergeMode === 'flatten' && proximityGroups.length > 0);
    
    if (!hasValidMerge) return null;
    
    try {
      if (mergeMode === 'selected') {
        // Merge selected paths into one
        const fillColor = useCustomColor ? customFillColor : pathsToMerge[0].fill;
        let merged = mergePaths(pathsToMerge, fillColor, closeOpenPaths, 0);
        
        // Apply simplification if enabled
        if (simplifyResult) {
          merged = simplifyPath(merged, simplifyTolerance);
        }
        
        // Apply stroke configuration
        if (strokeMode === 'remove') {
          merged = { ...merged, stroke: 'none', strokeWidth: undefined };
        } else if (strokeMode === 'custom') {
          merged = { ...merged, stroke: customStrokeColor, strokeWidth: customStrokeWidth };
        } else {
          // fromFirst - keep stroke from first path
          merged = { ...merged, stroke: pathsToMerge[0].stroke, strokeWidth: pathsToMerge[0].strokeWidth };
        }
        
        // Apply opacity
        if (opacity < 1) {
          merged = { ...merged, opacity };
        }
        
        const remainingPaths = svgDocument.paths.filter(p => !selectedPathIds.includes(p.id));
        
        // Apply layer positioning
        let finalPaths: Path[];
        if (keepOriginals) {
          finalPaths = layerPosition === 'top' 
            ? [...svgDocument.paths, merged]
            : layerPosition === 'bottom'
            ? [merged, ...svgDocument.paths]
            : [...svgDocument.paths, merged]; // afterSelection - same as top for keep originals
        } else {
          finalPaths = layerPosition === 'top'
            ? [...remainingPaths, merged]
            : layerPosition === 'bottom'
            ? [merged, ...remainingPaths]
            : [...remainingPaths, merged]; // afterSelection - add at end (after where selection was)
        }
        
        return {
          ...svgDocument,
          paths: finalPaths
        };
      } else if (mergeMode === 'byColor') {
        // Merge each color group
        const mergedPaths: Path[] = [];
        const mergedIds = new Set<string>();
        
        colorGroups.forEach((group, index) => {
          // Check per-group custom color first, then fall back to global settings
          const groupColor = groupCustomColors.get(index);
          const fillColor = groupColor !== undefined
            ? groupColor
            : useCustomColor
            ? customFillColor
            : group[0].fill;
          let merged = mergePaths(group, fillColor, closeOpenPaths, 0);
          
          // Apply simplification if enabled
          if (simplifyResult) {
            merged = simplifyPath(merged, simplifyTolerance);
          }
          
          // Apply stroke configuration - check per-group first, then global
          const groupStroke = groupCustomStrokes.get(index);
          if (groupStroke !== undefined) {
            // Per-group stroke override exists
            if (groupStroke.enabled === false) {
              merged = { ...merged, stroke: 'none', strokeWidth: undefined };
            } else {
              merged = { 
                ...merged, 
                stroke: groupStroke.color, 
                strokeWidth: groupStroke.width 
              };
            }
          } else if (strokeMode === 'remove') {
            merged = { ...merged, stroke: 'none', strokeWidth: undefined };
          } else if (strokeMode === 'custom') {
            merged = { 
              ...merged, 
              stroke: customStrokeColor, 
              strokeWidth: customStrokeWidth 
            };
          } else {
            // fromFirst - keep stroke from first path
            merged = { ...merged, stroke: group[0].stroke, strokeWidth: group[0].strokeWidth };
          }
          
          // Apply opacity (per-group or global)
          const groupOpacity = groupOpacities.get(index);
          if (groupOpacity !== undefined) {
            merged = { ...merged, opacity: groupOpacity };
          } else if (opacity < 1) {
            merged = { ...merged, opacity };
          }
          
          mergedPaths.push(merged);
          group.forEach(p => mergedIds.add(p.id));
        });
        
        // Add unmerged paths
        const unmatchedPaths = svgDocument.paths.filter(p => !mergedIds.has(p.id));
        
        // Apply layer positioning
        let finalPaths: Path[];
        if (keepOriginals) {
          finalPaths = layerPosition === 'top'
            ? [...svgDocument.paths, ...mergedPaths]
            : layerPosition === 'bottom'
            ? [...mergedPaths, ...svgDocument.paths]
            : [...svgDocument.paths, ...mergedPaths]; // afterSelection - same as top
        } else {
          finalPaths = layerPosition === 'top'
            ? [...unmatchedPaths, ...mergedPaths]
            : layerPosition === 'bottom'
            ? [...mergedPaths, ...unmatchedPaths]
            : [...unmatchedPaths, ...mergedPaths]; // afterSelection
        }
        
        return {
          ...svgDocument,
          paths: finalPaths
        };
      } else {
        // Flatten mode - merge each proximity group
        const mergedPaths: Path[] = [];
        const mergedIds = new Set<string>();
        
        proximityGroups.forEach((group, index) => {
          // Check per-group custom color first, then fall back to global settings
          const groupColor = groupCustomColors.get(index);
          const fillColor = groupColor !== undefined
            ? groupColor
            : useCustomColor
            ? customFillColor
            : group[0].fill;
          let merged = mergePaths(group, fillColor, closeOpenPaths, 0);
          
          // Apply simplification if enabled
          if (simplifyResult) {
            merged = simplifyPath(merged, simplifyTolerance);
          }
          
          // Apply stroke configuration - check per-group first, then global
          const groupStroke = groupCustomStrokes.get(index);
          if (groupStroke !== undefined) {
            // Per-group stroke override exists
            if (groupStroke.enabled === false) {
              merged = { ...merged, stroke: 'none', strokeWidth: undefined };
            } else {
              merged = { 
                ...merged, 
                stroke: groupStroke.color, 
                strokeWidth: groupStroke.width 
              };
            }
          } else if (strokeMode === 'remove') {
            merged = { ...merged, stroke: 'none', strokeWidth: undefined };
          } else if (strokeMode === 'custom') {
            merged = { 
              ...merged, 
              stroke: customStrokeColor, 
              strokeWidth: customStrokeWidth 
            };
          } else {
            // fromFirst - keep stroke from first path
            merged = { ...merged, stroke: group[0].stroke, strokeWidth: group[0].strokeWidth };
          }
          
          // Apply opacity (per-group or global)
          const groupOpacity = groupOpacities.get(index);
          if (groupOpacity !== undefined) {
            merged = { ...merged, opacity: groupOpacity };
          } else if (opacity < 1) {
            merged = { ...merged, opacity };
          }
          
          mergedPaths.push(merged);
          group.forEach(p => mergedIds.add(p.id));
        });
        
        // Add unmerged paths
        const unmatchedPaths = svgDocument.paths.filter(p => !mergedIds.has(p.id));
        
        // Apply layer positioning
        let finalPaths: Path[];
        if (keepOriginals) {
          finalPaths = layerPosition === 'top'
            ? [...svgDocument.paths, ...mergedPaths]
            : layerPosition === 'bottom'
            ? [...mergedPaths, ...svgDocument.paths]
            : [...svgDocument.paths, ...mergedPaths]; // afterSelection - same as top
        } else {
          finalPaths = layerPosition === 'top'
            ? [...unmatchedPaths, ...mergedPaths]
            : layerPosition === 'bottom'
            ? [...mergedPaths, ...unmatchedPaths]
            : [...unmatchedPaths, ...mergedPaths]; // afterSelection
        }
        
        return {
          ...svgDocument,
          paths: finalPaths
        };
      }
    } catch (error) {
      console.error('Preview generation error:', error);
      return null;
    }
  }, [svgDocument, pathsToMerge, mergeMode, selectedPathIds, colorGroups, proximityGroups, useCustomColor, customFillColor, keepOriginals, strokeMode, customStrokeColor, customStrokeWidth, opacity, closeOpenPaths, layerPosition, simplifyResult, simplifyTolerance, groupCustomColors, groupCustomStrokes, groupOpacities]);

  // Statistics
  const stats = useMemo(() => {
    if (!svgDocument || !previewDocument) {
      return {
        before: svgDocument?.paths.length || 0,
        after: svgDocument?.paths.length || 0,
        reduction: 0,
        groupCount: 0
      };
    }
    
    const before = svgDocument.paths.length;
    const after = keepOriginals ? previewDocument.paths.length : previewDocument.paths.length;
    const reduction = Math.round(((before - (keepOriginals ? before : after)) / before) * 100);
    
    // Calculate actual group count based on what will be merged
    let groupCount = 0;
    if (mergeMode === 'byColor') {
      // Only count groups with 2+ paths
      groupCount = colorGroups.filter(g => g.length >= 2).length;
    } else if (mergeMode === 'flatten') {
      // Only count groups with 2+ paths
      groupCount = proximityGroups.filter(g => g.length >= 2).length;
    } else {
      // selected mode: only count if we're actually merging
      groupCount = pathsToMerge.length >= 2 ? 1 : 0;
    }
    
    return {
      before,
      after: keepOriginals ? before : after,
      reduction,
      groupCount
    };
  }, [svgDocument, previewDocument, colorGroups, proximityGroups, mergeMode, keepOriginals, pathsToMerge]);

  // Reset view handler
  const resetView = useCallback(() => {
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - previewPan.x, y: e.clientY - previewPan.y });
    }
  }, [previewPan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPreviewPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Zoom handlers
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.95 : 1.05;
      setPreviewZoom(prev => Math.min(Math.max(prev * delta, 0.1), 10));
    };

    const original = originalPreviewRef.current;
    const merged = mergedPreviewRef.current;

    if (original) {
      original.addEventListener('wheel', handleWheel, { passive: false });
    }
    if (merged) {
      merged.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (original) original.removeEventListener('wheel', handleWheel);
      if (merged) merged.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Generate original SVG with highlights
  const originalSVG = useMemo(() => {
    if (!svgDocument) return '';

    // Create a map of path IDs to their group index (for color-coding)
    const pathToGroupIndex = new Map<string, number>();
    if (mergeMode === 'byColor') {
      colorGroups.forEach((group, groupIndex) => {
        group.forEach(path => {
          pathToGroupIndex.set(path.id, groupIndex);
        });
      });
    } else if (mergeMode === 'flatten') {
      proximityGroups.forEach((group, groupIndex) => {
        group.forEach(path => {
          pathToGroupIndex.set(path.id, groupIndex);
        });
      });
    }

    const pathElements = svgDocument.paths.map(path => {
      const willBeMerged = pathsToMerge.some(p => p.id === path.id);
      const groupIndex = pathToGroupIndex.get(path.id);
      const isSelected = groupIndex !== undefined && groupIndex === selectedGroupIndex;
      
      // Determine stroke color based on group or selection
      let stroke = 'none';
      let strokeWidth = (path.strokeWidth || 1);
      let opacity = willBeMerged ? 1 : 0.3;
      
      if (willBeMerged) {
        if ((mergeMode === 'byColor' || mergeMode === 'flatten') && groupIndex !== undefined) {
          // Color-code by group
          stroke = groupColors[groupIndex % groupColors.length];
          strokeWidth = isSelected ? 3 : 2;
          opacity = isSelected ? 1 : (selectedGroupIndex === null ? 1 : 0.5);
        } else {
          // Selected mode - use blue
          stroke = '#3b82f6';
          strokeWidth = 2;
        }
      }
      
      const transformAttr = path.transform?.raw ? ` transform="${path.transform.raw}"` : '';
      
      return `<path d="${path.d}" fill="${path.fill || 'none'}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"${transformAttr}/>`;
    });

    const viewBox = svgDocument.viewBox 
      ? `${svgDocument.viewBox.x} ${svgDocument.viewBox.y} ${svgDocument.viewBox.width} ${svgDocument.viewBox.height}`
      : `0 0 ${svgDocument.width} ${svgDocument.height}`;
    
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
${pathElements.join('\n')}
</svg>`;
  }, [svgDocument, pathsToMerge, mergeMode, colorGroups, proximityGroups, selectedGroupIndex, groupColors]);

  // Generate merged preview SVG (pure preview, no selection state)
  const mergedSVG = useMemo(() => {
    if (!previewDocument) return originalSVG;

    const pathElements = previewDocument.paths.map(path => {
      const strokeWidth = path.strokeWidth ||1;
      const stroke = path.stroke !== undefined ? path.stroke : 'none';
      const fill = path.fill !== undefined ? path.fill : 'none';
      const transformAttr = path.transform?.raw ? ` transform="${path.transform.raw}"` : '';
      const opacityAttr = path.opacity !== undefined && path.opacity < 1 ? ` opacity="${path.opacity}"` : '';
      
      return `<path d="${path.d}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${transformAttr}${opacityAttr}/>`;
    });

    const viewBox = previewDocument.viewBox 
      ? `${previewDocument.viewBox.x} ${previewDocument.viewBox.y} ${previewDocument.viewBox.width} ${previewDocument.viewBox.height}`
      : `0 0 ${previewDocument.width} ${previewDocument.height}`;
    
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
${pathElements.join('\n')}</svg>`;
  }, [previewDocument, originalSVG]);

  // Apply merge
  const handleApply = useCallback(() => {
    if (!previewDocument) return;
    
    setSVGDocument(previewDocument);
    onClose();
  }, [previewDocument, setSVGDocument, onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && previewDocument) {
        handleApply();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleApply, previewDocument]);

  const canMerge = pathsToMerge.length >= 2;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-bg-secondary rounded-lg shadow-xl w-[90vw] h-[90vh] max-w-7xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-semibold">Merge Paths</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1"
            title="Close (Esc)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            {/* Preview Section */}
            <div>
              <div className="grid grid-cols-2 gap-4">
                {/* Original */}
                <div>
                  <h3 className="text-sm font-medium mb-2 text-gray-400">
                    Original ({stats.before} paths)
                  </h3>
                  <div 
                    ref={originalPreviewRef}
                    className="bg-bg-primary rounded border border-border overflow-hidden cursor-move select-none relative"
                    style={{ height: '320px' }}
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
                      dangerouslySetInnerHTML={{ __html: originalSVG }}
                    />
                  </div>
                </div>

                {/* Merged Preview */}
                <div>
                  <h3 className="text-sm font-medium mb-2 text-gray-400">
                    After Merge ({stats.after} paths)
                  </h3>
                  <div 
                    ref={mergedPreviewRef}
                    className="bg-bg-primary rounded border border-border overflow-hidden cursor-move select-none relative"
                    style={{ height: '320px' }}
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
                      dangerouslySetInnerHTML={{ __html: mergedSVG }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-gray-500">💡 Scroll to zoom, drag to pan</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">Zoom: {(previewZoom * 100).toFixed(0)}%</span>
                  <button
                    onClick={resetView}
                    className="text-xs px-2 py-1 bg-bg-tertiary hover:bg-opacity-80 rounded"
                  >
                    Reset View
                  </button>
                </div>
              </div>

              {/* Statistics */}
              {canMerge && (
                <div className="mt-3 p-3 bg-blue-500 bg-opacity-10 rounded border border-blue-500 border-opacity-30">
                  <div className="text-sm">
                    <span className="text-gray-400">Reduction:</span>{' '}
                    <span className="text-blue-400 font-medium">
                      {stats.before} → {stats.after} paths
                      {!keepOriginals && stats.reduction > 0 && (
                        <span className="text-green-400 ml-2">(-{stats.reduction}%)</span>
                      )}
                    </span>
                    {(mergeMode === 'byColor' || mergeMode === 'flatten') && (
                      <>
                        {' • '}
                        <span className="text-gray-400">Groups:</span>{' '}
                        <span className="text-blue-400 font-medium">{stats.groupCount}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Group Inspector - Visual cards for each group */}
            {(mergeMode === 'byColor' && colorGroups.length > 0) || (mergeMode === 'flatten' && proximityGroups.length > 0) ? (
              <div>
                <h3 className="text-sm font-medium mb-3 text-gray-300">Customize Groups</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(mergeMode === 'byColor' ? colorGroups : proximityGroups).map((group, index) => {
                    const isSelected = selectedGroupIndex === index;
                    const customColor = groupCustomColors.get(index);
                    const customStroke = groupCustomStrokes.get(index);
                    return (
                      <div
                        key={index}
                        className="p-3 rounded-lg border-2 transition-all cursor-pointer"
                        style={{
                          borderColor: isSelected ? '#3b82f6' : '#374151',
                          backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : '#1f2937'
                        }}
                        onClick={() => setSelectedGroupIndex(isSelected ? null : index)}
                      >
                        {/* Group Header */}
                        <div className="flex items-center gap-2 mb-3">
                          <div
                            className="w-6 h-6 rounded-full border-2"
                            style={{ 
                              backgroundColor: customColor || group[0].fill || '#666',
                              borderColor: groupColors[index % groupColors.length]
                            }}
                          />
                          <span className="text-sm font-medium flex-1">
                            Group {index + 1}
                          </span>
                          <span className="text-xs text-gray-500">
                            {group.length} {group.length === 1 ? 'path' : 'paths'}
                          </span>
                          <span className="text-sm">
                            {isSelected ? <Eye size={16} strokeWidth={1.5} /> : <Circle size={16} strokeWidth={1.5} />}
                          </span>
                        </div>

                        {/* Fill Color Control */}
                        <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                          <label className="block text-xs text-gray-400 mb-1">Fill</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={customColor || group[0].fill || '#666666'}
                              onChange={(e) => {
                                const newColors = new Map(groupCustomColors);
                                newColors.set(index, e.target.value);
                                setGroupCustomColors(newColors);
                              }}
                              className="w-8 h-8 rounded cursor-pointer"
                            />
                            <input
                              type="text"
                              value={customColor || group[0].fill || '#666666'}
                              onChange={(e) => {
                                const newColors = new Map(groupCustomColors);
                                newColors.set(index, e.target.value);
                                setGroupCustomColors(newColors);
                              }}
                              className="flex-1 px-2 py-1 text-xs bg-bg-primary border border-border rounded font-mono"
                            />
                          </div>
                        </div>

                        {/* Stroke Controls */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-gray-400">Stroke</label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={customStroke?.enabled ?? (group[0].stroke !== 'none' && group[0].stroke !== undefined)}
                                onChange={(e) => {
                                  const newStrokes = new Map(groupCustomStrokes);
                                  newStrokes.set(index, { 
                                    color: customStroke?.color || group[0].stroke || customStrokeColor,
                                    width: customStroke?.width || group[0].strokeWidth || customStrokeWidth,
                                    enabled: e.target.checked
                                  });
                                  setGroupCustomStrokes(newStrokes);
                                }}
                                className="w-3 h-3"
                              />
                              <span className="text-xs text-gray-500">Enabled</span>
                            </label>
                          </div>
                          {(customStroke?.enabled ?? (group[0].stroke !== 'none' && group[0].stroke !== undefined)) && (
                            <>
                              <div className="flex items-center gap-2 mb-1">
                                <input
                                  type="color"
                                  value={customStroke?.color || group[0].stroke || customStrokeColor}
                                  onChange={(e) => {
                                    const newStrokes = new Map(groupCustomStrokes);
                                    newStrokes.set(index, { 
                                      color: e.target.value,
                                      width: customStroke?.width || group[0].strokeWidth || customStrokeWidth,
                                      enabled: customStroke?.enabled ?? (group[0].stroke !== 'none' && group[0].stroke !== undefined)
                                    });
                                    setGroupCustomStrokes(newStrokes);
                                  }}
                                  className="w-8 h-8 rounded cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={customStroke?.color || group[0].stroke || customStrokeColor}
                                  onChange={(e) => {
                                    const newStrokes = new Map(groupCustomStrokes);
                                    newStrokes.set(index, {
                                      color: e.target.value,
                                      width: customStroke?.width || group[0].strokeWidth || customStrokeWidth,
                                      enabled: customStroke?.enabled ?? (group[0].stroke !== 'none' && group[0].stroke !== undefined)
                                    });
                                    setGroupCustomStrokes(newStrokes);
                                  }}
                                  className="flex-1 px-2 py-1 text-xs bg-bg-primary border border-border rounded font-mono"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-500">Width:</label>
                                <input
                                  type="range"
                                  min="0.5"
                                  max="10"
                                  step="0.5"
                                  value={customStroke?.width || group[0].strokeWidth || customStrokeWidth}
                                  onChange={(e) => {
                                    const newStrokes = new Map(groupCustomStrokes);
                                    newStrokes.set(index, {
                                      color: customStroke?.color || group[0].stroke || customStrokeColor,
                                      width: parseFloat(e.target.value),
                                      enabled: customStroke?.enabled ?? (group[0].stroke !== 'none' && group[0].stroke !== undefined)
                                    });
                                    setGroupCustomStrokes(newStrokes);
                                  }}
                                  className="flex-1"
                                />
                                <span className="text-xs text-gray-400 w-10 text-right">
                                  {(customStroke?.width || group[0].strokeWidth || customStrokeWidth).toFixed(1)}px
                                </span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Opacity Control */}
                        <div onClick={(e) => e.stopPropagation()} className="mt-2">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-500">Opacity:</label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={(groupOpacities.get(index) ?? opacity) * 100}
                              onChange={(e) => {
                                const newOpacities = new Map(groupOpacities);
                                newOpacities.set(index, parseInt(e.target.value) / 100);
                                setGroupOpacities(newOpacities);
                              }}
                              className="flex-1"
                            />
                            <span className="text-xs text-gray-400 w-8 text-right">
                              {Math.round((groupOpacities.get(index) ?? opacity) * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-3">💡 Click a group to highlight it in the preview above</p>
              </div>
            ) : null}

            {/* Global Settings Section */}
            <div className="space-y-5 border-t border-border pt-6">
              {/* Merge Mode */}
              <div>
                <label className="block text-sm font-medium mb-3">Merge Mode</label>
                <div className="space-y-2">
                  <label className="flex items-start cursor-pointer">
                    <input
                      type="radio"
                      name="mergeMode"
                      value="selected"
                      checked={mergeMode === 'selected'}
                      onChange={() => setMergeMode('selected')}
                      disabled={selectedPathIds.length < 2}
                      className="mt-1 mr-2"
                    />
                    <div className="flex-1">
                      <div className="font-medium">
                        Selected paths only
                        {selectedPathIds.length < 2 && (
                          <span className="text-gray-500 font-normal ml-2">(Select 2+ paths)</span>
                        )}
                        {selectedPathIds.length >= 2 && (
                          <span className="text-blue-400 font-normal ml-2">({selectedPathIds.length} selected)</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Merge manually selected paths into one
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start cursor-pointer">
                    <input
                      type="radio"
                      name="mergeMode"
                      value="byColor"
                      checked={mergeMode === 'byColor'}
                      onChange={() => {
                        setMergeMode('byColor');
                        setSelectedGroupIndex(null);
                      }}
                      className="mt-1 mr-2"
                    />
                    <div className="flex-1">
                      <div className="font-medium">Paths by color similarity</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Auto-detect and merge paths with similar colors
                      </div>
                      {mergeMode === 'byColor' && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">
                              Color similarity threshold: {(colorThreshold * 100).toFixed(0)}%
                              {colorThreshold < 0.85 && (
                                <span className="text-amber-400 ml-2">⚠️ Loose matching</span>
                              )}
                              <span className="text-blue-400 ml-2">
                                ({colorGroups.length} {colorGroups.length === 1 ? 'group' : 'groups'})
                              </span>
                            </label>
                            <input
                              type="range"
                              min="70"
                              max="100"
                              step="1"
                              value={colorThreshold * 100}
                              onChange={(e) => {
                                setColorThreshold(parseInt(e.target.value) / 100);
                                setSelectedGroupIndex(null); // Clear selection when threshold changes
                              }}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                              <span>Loose (70%)</span>
                              <span>Exact (100%)</span>
                            </div>
                          </div>

                          {colorGroups.length === 0 && (
                            <div className="p-2 bg-amber-500 bg-opacity-10 rounded border border-amber-500 border-opacity-30">
                              <div className="text-xs text-amber-400">
                                No groups found. Try lowering the threshold.
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </label>

                  <label className="flex items-start cursor-pointer">
                    <input
                      type="radio"
                      name="mergeMode"
                      value="flatten"
                      checked={mergeMode === 'flatten'}
                      onChange={() => {
                        setMergeMode('flatten');
                        setSelectedGroupIndex(null);
                      }}
                      className="mt-1 mr-2"
                    />
                    <div className="flex-1">
                      <div className="font-medium">Flatten by proximity</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Merge paths that are close together spatially
                      </div>
                      {mergeMode === 'flatten' && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">
                              Distance threshold: {proximityThreshold}px
                              <span className="text-blue-400 ml-2">
                                ({proximityGroups.length} {proximityGroups.length === 1 ? 'group' : 'groups'})
                              </span>
                            </label>
                            <input
                              type="range"
                              min="5"
                              max="100"
                              step="5"
                              value={proximityThreshold}
                              onChange={(e) => {
                                setProximityThreshold(parseInt(e.target.value));
                                setSelectedGroupIndex(null);
                              }}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                              <span>Close (5px)</span>
                              <span>Far (100px)</span>
                            </div>
                          </div>

                          {proximityGroups.length === 0 && (
                            <div className="p-2 bg-amber-500 bg-opacity-10 rounded border border-amber-500 border-opacity-30">
                              <div className="text-xs text-amber-400">
                                No groups found. Try increasing the threshold.
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Close Open Paths */}
              <div>
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={closeOpenPaths}
                    onChange={(e) => setCloseOpenPaths(e.target.checked)}
                    className="mt-1 mr-2"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Close open paths</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Automatically close any unclosed paths before merging
                    </div>
                  </div>
                </label>
              </div>

              {/* Layer Positioning */}
              <div>
                <label className="block text-sm font-medium mb-3">Layer position</label>
                <div className="space-y-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="layerPosition"
                      checked={layerPosition === 'afterSelection'}
                      onChange={() => setLayerPosition('afterSelection')}
                      className="mr-2"
                    />
                    <span>After selection (default z-order)</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="layerPosition"
                      checked={layerPosition === 'top'}
                      onChange={() => setLayerPosition('top')}
                      className="mr-2"
                    />
                    <span>Top of layer stack (render last)</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="layerPosition"
                      checked={layerPosition === 'bottom'}
                      onChange={() => setLayerPosition('bottom')}
                      className="mr-2"
                    />
                    <span>Bottom of layer stack (render first)</span>
                  </label>
                </div>
              </div>

              {/* Simplify Result */}
              <div>
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simplifyResult}
                    onChange={(e) => setSimplifyResult(e.target.checked)}
                    className="mt-1 mr-2"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Simplify result</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Intelligently reduce path complexity while preserving visual fidelity
                    </div>
                  </div>
                </label>
                {simplifyResult && (
                  <div className="mt-3 ml-6 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Tolerance:</span>
                      <span className="font-medium">{simplifyTolerance.toFixed(2)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="2"
                      step="0.05"
                      value={simplifyTolerance}
                      onChange={(e) => setSimplifyTolerance(parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                      <span>Precise (0.05%)</span>
                      <span>Aggressive (2%)</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      • 3-step algorithm: Visvalingam-Whyatt → Schneider fitting → G1 continuity<br/>
                      • Percentage of bounding box diagonal<br/>
                      • Typical: 0.1% (display quality)<br/>
                      • Closed paths snap shut perfectly, no gaps
                    </div>
                  </div>
                )}
              </div>

              {/* Default Settings for Groups (only shown in byColor/flatten modes) */}
              {(mergeMode === 'byColor' || mergeMode === 'flatten') && (
                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-medium mb-3 text-gray-300">Default Group Settings</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    These settings apply to groups that don't have custom overrides in the Group Inspector above.
                  </p>

                  {/* Default Fill Color */}
                  <div className="mb-4">
                    <label className="block text-xs font-medium mb-2 text-gray-400">Default Fill</label>
                    <div className="space-y-2">
                      <label className="flex items-center cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="colorMode"
                          checked={!useCustomColor}
                          onChange={() => setUseCustomColor(false)}
                          className="mr-2"
                        />
                        <span>Use group's first path color</span>
                      </label>

                      <label className="flex items-center cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="colorMode"
                          checked={useCustomColor}
                          onChange={() => setUseCustomColor(true)}
                          className="mr-2"
                        />
                        <span>Custom color</span>
                        {useCustomColor && (
                          <input
                            type="color"
                            value={customFillColor || '#3b82f6'}
                            onChange={(e) => setCustomFillColor(e.target.value)}
                            className="ml-2 w-8 h-6 rounded cursor-pointer"
                          />
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Default Stroke */}
                  <div className="mb-4">
                    <label className="block text-xs font-medium mb-2 text-gray-400">Default Stroke</label>
                    <div className="space-y-2">
                      <label className="flex items-center cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="strokeMode"
                          checked={strokeMode === 'fromFirst'}
                          onChange={() => setStrokeMode('fromFirst')}
                          className="mr-2"
                        />
                        <span>Use group's first path stroke</span>
                      </label>
                      <label className="flex items-center cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="strokeMode"
                          checked={strokeMode === 'custom'}
                          onChange={() => setStrokeMode('custom')}
                          className="mr-2"
                        />
                        <span>Custom stroke</span>
                        {strokeMode === 'custom' && (
                          <div className="ml-2 flex items-center gap-2">
                            <input
                              type="color"
                              value={customStrokeColor}
                              onChange={(e) => setCustomStrokeColor(e.target.value)}
                              className="w-8 h-6 rounded cursor-pointer"
                            />
                            <input
                              type="number"
                              min="0.5"
                              max="10"
                              step="0.5"
                              value={customStrokeWidth}
                              onChange={(e) => setCustomStrokeWidth(parseFloat(e.target.value))}
                              className="w-16 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs"
                            />
                            <span className="text-xs text-gray-500">px</span>
                          </div>
                        )}
                      </label>
                      <label className="flex items-center cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="strokeMode"
                          checked={strokeMode === 'remove'}
                          onChange={() => setStrokeMode('remove')}
                          className="mr-2"
                        />
                        <span>Remove stroke</span>
                      </label>
                    </div>
                  </div>

                  {/* Default Opacity */}
                  <div>
                    <label className="block text-xs font-medium mb-2 text-gray-400">Default Opacity</label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Opacity:</span>
                        <span className="font-medium">{Math.round(opacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={opacity}
                        onChange={(e) => setOpacity(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Keep Originals */}
              <div>
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepOriginals}
                    onChange={(e) => setKeepOriginals(e.target.checked)}
                    className="mt-1 mr-2"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Keep original paths</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Add merged path without deleting originals
                    </div>
                  </div>
                </label>
              </div>

              {/* Warning if cannot merge */}
              {!canMerge && (
                <div className="p-3 bg-amber-500 bg-opacity-10 rounded border border-amber-500 border-opacity-30">
                  <div className="text-sm text-amber-400">
                    ⚠️ {mergeMode === 'selected' 
                      ? 'Select at least 2 paths to merge' 
                      : 'No paths with similar colors found. Try lowering the threshold.'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-bg-tertiary hover:bg-opacity-80 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!canMerge}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Merge Paths
          </button>
        </div>
      </div>
    </div>
  );
}
