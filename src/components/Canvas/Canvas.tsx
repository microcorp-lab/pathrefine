import React, { useState, useEffect, useRef } from 'react';
import { Flame } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import { useCanvasKeyboard } from '../../hooks/useCanvasKeyboard';
import { useCanvasTouchZoom } from '../../hooks/useCanvasTouchZoom';
import { CanvasEmptyState } from './CanvasEmptyState';
import { CanvasHints } from './CanvasHints';
import { CanvasRenderer } from './CanvasRenderer';

export const Canvas: React.FC = () => {
  const svgDocument          = useEditorStore(s => s.svgDocument);
  const selectedPathIds      = useEditorStore(s => s.selectedPathIds);
  const zoom                 = useEditorStore(s => s.zoom);
  const pan                  = useEditorStore(s => s.pan);
  const activeTool           = useEditorStore(s => s.activeTool);
  const editingPathId        = useEditorStore(s => s.editingPathId);
  const selectedPointIndices = useEditorStore(s => s.selectedPointIndices);
  const snapToGrid           = useEditorStore(s => s.snapToGrid);
  const gridSize             = useEditorStore(s => s.gridSize);
  const marqueeStart         = useEditorStore(s => s.marqueeStart);
  const marqueeEnd           = useEditorStore(s => s.marqueeEnd);
  const showHeatmap          = useEditorStore(s => s.showHeatmap);
  const historyIndex         = useEditorStore(s => s.historyIndex);
  const pathAlignmentSelectionMode = useEditorStore(s => s.pathAlignmentSelectionMode);
  const setZoom              = useEditorStore(s => s.setZoom);
  const setPan               = useEditorStore(s => s.setPan);
  const updatePath           = useEditorStore(s => s.updatePath);
  const clearPointSelection  = useEditorStore(s => s.clearPointSelection);
  const setMarqueeStart      = useEditorStore(s => s.setMarqueeStart);
  const setMarqueeEnd        = useEditorStore(s => s.setMarqueeEnd);

  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isTouchDevice] = useState(() => 'ontouchstart' in window || navigator.maxTouchPoints > 0);
  const [showHints, setShowHints] = useState(() => {
    const saved = localStorage.getItem('showEditHints');
    if (saved !== null) return saved === 'true';
    return window.innerWidth >= 768 && !('ontouchstart' in window);
  });

  const svgRef       = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    isPanning, setIsPanning, isDraggingPoint, draggedPath,
    handleMouseDown, handleMouseMove, handleMouseUp, handleWheel,
    handlePathClick, handleSegmentClick, handleControlPointMouseDown,
  } = useCanvasInteraction({ svgRef, containerRef, isSpacePressed });

  useCanvasKeyboard({
    isSpacePressed, setIsSpacePressed, setIsPanning,
    marqueeStart, setMarqueeStart, setMarqueeEnd,
    activeTool, editingPathId, selectedPointIndices,
    svgDocument, updatePath, clearPointSelection, setShowHints,
    zoom, setZoom, setPan,
  });

  useCanvasTouchZoom({ containerRef, zoom, setZoom });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || (!e.shiftKey && !e.altKey)) {
        e.preventDefault();
        e.stopPropagation();
      }
      handleWheel(e);
    };
    container.addEventListener('wheel', handler, { passive: false, capture: true });
    return () => container.removeEventListener('wheel', handler, { capture: true });
  }, [handleWheel]);

  if (!svgDocument) return <CanvasEmptyState />;

  return (
    <>
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-bg-primary"
        style={{ cursor: isPanning ? 'grabbing' : isSpacePressed ? 'grab' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <CanvasRenderer
          svgDocument={svgDocument} zoom={zoom} pan={pan}
          selectedPathIds={selectedPathIds} editingPathId={editingPathId}
          selectedPointIndices={selectedPointIndices} activeTool={activeTool}
          showHeatmap={showHeatmap} historyIndex={historyIndex}
          pathAlignmentSelectionMode={pathAlignmentSelectionMode}
          isDraggingPoint={isDraggingPoint} draggedPath={draggedPath}
          svgRef={svgRef} containerRef={containerRef}
          snapToGrid={snapToGrid} gridSize={gridSize}
          handlePathClick={handlePathClick} handleSegmentClick={handleSegmentClick}
          handleControlPointMouseDown={handleControlPointMouseDown}
          setMarqueeStart={setMarqueeStart} setMarqueeEnd={setMarqueeEnd}
        />

        {marqueeStart && marqueeEnd && (
          <div
            className="absolute pointer-events-none"
            style={{
              left:   `${Math.min(marqueeStart.x, marqueeEnd.x)}px`,
              top:    `${Math.min(marqueeStart.y, marqueeEnd.y)}px`,
              width:  `${Math.abs(marqueeEnd.x - marqueeStart.x)}px`,
              height: `${Math.abs(marqueeEnd.y - marqueeStart.y)}px`,
              border: '2px dashed #6366f1',
              backgroundColor: 'rgba(99,102,241,0.1)',
              borderRadius: '2px',
              zIndex: 1000,
            }}
          />
        )}

        <div className="absolute bottom-4 right-4 bg-bg-secondary px-3 py-2 rounded-lg text-sm select-none pointer-events-none">
          {Math.round(zoom * 100)}%
        </div>

        {showHeatmap && (
          <div className="absolute top-4 right-4 bg-bg-secondary/95 backdrop-blur border border-border rounded-lg p-3 shadow-lg">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
              <Flame size={16} strokeWidth={1.5} />
              <span>Complexity Heatmap</span>
            </h4>
            <div className="space-y-1.5">
              {([ 
                { color: '#10b981', label: 'Optimal',    range: '<1.5',  pulse: false },
                { color: '#f59e0b', label: 'Acceptable', range: '1.5-3', pulse: false },
                { color: '#f97316', label: 'Bloated',    range: '3-5',   pulse: false },
                { color: '#ef4444', label: 'Disaster',   range: '>5',    pulse: true  },
              ] as { color: string; label: string; range: string; pulse: boolean }[]).map(({ color, label, range, pulse }) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <div
                    className={`w-4 h-4 rounded${pulse ? ' animate-pulse-slow' : ''}`}
                    style={{
                      backgroundColor: color,
                      ...(pulse ? {
                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px)',
                      } : {}),
                    }}
                  />
                  <span className="text-text-secondary">{label}</span>
                  <span className="ml-auto font-mono text-[10px]">{range}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-border text-[10px] text-text-secondary">
              Point density per 100 units
              <div className="mt-1 opacity-70">Dashed paths pulse slowly</div>
            </div>
          </div>
        )}
      </div>

      {activeTool === 'edit' && editingPathId && (
        <CanvasHints
          showHints={showHints}
          isTouchDevice={isTouchDevice}
          onShow={() => { setShowHints(true); localStorage.setItem('showEditHints', 'true'); }}
          onHide={() => { setShowHints(false); localStorage.setItem('showEditHints', 'false'); }}
        />
      )}
    </>
  );
};
