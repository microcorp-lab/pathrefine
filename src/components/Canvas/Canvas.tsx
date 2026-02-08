import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { Point, Path } from '../../types/svg';
import { 
  extractControlPoints, 
  updateControlPoint,
  addPointToSegment,
  removePoint,
  findClosestPointOnSegment
} from '../../engine/pathEditor';
import { analyzePath } from '../../engine/pathAnalysis';
import { shouldIgnoreKeyboardShortcut } from '../../utils/keyboard';
import { applyInverseTransform, applyTransform } from '../../engine/transforms';
import { FolderOpen, Flame, Info, X } from 'lucide-react';
import { DEMO_LOGO_SVG } from '../../data/demoLogo';
import { parseSVG } from '../../engine/parser';

export const Canvas: React.FC = () => {
  const svgDocument = useEditorStore(state => state.svgDocument);
  const selectedPathIds = useEditorStore(state => state.selectedPathIds);
  const zoom = useEditorStore(state => state.zoom);
  const pan = useEditorStore(state => state.pan);
  const activeTool = useEditorStore(state => state.activeTool);
  const editingPathId = useEditorStore(state => state.editingPathId);
  const selectedPointIndices = useEditorStore(state => state.selectedPointIndices);
  const selectPath = useEditorStore(state => state.selectPath);
  const togglePathSelection = useEditorStore(state => state.togglePathSelection);
  const clearSelection = useEditorStore(state => state.clearSelection);
  const setPan = useEditorStore(state => state.setPan);
  const setZoom = useEditorStore(state => state.setZoom);
  const setEditingPath = useEditorStore(state => state.setEditingPath);
  const setSelectedPoint = useEditorStore(state => state.setSelectedPoint);
  const togglePointSelection = useEditorStore(state => state.togglePointSelection);
  const clearPointSelection = useEditorStore(state => state.clearPointSelection);
  const updatePath = useEditorStore(state => state.updatePath);
  const setSVGDocument = useEditorStore(state => state.setSVGDocument);
  const snapToGrid = useEditorStore(state => state.snapToGrid);
  const gridSize = useEditorStore(state => state.gridSize);
  const marqueeStart = useEditorStore(state => state.marqueeStart);
  const marqueeEnd = useEditorStore(state => state.marqueeEnd);
  const setMarqueeStart = useEditorStore(state => state.setMarqueeStart);
  const setMarqueeEnd = useEditorStore(state => state.setMarqueeEnd);
  const showHeatmap = useEditorStore(state => state.showHeatmap);
  const historyIndex = useEditorStore(state => state.historyIndex);
  const pathAlignmentSelectionMode = useEditorStore(state => state.pathAlignmentSelectionMode);

  // Detect touch device
  const [isTouchDevice] = useState(() => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });

  // Hints visibility state
  const [showHints, setShowHints] = useState(() => {
    const saved = localStorage.getItem('showEditHints');
    if (saved !== null) return saved === 'true';
    // Default: show on desktop, hide on mobile/touch
    return window.innerWidth >= 768 && !('ontouchstart' in window);
  });

  const loadDemoLogo = useCallback(() => {
    const doc = parseSVG(DEMO_LOGO_SVG);
    
    setSVGDocument(doc);
    
    // Auto-select the path and turn on heatmap
    setTimeout(() => {
       if (doc.paths.length > 0) {
         const pathId = doc.paths[0].id;
         selectPath(pathId);
         setEditingPath(pathId);
         // Ensure heatmap is on
         if (!useEditorStore.getState().showHeatmap) {
           useEditorStore.getState().toggleHeatmap();
         }
       }
    }, 100);
  }, [setSVGDocument, selectPath, setEditingPath]);

  // Toggle hints with 'i' key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow 'i' shortcut even in input fields for this specific case
      if (e.key === 'i' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        // Only trigger if we're in edit mode with a path selected
        if (activeTool === 'edit' && editingPathId) {
          e.preventDefault();
          setShowHints(prev => {
            const newValue = !prev;
            localStorage.setItem('showEditHints', String(newValue));
            return newValue;
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, editingPathId]);

  const handleFileOpen = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.svg,image/svg+xml';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const { parseSVG } = await import('../../engine/parser');
        const doc = parseSVG(text);
        setSVGDocument(doc);
        
        // Reset view
        setZoom(1);
        setPan(0, 0);
      } catch (error) {
        console.error('Failed to parse SVG:', error);
        alert('Failed to load SVG file. Please check the file format.');
      }
    };

    input.click();
  }, [setSVGDocument, setZoom, setPan]);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);
  const [draggedPath, setDraggedPath] = useState<Path | null>(null);
  const [lastMousePos, setLastMousePos] = useState<Point>({ x: 0, y: 0 });
  const [draggedPointInfo, setDraggedPointInfo] = useState<{
    segmentIndex: number;
    pointIndex: number;
  } | null>(null);

  // Clear draggedPath when history changes (undo/redo)
  useEffect(() => {
    setDraggedPath(null);
  }, [historyIndex]);

  // Handle mouse wheel for zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    // Only handle wheel events with Ctrl/Cmd (standard zoom gesture) or without any modifiers
    // This prevents conflicts with browser zoom
    if (e.ctrlKey || e.metaKey || (!e.shiftKey && !e.altKey)) {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(zoom * delta);
    }
  }, [zoom, setZoom]);

  // Convert screen coordinates to SVG coordinates with optional snap-to-grid
  const screenToSVG = useCallback((screenX: number, screenY: number, applySnap: boolean = true): Point => {
    if (!svgRef.current || !svgDocument) return { x: 0, y: 0 };
    
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = screenX;
    pt.y = screenY;
    
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    let x = svgP.x;
    let y = svgP.y;
    
    // Apply snap-to-grid if enabled
    if (applySnap && snapToGrid) {
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    }
    
    return { x, y };
  }, [svgDocument, snapToGrid, gridSize]);

  // Handle mouse down for panning and marquee selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Space + left click or middle mouse button for panning
    if ((e.button === 0 && isSpacePressed) || e.button === 1) {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    } else if (e.button === 0 && activeTool === 'edit' && e.shiftKey && !e.altKey && editingPathId) {
      // Start marquee selection ONLY when Shift is held AND a path is being edited
      // Store as container-relative coordinates for rendering the overlay
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const containerPos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        setMarqueeStart(containerPos);
        setMarqueeEnd(containerPos);
      }
    } else if (e.button === 0 && activeTool === 'edit' && !e.shiftKey && !e.altKey && !isSpacePressed) {
      // Click on empty canvas to deselect all
      clearSelection();
      setEditingPath(null);
    }
  }, [activeTool, isSpacePressed, editingPathId, setMarqueeStart, setMarqueeEnd, clearSelection, setEditingPath]);

  // Handle control point interactions
  const handleControlPointMouseDown = useCallback((
    e: React.MouseEvent,
    segmentIndex: number,
    pointIndex: number,
    controlPointIndex: number
  ) => {
    e.stopPropagation();
    if (activeTool === 'edit') {
      // If Shift is held, don't handle point selection (let marquee happen instead)
      if (e.shiftKey) {
        return;
      }
      
      // Option/Alt+click - toggle point selection without starting drag
      if (e.altKey) {
        togglePointSelection(controlPointIndex);
        return;
      }
      
      // Regular click - select and start dragging this point
      setSelectedPoint(controlPointIndex);
      setIsDraggingPoint(true);
      setDraggedPointInfo({ segmentIndex, pointIndex });
    }
  }, [activeTool, togglePointSelection, setSelectedPoint, setIsDraggingPoint, setDraggedPointInfo]);

  const handleControlPointDrag = useCallback((e: React.MouseEvent) => {
    if (isDraggingPoint && draggedPointInfo && editingPathId && svgDocument) {
      const svgPos = screenToSVG(e.clientX, e.clientY);
      const sourcePath = draggedPath || svgDocument.paths.find(p => p.id === editingPathId);
      
      if (sourcePath) {
        // Convert from SVG coordinates to path-local coordinates (accounting for transform)
        const localPos = applyInverseTransform(svgPos, sourcePath.transform?.raw);
        
        const updatedPath = updateControlPoint(
          sourcePath,
          draggedPointInfo.segmentIndex,
          draggedPointInfo.pointIndex,
          localPos
        );
        setDraggedPath(updatedPath);
      }
    }
  }, [isDraggingPoint, draggedPointInfo, editingPathId, svgDocument, draggedPath, screenToSVG]);

  const handleControlPointMouseUp = useCallback(() => {
    // Clear drag state first
    setIsDraggingPoint(false);
    setDraggedPointInfo(null);
    
    // Save to history when drag completes
    if (draggedPath && editingPathId) {
      // This creates a single history entry for the entire drag operation
      updatePath(editingPathId, draggedPath, 'Move control point');
    }
    
    // Clear draggedPath last to ensure the committed path is used on next render
    setDraggedPath(null);
  }, [draggedPath, editingPathId, updatePath]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      // Scale pan movement by zoom level for consistent feel
      setPan(pan.x + dx, pan.y + dy);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else if (isDraggingPoint) {
      handleControlPointDrag(e);
    } else if (marqueeStart) {
      // Update marquee end position (container-relative)
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const containerPos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        setMarqueeEnd(containerPos);
      }
    }
  }, [isPanning, isDraggingPoint, marqueeStart, lastMousePos, pan, setPan, handleControlPointDrag, setMarqueeEnd]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    handleControlPointMouseUp();
    
    // Complete marquee selection only if there was actual drag movement
    if (marqueeStart && marqueeEnd && editingPathId && svgDocument && containerRef.current) {
      // Check if there was significant movement (drag distance > 5px)
      const dragDistance = Math.sqrt(
        Math.pow(marqueeEnd.x - marqueeStart.x, 2) + 
        Math.pow(marqueeEnd.y - marqueeStart.y, 2)
      );
      
      if (dragDistance > 5) {
        const path = svgDocument.paths.find(p => p.id === editingPathId);
        if (path) {
          // Convert container coordinates to SVG coordinates for selection
          const rect = containerRef.current.getBoundingClientRect();
          const startSvg = screenToSVG(marqueeStart.x + rect.left, marqueeStart.y + rect.top, false);
          const endSvg = screenToSVG(marqueeEnd.x + rect.left, marqueeEnd.y + rect.top, false);
          
          const controlPoints = extractControlPoints(path);
          const minX = Math.min(startSvg.x, endSvg.x);
          const maxX = Math.max(startSvg.x, endSvg.x);
          const minY = Math.min(startSvg.y, endSvg.y);
          const maxY = Math.max(startSvg.y, endSvg.y);
          
          // Find all points within rectangle
          // Apply path transform to control points before checking if they're in the marquee
          const selectedIndices: number[] = [];
          controlPoints.forEach((cp, index) => {
            // Transform the control point from path-local to SVG world coordinates
            const worldPoint = applyTransform(cp.point, path.transform?.raw);
            
            if (worldPoint.x >= minX && worldPoint.x <= maxX && 
                worldPoint.y >= minY && worldPoint.y <= maxY) {
              selectedIndices.push(index);
            }
          });
          
          // Clear existing selection and set new selection
          clearPointSelection();
          selectedIndices.forEach(index => togglePointSelection(index));
        }
      }
      
      setMarqueeStart(null);
      setMarqueeEnd(null);
    }
  }, [handleControlPointMouseUp, marqueeStart, marqueeEnd, editingPathId, svgDocument, clearPointSelection, togglePointSelection, setMarqueeStart, setMarqueeEnd, screenToSVG]);

  // Handle path click
  const handlePathClick = useCallback((pathId: string, e: React.MouseEvent) => {
    // Handle path alignment selection mode
    if (pathAlignmentSelectionMode !== 'none') {
      e.stopPropagation();
      // Dispatch event to modal with the selected path ID
      const event = new CustomEvent('pathAlignmentPathSelected', { 
        detail: { pathId, mode: pathAlignmentSelectionMode } 
      });
      window.dispatchEvent(event);
      return;
    }
    
    if (activeTool === 'edit' && !isSpacePressed && !e.altKey) {
      e.stopPropagation();
      // Shift+Click for multi-select
      if (e.shiftKey) {
        togglePathSelection(pathId);
        // Also set as editing path to show control points
        setEditingPath(pathId);
      } else {
        selectPath(pathId);
        setEditingPath(pathId);
      }
    }
  }, [activeTool, isSpacePressed, selectPath, togglePathSelection, setEditingPath, pathAlignmentSelectionMode]);

  // Handle path segment click to add point
  const handleSegmentClick = useCallback((e: React.MouseEvent, pathId: string, segmentIndex: number) => {
    if (activeTool === 'edit' && e.altKey && svgDocument) {
      e.preventDefault();
      e.stopPropagation();
      const path = svgDocument.paths.find(p => p.id === pathId);
      if (path) {
        const svgPos = screenToSVG(e.clientX, e.clientY);
        // Convert from SVG coordinates to path-local coordinates (accounting for transform)
        const localPos = applyInverseTransform(svgPos, path.transform?.raw);
        const segment = path.segments[segmentIndex];
        const { t } = findClosestPointOnSegment(segment, localPos);
        const updatedPath = addPointToSegment(path, segmentIndex, t);
        updatePath(pathId, updatedPath);
        
        // Re-enter edit mode to refresh control points (needed when Z segments are converted to L)
        setEditingPath(null);
        setTimeout(() => setEditingPath(pathId), 0);
      }
    }
  }, [activeTool, svgDocument, screenToSVG, updatePath, setEditingPath]);

  // Handle Space key for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressed) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed]);

  // Handle Space key for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressed) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed]);

  // Handle Shift key release during marquee selection
  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && marqueeStart !== null) {
        // User released Shift during marquee drag - cancel the marquee
        setMarqueeStart(null);
        setMarqueeEnd(null);
      }
    };

    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [marqueeStart, setMarqueeStart, setMarqueeEnd]);

  // Handle delete key to remove point
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in a text input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey) {
        if (editingPathId && selectedPointIndices.length > 0 && svgDocument) {
          e.preventDefault(); // Prevent browser back navigation on Backspace
          const path = svgDocument.paths.find(p => p.id === editingPathId);
          if (path) {
            // Convert control point indices to segment indices
            const controlPoints = extractControlPoints(path);
            const segmentIndicesToRemove = selectedPointIndices
              .map(cpIdx => controlPoints[cpIdx])
              .filter(cp => cp?.type === 'anchor') // Only remove anchor points
              .map(cp => cp.segmentIndex)
              .filter((idx, i, arr) => arr.indexOf(idx) === i) // Unique segment indices
              .sort((a, b) => b - a); // Sort descending for safe removal
            
            if (segmentIndicesToRemove.length === 0) {
              alert('Can only delete anchor points (blue dots), not control points');
              return;
            }
            
            // Remove segments in reverse order to maintain correct indices
            let updatedPath = path;
            for (const segmentIndex of segmentIndicesToRemove) {
              updatedPath = removePoint(updatedPath, segmentIndex);
            }
            updatePath(editingPathId, updatedPath, 'Delete points');
            clearPointSelection();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingPathId, selectedPointIndices, svgDocument, updatePath, clearPointSelection]);

  // Setup wheel listener - CRITICAL: must be on the container to capture all wheel events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    // Add listener with capture phase to ensure we get the event first
    const wheelHandler = (e: WheelEvent) => {
      // Prevent default for all wheel events on the canvas to avoid browser zoom
      if (e.ctrlKey || e.metaKey || (!e.shiftKey && !e.altKey)) {
        e.preventDefault();
        e.stopPropagation();
      }
      handleWheel(e);
    };
    
    container.addEventListener('wheel', wheelHandler, { passive: false, capture: true });
    return () => container.removeEventListener('wheel', wheelHandler, { capture: true });
  }, [handleWheel]);

  // Handle keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts when typing in input fields (except ESC)
      if (shouldIgnoreKeyboardShortcut(e, true)) {
        return;
      }
      
      // Zoom in: + or = key (with or without Cmd/Ctrl)
      if ((e.key === '+' || e.key === '=') && !e.shiftKey) {
        e.preventDefault();
        setZoom(zoom * 1.2);
      }
      // Zoom out: - or _ key (with or without Cmd/Ctrl)
      else if ((e.key === '-' || e.key === '_') && !e.shiftKey) {
        e.preventDefault();
        setZoom(zoom * 0.8);
      }
      // Reset zoom: 0 key
      else if (e.key === '0' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setZoom(1);
        setPan(0, 0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoom, setZoom, setPan]);

  // Handle touch events for pinch-to-zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let initialDistance = 0;
    let initialZoom = zoom;

    const getTouchDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        initialDistance = getTouchDistance(e.touches);
        initialZoom = zoom;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = getTouchDistance(e.touches);
        const scale = currentDistance / initialDistance;
        setZoom(initialZoom * scale);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, [zoom, setZoom]);

  if (!svgDocument) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0F172A] relative overflow-hidden">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" 
             style={{ 
               backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)',
               backgroundSize: '40px 40px'
             }} 
        />

        <div className="max-w-lg w-full bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl pointer-events-auto relative z-10 mx-4">
            <div className="text-center space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">
                  Start Optimizing
                </h2>
                <p className="text-slate-400">
                  Drop an SVG file here, or try our demo to see the optimization magic in action.
                </p>
              </div>

               <div className="relative group cursor-pointer" onClick={loadDemoLogo}>
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-slate-800 border border-slate-700/50 rounded-xl p-6 hover:bg-slate-800/80 transition-all flex items-center gap-6">
                  {/* Mini Preview of the messy logo */}
                  <div className="w-16 h-16 flex-shrink-0 bg-slate-900/50 rounded-lg p-2 border border-slate-700/50 flex items-center justify-center">
                    <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: DEMO_LOGO_SVG }} />
                  </div>
                  
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white">Fix Broken Logo</span>
                      <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">Messy</span>
                    </div>
                    <p className="text-sm text-slate-400">
                      Our logo was auto-traced poorly. Use <span className="text-indigo-400 font-medium">Smart Heal</span> to fix it instantly.
                    </p>
                  </div>

                  <div className="flex-shrink-0 text-indigo-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-center pt-4 border-t border-slate-800">
                <button
                  onClick={handleFileOpen}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors flex items-center gap-2 border border-slate-700"
                >
                  <FolderOpen size={18} strokeWidth={1.5} />
                  Upload SVG
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('openConverter'))}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors flex items-center gap-2 border border-slate-700"
                >
                  <FolderOpen size={18} strokeWidth={1.5} />
                   Import Image
                </button>
              </div>
            </div>
          </div>
      </div>
    );
  }


  const { viewBox } = svgDocument;
  const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  
  // Use viewBox if available, otherwise use document dimensions
  const effectiveViewBox = viewBox || { x: 0, y: 0, width: svgDocument.width, height: svgDocument.height };

  return (
    <>
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-bg-primary"
        style={{ cursor: isPanning ? 'grabbing' : (isSpacePressed ? 'grab' : 'default') }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
      {/* Grid background */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(var(--border) 1px, transparent 1px),
          linear-gradient(90deg, var(--border) 1px, transparent 1px)
        `,
        backgroundSize: `${gridSize}px ${gridSize}px`,
        transform: `translate(${pan.x % gridSize}px, ${pan.y % gridSize}px)`,
        opacity: snapToGrid ? 0.2 : 0.1,
        transition: 'opacity 0.2s'
      }} />

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="absolute"
        style={{
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) ${transform}`,
          transformOrigin: 'center',
        }}
        viewBox={`${effectiveViewBox.x} ${effectiveViewBox.y} ${effectiveViewBox.width} ${effectiveViewBox.height}`}
        width={effectiveViewBox.width}
        height={effectiveViewBox.height}
      >
        {/* ViewBox border visualization */}
        <rect
          x={effectiveViewBox.x}
          y={effectiveViewBox.y}
          width={effectiveViewBox.width}
          height={effectiveViewBox.height}
          fill="none"
          stroke="#6366f1"
          strokeWidth={2 / zoom}
          strokeDasharray={`${8 / zoom},${4 / zoom}`}
          opacity="0.3"
          className="pointer-events-none"
        />
        
        {/* Render paths */}
        {svgDocument.paths.map((storePath) => {
          // CRITICAL: Use draggedPath ONLY while actively dragging that specific path
          // Otherwise ALWAYS use storePath to ensure undo/redo work correctly
          const path = (draggedPath && storePath.id === draggedPath.id && isDraggingPoint) 
            ? draggedPath 
            : storePath;
            
          // Skip hidden paths
          if (path.visible === false) return null;
          
          const isSelected = selectedPathIds.includes(path.id);
          
          // Calculate heatmap color if enabled
          let heatmapColor = null;
          let heatmapOpacity = 0;
          if (showHeatmap) {
            const analysis = analyzePath(path);
            const density = analysis.pointDensity;
            
            // Map density to color (green -> yellow -> orange -> red)
            if (density < 1.5) {
              heatmapColor = '#10b981'; // Green - optimal
              heatmapOpacity = 0.2;
            } else if (density < 3) {
              heatmapColor = '#f59e0b'; // Yellow - acceptable
              heatmapOpacity = 0.4;
            } else if (density < 5) {
              heatmapColor = '#f97316'; // Orange - bloated
              heatmapOpacity = 0.6;
            } else {
              heatmapColor = '#ef4444'; // Red - disaster
              heatmapOpacity = 0.8;
            }
          }
          
          return (
            <g key={path.id}>
              {/* Main path */}
              <path
                d={path.d}
                fill={path.fill}
                stroke={path.stroke}
                strokeWidth={path.strokeWidth}
                opacity={path.opacity}
                fillOpacity={path.fillOpacity}
                strokeOpacity={path.strokeOpacity}
                transform={path.transform?.raw}
                className="transition-all duration-200 cursor-pointer"
                style={{
                  opacity: isSelected ? 0.8 : (path.opacity ?? 1),
                }}
                onClick={(e) => {
                  // Don't handle path click if we're dragging a point or just finished dragging
                  if (isDraggingPoint) {
                    e.stopPropagation();
                    return;
                  }
                  // Don't handle path click if shift is held (marquee selection mode)
                  if (e.shiftKey && editingPathId) {
                    e.stopPropagation();
                    return;
                  }
                  // Handle path click for selection
                  handlePathClick(path.id, e);
                }}
                onMouseDown={(e) => {
                  // Start marquee selection when Shift+clicking on path
                  if (activeTool === 'edit' && e.button === 0 && e.shiftKey && !e.altKey && editingPathId) {
                    e.stopPropagation();
                    // Use container-relative coordinates for marquee
                    if (containerRef.current) {
                      const rect = containerRef.current.getBoundingClientRect();
                      const containerPos = {
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top
                      };
                      setMarqueeStart(containerPos);
                      setMarqueeEnd(containerPos);
                    }
                  }
                }}
              />
              
              {/* Heatmap overlay */}
              {showHeatmap && heatmapColor && (
                <path
                  d={path.d}
                  fill={heatmapColor}
                  stroke={heatmapColor}
                  strokeWidth={(path.strokeWidth || 2) + 4}
                  transform={path.transform?.raw}
                  className="pointer-events-none"
                  style={{
                    opacity: heatmapOpacity,
                    mixBlendMode: 'multiply',
                  }}
                />
              )}
              
              {/* Selection outline */}
              {isSelected && (
                <path
                  d={path.d}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth={(path.strokeWidth || 0) + 3}
                  transform={path.transform?.raw}
                  className="pointer-events-none animate-pulse"
                  style={{
                    strokeDasharray: '5,5',
                    strokeDashoffset: 0,
                  }}
                />
              )}

              {/* Path Alignment: Source path highlighting (green) */}
              {(() => {
                // Get source path ID from PathAlignmentModal if in selection mode
                const modalElement = document.querySelector('[data-source-path-id]');
                const sourcePathId = modalElement?.getAttribute('data-source-path-id');
                const isSourcePath = sourcePathId === path.id;
                
                return isSourcePath && pathAlignmentSelectionMode !== 'none' ? (
                  <path
                    d={path.d}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={(path.strokeWidth || 0) + 4}
                    transform={path.transform?.raw}
                    className="pointer-events-none"
                    style={{
                      strokeDasharray: '8,4',
                      strokeDashoffset: 0,
                      opacity: 0.8,
                    }}
                  />
                ) : null;
              })()}
              
              {/* Path Alignment: Target path highlighting (blue) */}
              {(() => {
                const modalElement = document.querySelector('[data-target-path-id]');
                const targetPathId = modalElement?.getAttribute('data-target-path-id');
                const isTargetPath = targetPathId === path.id;
                
                return isTargetPath && pathAlignmentSelectionMode !== 'none' ? (
                  <path
                    d={path.d}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={(path.strokeWidth || 0) + 4}
                    transform={path.transform?.raw}
                    className="pointer-events-none"
                    style={{
                      strokeDasharray: '8,4',
                      strokeDashoffset: 0,
                      opacity: 0.8,
                    }}
                  />
                ) : null;
              })()}

              {/* Control points in edit mode - show for all selected paths */}
              {isSelected && activeTool === 'edit' && (
                <g transform={path.transform?.raw} key={`cp-${path.id}-${historyIndex}`}>
                  {/* Invisible wider path for easier Alt+clicking to add points */}
                  {path.segments.map((segment, segIdx) => {
                    // Skip M (moveto) commands as they don't draw anything
                    if (segment.type === 'M') return null;
                    
                    // Build path command based on segment type
                    let d = `M ${segment.start.x} ${segment.start.y} `;
                    if (segment.type === 'L' || segment.type === 'Z') {
                      d += `L ${segment.end.x} ${segment.end.y}`;
                    } else if (segment.type === 'C' && segment.points.length >= 2) {
                      d += `C ${segment.points[0].x} ${segment.points[0].y}, ${segment.points[1].x} ${segment.points[1].y}, ${segment.end.x} ${segment.end.y}`;
                    } else if (segment.type === 'Q' && segment.points.length >= 1) {
                      d += `Q ${segment.points[0].x} ${segment.points[0].y}, ${segment.end.x} ${segment.end.y}`;
                    } else {
                      d += `L ${segment.end.x} ${segment.end.y}`;
                    }
                    
                    return (
                      <path
                        key={`segment-${segIdx}`}
                        d={d}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={10 / zoom}
                        className="cursor-crosshair"
                        style={{ pointerEvents: 'stroke' }}
                        onClick={(e) => {
                          if (e.altKey && editingPathId === path.id) {
                            handleSegmentClick(e, path.id, segIdx);
                          }
                        }}
                      />
                    );
                  })}
                  
                  {extractControlPoints(path).map((cp, idx) => {
                    const isAnchor = cp.type === 'anchor';
                    const isPrimaryPath = editingPathId === path.id;
                    const isSelectedPoint = isPrimaryPath && selectedPointIndices.includes(idx);
                    
                    // Check if this control point is related to a selected anchor
                    const controlPoints = extractControlPoints(path);
                    const isRelatedToSelectedAnchor = isPrimaryPath && !isAnchor && selectedPointIndices.some(selectedIdx => {
                      const selectedCP = controlPoints[selectedIdx];
                      if (!selectedCP || selectedCP.type !== 'anchor') return false;
                      
                      // Control points are related to an anchor if they're in the same segment
                      // or if the anchor is at the junction between segments
                      return cp.segmentIndex === selectedCP.segmentIndex ||
                             (selectedCP.pointIndex === -1 && cp.segmentIndex === selectedCP.segmentIndex + 1) ||
                             (selectedCP.pointIndex === 0 && cp.segmentIndex === selectedCP.segmentIndex - 1);
                    });
                    
                    return (
                      <g key={`cp-${idx}`}>
                        {/* Control point handle lines for bezier curves */}
                        {!isAnchor && cp.segmentIndex < path.segments.length && (
                          <>
                            <line
                              x1={path.segments[cp.segmentIndex].start.x}
                              y1={path.segments[cp.segmentIndex].start.y}
                              x2={cp.point.x}
                              y2={cp.point.y}
                              stroke={isRelatedToSelectedAnchor ? '#06b6d4' : (isPrimaryPath ? '#a0a0a0' : '#cbd5e1')}
                              strokeWidth={isRelatedToSelectedAnchor ? 2 / zoom : 1 / zoom}
                              strokeDasharray="2,2"
                              className="pointer-events-none"
                              style={{ opacity: isPrimaryPath ? 1 : 0.4 }}
                            />
                          </>
                        )}
                        
                        {/* Control point circle */}
                        <circle
                          cx={cp.point.x}
                          cy={cp.point.y}
                          r={isSelectedPoint ? (isAnchor ? 8 / zoom : 6 / zoom) : (isAnchor ? 6 / zoom : 4 / zoom)}
                          fill={
                            isSelectedPoint ? '#f59e0b' : 
                            isRelatedToSelectedAnchor ? '#06b6d4' : 
                            isPrimaryPath ? (isAnchor ? '#6366f1' : '#10b981') : (isAnchor ? '#94a3b8' : '#cbd5e1')
                          }
                          stroke={
                            isSelectedPoint ? '#fbbf24' : 
                            isRelatedToSelectedAnchor ? '#22d3ee' : 
                            isPrimaryPath ? '#ffffff' : '#e2e8f0'
                          }
                          strokeWidth={isSelectedPoint || isRelatedToSelectedAnchor ? 3 / zoom : 2 / zoom}
                          className="cursor-pointer transition-all"
                          style={{
                            filter: isSelectedPoint ? 'drop-shadow(0 0 5px #f59e0b)' : 
                                    isRelatedToSelectedAnchor ? 'drop-shadow(0 0 4px #06b6d4)' : 
                                    'none',
                            opacity: isPrimaryPath ? 1 : 0.5,
                            cursor: isPrimaryPath ? 'pointer' : 'default',
                          }}
                          onMouseDown={(e) => isPrimaryPath && handleControlPointMouseDown(e, cp.segmentIndex, cp.pointIndex, idx)}
                        />
                      </g>
                    );
                  })}
                </g>
              )}
            </g>
          );
        })}
        
        {/* Visual connection lines between selected anchor points */}
        {editingPathId && selectedPointIndices.length >= 2 && svgDocument && (() => {
          const editedPath = svgDocument.paths.find(p => p.id === editingPathId);
          if (!editedPath) return null;
          
          const controlPoints = extractControlPoints(editedPath);
          const selectedAnchors = selectedPointIndices
            .map(idx => controlPoints[idx])
            .filter(cp => cp?.type === 'anchor')
            .sort((a, b) => {
              // Sort by segment index to show path order
              if (a.segmentIndex !== b.segmentIndex) return a.segmentIndex - b.segmentIndex;
              return a.pointIndex - b.pointIndex;
            });
          
          if (selectedAnchors.length < 2) return null;
          
          // Draw lines connecting consecutive selected anchors
          const lines = [];
          for (let i = 0; i < selectedAnchors.length - 1; i++) {
            const start = selectedAnchors[i].point;
            const end = selectedAnchors[i + 1].point;
            lines.push(
              <line
                key={`connection-${i}`}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke="#f59e0b"
                strokeWidth={3 / zoom}
                strokeDasharray="8,4"
                className="pointer-events-none"
                opacity={0.8}
              />
            );
          }
          return <g transform={editedPath.transform?.raw}>{lines}</g>;
        })()}
        
      </svg>

      {/* Marquee selection rectangle overlay (container-relative, extends beyond SVG viewBox) */}
      {marqueeStart && marqueeEnd && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${Math.min(marqueeStart.x, marqueeEnd.x)}px`,
            top: `${Math.min(marqueeStart.y, marqueeEnd.y)}px`,
            width: `${Math.abs(marqueeEnd.x - marqueeStart.x)}px`,
            height: `${Math.abs(marqueeEnd.y - marqueeStart.y)}px`,
            border: '2px dashed #6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            borderRadius: '2px',
            zIndex: 1000
          }}
        />
      )}

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 bg-bg-secondary px-3 py-2 rounded-lg text-sm">
        {Math.round(zoom * 100)}%
      </div>
      
      {/* Heatmap Legend */}
      {showHeatmap && (
        <div className="absolute top-4 right-4 bg-bg-secondary/95 backdrop-blur border border-border rounded-lg p-3 shadow-lg">
          <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
            <Flame size={16} strokeWidth={1.5} />
            <span>Complexity Heatmap</span>
          </h4>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }} />
              <span className="text-text-secondary">Optimal</span>
              <span className="ml-auto font-mono text-[10px]">&lt;1.5</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f59e0b' }} />
              <span className="text-text-secondary">Acceptable</span>
              <span className="ml-auto font-mono text-[10px]">1.5-3</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f97316' }} />
              <span className="text-text-secondary">Bloated</span>
              <span className="ml-auto font-mono text-[10px]">3-5</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }} />
              <span className="text-text-secondary">Disaster</span>
              <span className="ml-auto font-mono text-[10px]">&gt;5</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-border text-[10px] text-text-secondary">
            Point density per 100 units
          </div>
        </div>
      )}
    </div>
    
    {/* Hints - outside interactive container to prevent click interference */}
    {activeTool === 'edit' && editingPathId && (
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
                    setShowHints(false);
                    localStorage.setItem('showEditHints', 'false');
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
                setShowHints(true);
                localStorage.setItem('showEditHints', 'true');
              }}
              className="bg-bg-secondary/90 backdrop-blur px-3 py-2 rounded-lg hover:bg-bg-tertiary transition-colors shadow-lg"
              title={isTouchDevice ? 'Show touch hints' : 'Show hints (press i)'}
            >
              <Info size={16} className="text-text-secondary" />
            </button>
          )}
        </div>
      </div>
    )}
    </>
  );
};
