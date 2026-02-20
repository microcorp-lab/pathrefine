import { useEffect } from 'react';
import type { SVGDocument } from '../types/svg';
import { extractControlPoints, removePoint } from '../engine/pathEditor';
import { shouldIgnoreKeyboardShortcut } from '../utils/keyboard';
import { toast } from 'sonner';

interface UseCanvasKeyboardOptions {
  // Panning state
  isSpacePressed: boolean;
  setIsSpacePressed: (v: boolean) => void;
  setIsPanning: (v: boolean) => void;

  // Marquee
  marqueeStart: { x: number; y: number } | null;
  setMarqueeStart: (v: null) => void;
  setMarqueeEnd: (v: null) => void;

  // Edit mode
  activeTool: string;
  editingPathId: string | null;
  selectedPointIndices: number[];
  svgDocument: SVGDocument | null;
  updatePath: (id: string, path: any, label?: string) => void;
  clearPointSelection: () => void;

  // Hints
  setShowHints: (fn: (prev: boolean) => boolean) => void;

  // Zoom
  zoom: number;
  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
}

/**
 * All keyboard event listeners for the canvas.
 * Handles: Space (pan), Delete (remove points), Zoom (+/-/0), 'i' (hints toggle).
 */
export function useCanvasKeyboard({
  isSpacePressed,
  setIsSpacePressed,
  setIsPanning,
  marqueeStart,
  setMarqueeStart,
  setMarqueeEnd,
  activeTool,
  editingPathId,
  selectedPointIndices,
  svgDocument,
  updatePath,
  clearPointSelection,
  setShowHints,
  zoom,
  setZoom,
  setPan,
}: UseCanvasKeyboardOptions): void {

  // ── Space key (pan mode) ────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressed) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isSpacePressed, setIsSpacePressed, setIsPanning]);

  // ── Shift release: cancel marquee ───────────────────────────────────────
  useEffect(() => {
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && marqueeStart !== null) {
        setMarqueeStart(null);
        setMarqueeEnd(null);
      }
    };
    window.addEventListener('keyup', onKeyUp);
    return () => window.removeEventListener('keyup', onKeyUp);
  }, [marqueeStart, setMarqueeStart, setMarqueeEnd]);

  // ── Delete / Backspace: remove selected anchor points ──────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey) {
        if (editingPathId && selectedPointIndices.length > 0 && svgDocument) {
          e.preventDefault();
          const path = svgDocument.paths.find(p => p.id === editingPathId);
          if (path) {
            const controlPoints = extractControlPoints(path);
            const segmentIndicesToRemove = selectedPointIndices
              .map(cpIdx => controlPoints[cpIdx])
              .filter(cp => cp?.type === 'anchor')
              .map(cp => cp.segmentIndex)
              .filter((idx, i, arr) => arr.indexOf(idx) === i)
              .sort((a, b) => b - a);

            if (segmentIndicesToRemove.length === 0) {
              toast.info('Select an anchor point (blue dot) to delete');
              return;
            }

            let updatedPath = path;
            for (const segIdx of segmentIndicesToRemove) {
              updatedPath = removePoint(updatedPath, segIdx);
            }
            updatePath(editingPathId, updatedPath, 'Delete points');
            clearPointSelection();
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingPathId, selectedPointIndices, svgDocument, updatePath, clearPointSelection]);

  // ── Keyboard zoom (+/-/0) ───────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreKeyboardShortcut(e, true)) return;

      if ((e.key === '+' || e.key === '=') && !e.shiftKey) {
        e.preventDefault();
        setZoom(zoom * 1.2);
      } else if ((e.key === '-' || e.key === '_') && !e.shiftKey) {
        e.preventDefault();
        setZoom(zoom * 0.8);
      } else if (e.key === '0' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setZoom(1);
        setPan(0, 0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoom, setZoom, setPan]);

  // ── 'i' key: toggle hints ───────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'i' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (activeTool === 'edit' && editingPathId) {
          e.preventDefault();
          setShowHints(prev => {
            const next = !prev;
            localStorage.setItem('showEditHints', String(next));
            return next;
          });
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTool, editingPathId, setShowHints]);
}
