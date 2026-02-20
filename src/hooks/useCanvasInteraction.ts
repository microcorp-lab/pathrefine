import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { Point, Path } from '../types/svg';
import { extractControlPoints, updateControlPoint, addPointToSegment, findClosestPointOnSegment } from '../engine/pathEditor';
import { applyInverseTransform, applyTransform } from '../engine/transforms';
import { useEditorStore } from '../store/editorStore';

interface UseCanvasInteractionOptions {
  svgRef: RefObject<SVGSVGElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  isSpacePressed: boolean;
}

interface UseCanvasInteractionReturn {
  // State
  isPanning: boolean;
  setIsPanning: (v: boolean) => void;
  isDraggingPoint: boolean;
  draggedPath: Path | null;

  // Handlers
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  handleWheel: (e: WheelEvent) => void;
  handlePathClick: (pathId: string, e: React.MouseEvent) => void;
  handleSegmentClick: (e: React.MouseEvent, pathId: string, segmentIndex: number) => void;
  handleControlPointMouseDown: (
    e: React.MouseEvent,
    segmentIndex: number,
    pointIndex: number,
    controlPointIndex: number
  ) => void;
  screenToSVG: (screenX: number, screenY: number, applySnap?: boolean) => Point;
}

/**
 * Encapsulates all mouse/wheel interaction state-machine logic for the Canvas.
 * Reads relevant state from editorStore directly — callers don't need to plumb
 * every store value into this hook.
 */
