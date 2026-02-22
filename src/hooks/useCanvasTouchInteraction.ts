import { RefObject, useEffect, useRef } from 'react';
import type { Path, SVGDocument } from '../types/svg';
import { updateControlPoint } from '../engine/pathEditor';
import { applyInverseTransform } from '../engine/transforms';

interface UseCanvasTouchInteractionOptions {
  containerRef:   RefObject<HTMLDivElement | null>;
  svgRef:         RefObject<SVGSVGElement | null>;
  zoom:           number;
  pan:            { x: number; y: number };
  setZoom:        (z: number) => void;
  setPan:         (x: number, y: number) => void;
  activeTool:     string;
  editingPathId:  string | null;
  svgDocument:    SVGDocument | null;
  updatePath:     (id: string, path: Path, label?: string) => void;
  selectPath:     (id: string) => void;
  setEditingPath: (id: string | null) => void;
  clearSelection: () => void;
  snapToGrid:     boolean;
  gridSize:       number;
  /** Called when a long-press is detected on a path */
  onLongPress:    (pathId: string, clientX: number, clientY: number) => void;
  /** Called when a path is tapped (touch-tap equivalent of click) */
  onPathTap:      (pathId: string) => void;
}

function getDistance(t: TouchList): number {
  const dx = t[0].clientX - t[1].clientX;
  const dy = t[0].clientY - t[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getCentroid(t: TouchList): { x: number; y: number } {
  return {
    x: (t[0].clientX + t[1].clientX) / 2,
    y: (t[0].clientY + t[1].clientY) / 2,
  };
}

/**
 * Unified touch interaction handler for the canvas.
 * Handles: 2-finger pan+zoom (toward centroid), single-finger tap
 * (path select), single-finger control-point drag, and long-press.
 *
 * Replaces `useCanvasTouchZoom` — do not use both.
 */
export function useCanvasTouchInteraction({
  containerRef,
  svgRef,
  zoom,
  pan,
  setZoom,
  setPan,
  activeTool,
  editingPathId,
  svgDocument,
  updatePath,
  selectPath,
  setEditingPath,
  clearSelection,
  snapToGrid,
  gridSize,
  onLongPress,
  onPathTap,
}: UseCanvasTouchInteractionOptions): void {
  // Keep mutable refs so the event listeners don't go stale
  const zoomRef            = useRef(zoom);
  const panRef             = useRef(pan);
  const activeToolRef      = useRef(activeTool);
  const editingPathIdRef   = useRef(editingPathId);
  const svgDocumentRef     = useRef(svgDocument);
  const snapToGridRef      = useRef(snapToGrid);
  const gridSizeRef        = useRef(gridSize);
  const onLongPressRef     = useRef(onLongPress);
  const onPathTapRef       = useRef(onPathTap);
  const selectPathRef      = useRef(selectPath);
  const setEditingPathRef  = useRef(setEditingPath);
  const clearSelectionRef  = useRef(clearSelection);
  const updatePathRef      = useRef(updatePath);

  // Sync refs on every render
  zoomRef.current           = zoom;
  panRef.current            = pan;
  activeToolRef.current     = activeTool;
  editingPathIdRef.current  = editingPathId;
  svgDocumentRef.current    = svgDocument;
  snapToGridRef.current     = snapToGrid;
  gridSizeRef.current       = gridSize;
  onLongPressRef.current    = onLongPress;
  onPathTapRef.current      = onPathTap;
  selectPathRef.current     = selectPath;
  setEditingPathRef.current = setEditingPath;
  clearSelectionRef.current = clearSelection;
  updatePathRef.current     = updatePath;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Per-gesture state ──────────────────────────────────────────────────
    let lastDist       = 0;
    let lastCentroid   = { x: 0, y: 0 };

    // Single-finger tap detection
    let tapStartTime   = 0;
    let tapStartX      = 0;
    let tapStartY      = 0;

    // Long-press timer
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let longPressX     = 0;
    let longPressY     = 0;
    let longPressFired = false;

    // Control-point drag state
    let draggingCPInfo: { segmentIndex: number; pointIndex: number } | null = null;
    let dragPathId: string | null = null;

    function cancelLongPress() {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      longPressFired = false;
    }

    /** Resolve a screen point → SVG-local coordinate, with optional snap */
    function screenToSVG(clientX: number, clientY: number, snap = false): { x: number; y: number } {
      const svg = svgRef.current;
      const doc = svgDocumentRef.current;
      if (!svg || !doc) return { x: 0, y: 0 };
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const inv = svg.getScreenCTM()?.inverse();
      if (!inv) return { x: 0, y: 0 };
      const svgP = pt.matrixTransform(inv);
      let { x, y } = svgP;
      if (snap && snapToGridRef.current) {
        const g = gridSizeRef.current;
        x = Math.round(x / g) * g;
        y = Math.round(y / g) * g;
      }
      return { x, y };
    }

    /** Find the data-path-id of the element under a screen point */
    function pathIdAtPoint(clientX: number, clientY: number): string | null {
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return null;
      const pathEl = el.closest('[data-path-id]') as HTMLElement | null;
      return pathEl?.dataset.pathId ?? null;
    }

    /** Find a control-point circle under a screen point */
    function controlPointAtPoint(clientX: number, clientY: number): {
      segmentIndex: number;
      pointIndex: number;
    } | null {
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return null;
      const cpEl = el.closest('[data-cp-segment]') as SVGElement | HTMLElement | null;
      if (!cpEl) return null;
      const seg  = parseInt((cpEl as HTMLElement).dataset.cpSegment ?? '-1', 10);
      const pt   = parseInt((cpEl as HTMLElement).dataset.cpPoint   ?? '-1', 10);
      if (seg < 0 || pt < 0) return null;
      return { segmentIndex: seg, pointIndex: pt };
    }

    // ── touchstart ──────────────────────────────────────────────────────────
    function handleTouchStart(e: TouchEvent) {
      const touches = e.touches;

      if (touches.length === 2) {
        // Two-finger gesture: cancel any single-finger state first
        cancelLongPress();
        e.preventDefault();
        lastDist     = getDistance(touches);
        lastCentroid = getCentroid(touches);
        draggingCPInfo = null;
        return;
      }

      if (touches.length === 1) {
        const t = touches[0];
        tapStartTime = Date.now();
        tapStartX    = t.clientX;
        tapStartY    = t.clientY;

        // Check if starting drag on a control point (tablet/edit mode)
        if (activeToolRef.current === 'edit' && editingPathIdRef.current) {
          const cp = controlPointAtPoint(t.clientX, t.clientY);
          if (cp) {
            e.preventDefault();
            draggingCPInfo = cp;
            dragPathId     = editingPathIdRef.current;
            cancelLongPress();
            return;
          }
        }

        draggingCPInfo = null;
        dragPathId     = null;

        // Arm long-press
        longPressX     = t.clientX;
        longPressY     = t.clientY;
        longPressFired = false;
        longPressTimer = setTimeout(() => {
          longPressFired = true;
          longPressTimer = null;
          const pathId = pathIdAtPoint(longPressX, longPressY);
          if (pathId) {
            onLongPressRef.current(pathId, longPressX, longPressY);
          }
        }, 500);
      }
    }

    // ── touchmove ──────────────────────────────────────────────────────────
    function handleTouchMove(e: TouchEvent) {
      const touches = e.touches;

      if (touches.length === 2) {
        e.preventDefault();
        cancelLongPress();

        const newDist     = getDistance(touches);
        const newCentroid = getCentroid(touches);

        const oldZoom = zoomRef.current;
        const newZoom = Math.max(0.1, Math.min(10, oldZoom * (newDist / lastDist)));

        // Pan: keep centroid invariant + track centroid translation
        const oldPan  = panRef.current;
        const scale   = newZoom / oldZoom;
        // newPan = newCentroid - (lastCentroid - oldPan) * scale
        const finalPanX = newCentroid.x - (lastCentroid.x - oldPan.x) * scale;
        const finalPanY = newCentroid.y - (lastCentroid.y - oldPan.y) * scale;

        setZoom(newZoom);
        setPan(finalPanX, finalPanY);

        lastDist     = newDist;
        lastCentroid = newCentroid;
        return;
      }

      if (touches.length === 1) {
        const t = touches[0];
        const dx = t.clientX - tapStartX;
        const dy = t.clientY - tapStartY;
        const moved = Math.sqrt(dx * dx + dy * dy);

        // Cancel long press if moved
        if (moved > 8) cancelLongPress();

        // Control-point drag
        if (draggingCPInfo && dragPathId) {
          e.preventDefault();
          const doc = svgDocumentRef.current;
          if (!doc) return;
          const path = doc.paths.find(p => p.id === dragPathId);
          if (!path) return;
          const svgPos   = screenToSVG(t.clientX, t.clientY, true);
          const localPos = applyInverseTransform(svgPos, path.transform?.raw);
          const updated  = updateControlPoint(
            path,
            draggingCPInfo.segmentIndex,
            draggingCPInfo.pointIndex,
            localPos,
          );
          updatePathRef.current(dragPathId, updated, 'Move control point');
          return;
        }
      }
    }

    // ── touchend ───────────────────────────────────────────────────────────
    function handleTouchEnd(e: TouchEvent) {
      cancelLongPress();

      if (e.changedTouches.length === 1 && !draggingCPInfo) {
        const t        = e.changedTouches[0];
        const duration = Date.now() - tapStartTime;
        const dx       = t.clientX - tapStartX;
        const dy       = t.clientY - tapStartY;
        const moved    = Math.sqrt(dx * dx + dy * dy);

        // Only treat as tap if fast and not moved
        if (duration < 150 && moved < 8 && !longPressFired) {
          const pathId = pathIdAtPoint(t.clientX, t.clientY);
          if (pathId) {
            e.preventDefault();
            selectPathRef.current(pathId);
            setEditingPathRef.current(pathId);
            onPathTapRef.current(pathId);
          } else {
            // Tapped empty canvas — deselect
            clearSelectionRef.current();
            setEditingPathRef.current(null);
          }
        }
      }

      draggingCPInfo = null;
      dragPathId     = null;
    }

    function handleTouchCancel() {
      cancelLongPress();
      draggingCPInfo = null;
      dragPathId     = null;
    }

    container.addEventListener('touchstart',  handleTouchStart,  { passive: false });
    container.addEventListener('touchmove',   handleTouchMove,   { passive: false });
    container.addEventListener('touchend',    handleTouchEnd,    { passive: false });
    container.addEventListener('touchcancel', handleTouchCancel, { passive: true  });

    return () => {
      cancelLongPress();
      container.removeEventListener('touchstart',  handleTouchStart);
      container.removeEventListener('touchmove',   handleTouchMove);
      container.removeEventListener('touchend',    handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchCancel);
    };
    // Only re-attach when the container ref itself changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef.current]);
}
