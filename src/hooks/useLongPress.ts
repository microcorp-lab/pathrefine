import { useCallback, useRef } from 'react';

interface LongPressOptions {
  /** How long the pointer must be held before firing (ms). Default: 500 */
  delay?: number;
  /** Max movement (px) before the press is cancelled. Default: 8 */
  moveThreshold?: number;
  /** Called when the long-press threshold is reached */
  onLongPress: (e: PointerEvent) => void;
  /** Called when the press is cancelled (moved/lifted before threshold) */
  onCancel?: () => void;
}

interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
}

/**
 * Returns pointer-event handlers that detect a long-press gesture.
 * Spread the returned handlers onto any interactive element.
 *
 * Cancels automatically if the pointer moves more than `moveThreshold` px.
 */
export function useLongPress({
  delay = 500,
  moveThreshold = 8,
  onLongPress,
  onCancel,
}: LongPressOptions): LongPressHandlers {
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef   = useRef<{ x: number; y: number } | null>(null);
  const firedRef   = useRef(false);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
    if (!firedRef.current) onCancel?.();
    firedRef.current = false;
  }, [onCancel]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only respond to touch / stylus; mouse users use context-menu
    if (e.pointerType === 'mouse') return;
    firedRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };

    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      timerRef.current = null;
      startRef.current = null;
      onLongPress(e.nativeEvent);
    }, delay);
  }, [delay, onLongPress]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!startRef.current || !timerRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > moveThreshold) {
      cancel();
    }
  }, [cancel, moveThreshold]);

  const onPointerUp     = useCallback(() => cancel(), [cancel]);
  const onPointerCancel = useCallback(() => cancel(), [cancel]);

  return { onPointerDown, onPointerUp, onPointerMove, onPointerCancel };
}