export function useCanvasInteraction({
  svgRef,
  containerRef,
  isSpacePressed,
}: UseCanvasInteractionOptions): UseCanvasInteractionReturn {
  const svgDocument          = useEditorStore(s => s.svgDocument);
  const activeTool           = useEditorStore(s => s.activeTool);
  const editingPathId        = useEditorStore(s => s.editingPathId);
  const zoom                 = useEditorStore(s => s.zoom);
  const pan                  = useEditorStore(s => s.pan);
  const snapToGrid           = useEditorStore(s => s.snapToGrid);
  const gridSize             = useEditorStore(s => s.gridSize);
  const marqueeStart         = useEditorStore(s => s.marqueeStart);
  const marqueeEnd           = useEditorStore(s => s.marqueeEnd);
  const historyIndex         = useEditorStore(s => s.historyIndex);
  const pathAlignmentSelectionMode = useEditorStore(s => s.pathAlignmentSelectionMode);

  const setZoom              = useEditorStore(s => s.setZoom);
  const setPan               = useEditorStore(s => s.setPan);
  const setEditingPath       = useEditorStore(s => s.setEditingPath);
  const setSelectedPoint     = useEditorStore(s => s.setSelectedPoint);
  const togglePointSelection = useEditorStore(s => s.togglePointSelection);
  const clearPointSelection  = useEditorStore(s => s.clearPointSelection);
  const clearSelection       = useEditorStore(s => s.clearSelection);
  const togglePathSelection  = useEditorStore(s => s.togglePathSelection);
  const selectPath           = useEditorStore(s => s.selectPath);
  const updatePath           = useEditorStore(s => s.updatePath);
  const setMarqueeStart      = useEditorStore(s => s.setMarqueeStart);
  const setMarqueeEnd        = useEditorStore(s => s.setMarqueeEnd);

  const [isPanning, setIsPanning]           = useState(false);
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);
  const [draggedPath, setDraggedPath]       = useState<Path | null>(null);
  const [lastMousePos, setLastMousePos]     = useState<Point>({ x: 0, y: 0 });
  const [draggedPointInfo, setDraggedPointInfo] = useState<{
    segmentIndex: number;
    pointIndex: number;
  } | null>(null);

  // Clear draggedPath on undo/redo
  useEffect(() => { setDraggedPath(null); }, [historyIndex]);

  // ── Utility: screen → SVG coordinates ──────────────────────────────────
  const screenToSVG = useCallback((
    screenX: number,
    screenY: number,
    applySnap = true,
  ): Point => {
    if (!svgRef.current || !svgDocument) return { x: 0, y: 0 };
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = screenX;
    pt.y = screenY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    let { x, y } = svgP;
    if (applySnap && snapToGrid) {
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    }
    return { x, y };
  }, [svgRef, svgDocument, snapToGrid, gridSize]);

  // ── Wheel: zoom ─────────────────────────────────────────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey || (!e.shiftKey && !e.altKey)) {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(zoom * delta);
    }
  }, [zoom, setZoom]);

  // ── Mouse down ──────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.button === 0 && isSpacePressed) || e.button === 1) {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    } else if (e.button === 0 && activeTool === 'edit' && e.shiftKey && !e.altKey && editingPathId) {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        setMarqueeStart(pos);
        setMarqueeEnd(pos);
      }
    } else if (e.button === 0 && activeTool === 'edit' && !e.shiftKey && !e.altKey && !isSpacePressed) {
      clearSelection();
      setEditingPath(null);
    }
  }, [activeTool, isSpacePressed, editingPathId, containerRef, setMarqueeStart, setMarqueeEnd, clearSelection, setEditingPath]);

  // ── Control point drag ──────────────────────────────────────────────────
  const handleControlPointDrag = useCallback((e: React.MouseEvent) => {
    if (isDraggingPoint && draggedPointInfo && editingPathId && svgDocument) {
      const svgPos = screenToSVG(e.clientX, e.clientY);
      const sourcePath = draggedPath || svgDocument.paths.find(p => p.id === editingPathId);
      if (sourcePath) {
        const localPos = applyInverseTransform(svgPos, sourcePath.transform?.raw);
        const updated = updateControlPoint(
          sourcePath,
          draggedPointInfo.segmentIndex,
          draggedPointInfo.pointIndex,
          localPos,
        );
        setDraggedPath(updated);
      }
    }
  }, [isDraggingPoint, draggedPointInfo, editingPathId, svgDocument, draggedPath, screenToSVG]);

  // ── Mouse move ──────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setPan(pan.x + dx, pan.y + dy);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else if (isDraggingPoint) {
      handleControlPointDrag(e);
    } else if (marqueeStart) {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMarqueeEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    }
  }, [isPanning, isDraggingPoint, marqueeStart, lastMousePos, pan, setPan, handleControlPointDrag, containerRef, setMarqueeEnd]);

  // ── Control point mouse up ──────────────────────────────────────────────
  const handleControlPointMouseUp = useCallback(() => {
    setIsDraggingPoint(false);
    setDraggedPointInfo(null);
    if (draggedPath && editingPathId) {
      updatePath(editingPathId, draggedPath, 'Move control point');
    }
    setDraggedPath(null);
  }, [draggedPath, editingPathId, updatePath]);

  // ── Mouse up ────────────────────────────────────────────────────────────
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    handleControlPointMouseUp();

    if (marqueeStart && marqueeEnd && editingPathId && svgDocument && containerRef.current) {
      const dragDistance = Math.sqrt(
        Math.pow(marqueeEnd.x - marqueeStart.x, 2) +
        Math.pow(marqueeEnd.y - marqueeStart.y, 2),
      );
      if (dragDistance > 5) {
        const path = svgDocument.paths.find(p => p.id === editingPathId);
        if (path) {
          const rect = containerRef.current.getBoundingClientRect();
          const startSvg = screenToSVG(marqueeStart.x + rect.left, marqueeStart.y + rect.top, false);
          const endSvg   = screenToSVG(marqueeEnd.x   + rect.left, marqueeEnd.y   + rect.top, false);
          const minX = Math.min(startSvg.x, endSvg.x);
          const maxX = Math.max(startSvg.x, endSvg.x);
          const minY = Math.min(startSvg.y, endSvg.y);
          const maxY = Math.max(startSvg.y, endSvg.y);

          const controlPoints = extractControlPoints(path);
          const selectedIndices: number[] = [];
          controlPoints.forEach((cp, i) => {
            const worldPoint = applyTransform(cp.point, path.transform?.raw);
            if (worldPoint.x >= minX && worldPoint.x <= maxX &&
                worldPoint.y >= minY && worldPoint.y <= maxY) {
              selectedIndices.push(i);
            }
          });
          clearPointSelection();
          selectedIndices.forEach(i => togglePointSelection(i));
        }
      }
      setMarqueeStart(null);
      setMarqueeEnd(null);
    }
  }, [
    handleControlPointMouseUp, marqueeStart, marqueeEnd, editingPathId, svgDocument,
    containerRef, screenToSVG, clearPointSelection, togglePointSelection,
    setMarqueeStart, setMarqueeEnd,
  ]);

  // ── Path click ──────────────────────────────────────────────────────────
  const handlePathClick = useCallback((pathId: string, e: React.MouseEvent) => {
    if (pathAlignmentSelectionMode !== 'none') {
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('pathAlignmentPathSelected', {
        detail: { pathId, mode: pathAlignmentSelectionMode },
      }));
      return;
    }
    if (activeTool === 'edit' && !isSpacePressed && !e.altKey) {
      e.stopPropagation();
      if (e.shiftKey) {
        togglePathSelection(pathId);
        setEditingPath(pathId);
      } else {
        selectPath(pathId);
        setEditingPath(pathId);
      }
    }
  }, [activeTool, isSpacePressed, selectPath, togglePathSelection, setEditingPath, pathAlignmentSelectionMode]);

  // ── Segment click: add point (Alt+click) ────────────────────────────────
  const handleSegmentClick = useCallback((
    e: React.MouseEvent,
    pathId: string,
    segmentIndex: number,
  ) => {
    if (activeTool === 'edit' && e.altKey && svgDocument) {
      e.preventDefault();
      e.stopPropagation();
      const path = svgDocument.paths.find(p => p.id === pathId);
      if (path) {
        const svgPos = screenToSVG(e.clientX, e.clientY);
        const localPos = applyInverseTransform(svgPos, path.transform?.raw);
        const segment = path.segments[segmentIndex];
        const { t } = findClosestPointOnSegment(segment, localPos);
        const updatedPath = addPointToSegment(path, segmentIndex, t);
        updatePath(pathId, updatedPath);
        setEditingPath(null);
        setTimeout(() => setEditingPath(pathId), 0);
      }
    }
  }, [activeTool, svgDocument, screenToSVG, updatePath, setEditingPath]);

  // ── Control point mouse down ─────────────────────────────────────────────
  const handleControlPointMouseDown = useCallback((
    e: React.MouseEvent,
    segmentIndex: number,
    pointIndex: number,
    controlPointIndex: number,
  ) => {
    e.stopPropagation();
    if (activeTool !== 'edit') return;
    if (e.shiftKey) return;
    if (e.altKey) {
      togglePointSelection(controlPointIndex);
      return;
    }
    setSelectedPoint(controlPointIndex);
    setIsDraggingPoint(true);
    setDraggedPointInfo({ segmentIndex, pointIndex });
  }, [activeTool, togglePointSelection, setSelectedPoint]);

  return {
    isPanning,
    setIsPanning,
    isDraggingPoint,
    draggedPath,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handlePathClick,
    handleSegmentClick,
    handleControlPointMouseDown,
    screenToSVG,
  };
}
