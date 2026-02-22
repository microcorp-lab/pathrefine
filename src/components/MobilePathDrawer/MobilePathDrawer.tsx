import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Trash2, Sparkles } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { autoHealPath } from '../../engine/pathMerging';
import { countAnchorPoints, analyzePath, getComplexityColor, getComplexityEmoji } from '../../engine/pathAnalysis';
import { toast } from 'sonner';

/**
 * Bottom drawer that slides up when a path is selected on mobile.
 * Shows path details, colour pickers, and quick-action buttons.
 * Dismissed by swipe-down or tapping the backdrop.
 */
export const MobilePathDrawer: React.FC = () => {
  const mobileDrawerOpen    = useEditorStore(s => s.mobileDrawerOpen);
  const mobileDrawerPathId  = useEditorStore(s => s.mobileDrawerPathId);
  const closeMobileDrawer   = useEditorStore(s => s.closeMobileDrawer);
  const svgDocument         = useEditorStore(s => s.svgDocument);
  const updatePath          = useEditorStore(s => s.updatePath);
  const deletePath          = useEditorStore(s => s.deletePath);
  const togglePathVisibility = useEditorStore(s => s.togglePathVisibility);

  const [visible, setVisible]     = useState(false);
  const [translateY, setTranslateY] = useState(100); // 0 = fully open, 100 = off-screen
  const [pendingDelete, setPendingDelete] = useState(false);

  const drawerRef      = useRef<HTMLDivElement>(null);
  const dragStartY     = useRef(0);
  const dragCurrentY   = useRef(0);
  const isDragging     = useRef(false);
  const drawerHeightPx = useRef(0);

  // Animate open/close
  useEffect(() => {
    if (mobileDrawerOpen) {
      setVisible(true);
      // Defer to next frame so the element is in DOM before animating
      requestAnimationFrame(() => requestAnimationFrame(() => setTranslateY(0)));
      setPendingDelete(false);
    } else {
      setTranslateY(100);
      // Remove from DOM after animation
      const t = setTimeout(() => setVisible(false), 320);
      return () => clearTimeout(t);
    }
  }, [mobileDrawerOpen]);

  const handleClose = useCallback(() => {
    closeMobileDrawer();
  }, [closeMobileDrawer]);

  // Swipe-down to dismiss
  const onHandleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current   = true;
    dragStartY.current   = e.touches[0].clientY;
    dragCurrentY.current = 0;
    drawerHeightPx.current = drawerRef.current?.offsetHeight ?? 300;
  }, []);

  const onHandleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy < 0) return; // Don't allow dragging up
    dragCurrentY.current = dy;
    const pct = (dy / drawerHeightPx.current) * 100;
    setTranslateY(pct);
  }, []);

  const onHandleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const h = drawerHeightPx.current || 300;
    // Dismiss if dragged past 30% of drawer height
    if (dragCurrentY.current > h * 0.3) {
      handleClose();
    } else {
      setTranslateY(0);
    }
  }, [handleClose]);

  const path = svgDocument?.paths.find(p => p.id === mobileDrawerPathId) ?? null;

  const analysis = path ? analyzePath(path) : null;
  const pointCount = path ? countAnchorPoints(path) : 0;
  const complexityColor = analysis ? getComplexityColor(analysis.complexity) : '#6b7280';
  const complexityEmoji = analysis ? getComplexityEmoji(analysis.complexity) : '';
  const score = analysis
    ? Math.round(100 - Math.min(100, (analysis.pointDensity / 50) * 100))
    : 0;

  const handleHeal = useCallback(() => {
    if (!path || !svgDocument) return;
    const before = countAnchorPoints(path);
    const healed = autoHealPath(path, 'medium');
    const after  = countAnchorPoints(healed);
    updatePath(path.id, healed, 'Smart Heal');
    const reduction = before > 0 ? Math.round(((before - after) / before) * 100) : 0;
    toast.success(`Healed ${path.id}`, {
      description: `${before} → ${after} pts (−${reduction}%)`,
    });
    handleClose();
  }, [path, svgDocument, updatePath, handleClose]);

  const handleDelete = useCallback(() => {
    if (!path) return;
    if (pendingDelete) {
      deletePath(path.id, 'Delete Path');
      handleClose();
    } else {
      setPendingDelete(true);
      setTimeout(() => setPendingDelete(false), 3000);
    }
  }, [path, pendingDelete, deletePath, handleClose]);

  const handleToggleVisibility = useCallback(() => {
    if (!path) return;
    togglePathVisibility(path.id);
  }, [path, togglePathVisibility]);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: `rgba(0,0,0,${0.4 * (1 - translateY / 100)})` }}
        onTouchEnd={handleClose}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed bottom-0 left-0 right-0 z-50 bg-bg-secondary rounded-t-2xl shadow-2xl border-t border-border"
        style={{
          transform: `translateY(${translateY}%)`,
          transition: isDragging.current ? 'none' : 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
          maxHeight: '60vh',
          overflowY: 'auto',
        }}
      >
        {/* Drag handle — swipe to dismiss */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
        >
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {!path ? (
          <div className="px-5 pb-6 text-text-secondary text-sm">Path not found</div>
        ) : (
          <div className="px-5 pb-8 space-y-5">
            {/* Header: ID + complexity badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: complexityColor }}
                />
                <span className="font-semibold text-base">{path.id}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span style={{ color: complexityColor }}>
                  {complexityEmoji} {analysis?.complexity ?? ''}
                </span>
                <span className="text-text-secondary">·</span>
                <span className="text-text-secondary">{pointCount} pts</span>
              </div>
            </div>

            {/* Health score bar */}
            <div>
              <div className="flex justify-between text-xs text-text-secondary mb-1">
                <span>Complexity score</span>
                <span style={{ color: complexityColor }}>{score}/100</span>
              </div>
              <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${score}%`, backgroundColor: complexityColor }}
                />
              </div>
            </div>

            {/* Colour pickers */}
            <div className="grid grid-cols-2 gap-3">
              {/* Fill */}
              <div className="space-y-1">
                <label className="text-xs text-text-secondary block">Fill</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={path.fill?.startsWith('#') ? path.fill : '#000000'}
                    onChange={e => updatePath(path.id, { ...path, fill: e.target.value }, 'Change fill')}
                    className="w-9 h-9 rounded-lg border border-border cursor-pointer"
                    style={{ padding: 2 }}
                  />
                  <span className="text-xs font-mono text-text-secondary truncate">
                    {path.fill && path.fill !== 'none' ? path.fill : 'none'}
                  </span>
                </div>
              </div>

              {/* Stroke */}
              <div className="space-y-1">
                <label className="text-xs text-text-secondary block">Stroke</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={path.stroke?.startsWith('#') ? path.stroke : '#000000'}
                    onChange={e => updatePath(path.id, { ...path, stroke: e.target.value }, 'Change stroke')}
                    className="w-9 h-9 rounded-lg border border-border cursor-pointer"
                    style={{ padding: 2 }}
                  />
                  <span className="text-xs font-mono text-text-secondary truncate">
                    {path.stroke && path.stroke !== 'none' ? path.stroke : 'none'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-3 gap-3">
              {/* Smart Heal */}
              <button
                onClick={handleHeal}
                className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white transition-colors min-h-[64px]"
              >
                <Sparkles size={20} strokeWidth={1.5} />
                <span className="text-xs font-medium">Heal</span>
              </button>

              {/* Hide / Show */}
              <button
                onClick={handleToggleVisibility}
                className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-bg-primary hover:bg-bg-tertiary text-text-secondary transition-colors min-h-[64px]"
              >
                {path.visible === false
                  ? <Eye size={20} strokeWidth={1.5} />
                  : <EyeOff size={20} strokeWidth={1.5} />
                }
                <span className="text-xs font-medium">{path.visible === false ? 'Show' : 'Hide'}</span>
              </button>

              {/* Delete */}
              <button
                onClick={handleDelete}
                className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-colors min-h-[64px] ${
                  pendingDelete
                    ? 'bg-red-700 ring-2 ring-red-400 text-white'
                    : 'bg-red-600/15 hover:bg-red-600 text-red-400 hover:text-white'
                }`}
              >
                <Trash2 size={20} strokeWidth={1.5} />
                <span className="text-xs font-medium">
                  {pendingDelete ? 'Confirm?' : 'Delete'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
