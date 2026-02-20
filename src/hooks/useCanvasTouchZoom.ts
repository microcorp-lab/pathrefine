import { RefObject, useEffect } from 'react';

interface UseCanvasTouchZoomOptions {
  containerRef: RefObject<HTMLElement | null>;
  zoom: number;
  setZoom: (z: number) => void;
}

/**
 * Attaches touch-pinch-to-zoom listeners to the canvas container.
 * Completely self-contained — returns nothing.
 */
export function useCanvasTouchZoom({
  containerRef,
  zoom,
  setZoom,
}: UseCanvasTouchZoomOptions): void {
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
  }, [containerRef, zoom, setZoom]);
}
