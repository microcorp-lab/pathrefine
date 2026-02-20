import React from 'react';
import type { RefObject } from 'react';
import type { Path, SVGDocument } from '../../types/svg';
import { extractControlPoints } from '../../engine/pathEditor';
import { analyzePath } from '../../engine/pathAnalysis';

interface CanvasRendererProps {
  svgDocument: SVGDocument;
  zoom: number;
  pan: { x: number; y: number };
  selectedPathIds: string[];
  editingPathId: string | null;
  selectedPointIndices: number[];
  activeTool: string;
  showHeatmap: boolean;
  historyIndex: number;
  pathAlignmentSelectionMode: string;
  isDraggingPoint: boolean;
  draggedPath: Path | null;
  svgRef: RefObject<SVGSVGElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  snapToGrid: boolean;
  gridSize: number;
  handlePathClick: (pathId: string, e: React.MouseEvent) => void;
  handleSegmentClick: (e: React.MouseEvent, pathId: string, segIdx: number) => void;
  handleControlPointMouseDown: (
    e: React.MouseEvent,
    segmentIndex: number,
    pointIndex: number,
    controlPointIndex: number,
  ) => void;
  setMarqueeStart: (v: { x: number; y: number } | null) => void;
  setMarqueeEnd: (v: { x: number; y: number } | null) => void;
}

/**
 * Renders the SVG canvas: viewBox border, all paths, heatmap overlays,
 * selection outlines, control points, and path-alignment highlights.
 */
export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  svgDocument,
  zoom,
  pan,
  selectedPathIds,
  editingPathId,
  selectedPointIndices,
  activeTool,
  showHeatmap,
  historyIndex,
  pathAlignmentSelectionMode,
  isDraggingPoint,
  draggedPath,
  svgRef,
  containerRef,
  gridSize,
  snapToGrid,
  handlePathClick,
  handleSegmentClick,
  handleControlPointMouseDown,
  setMarqueeStart,
  setMarqueeEnd,
}) => {
  const { viewBox } = svgDocument;
  const effectiveViewBox = viewBox || { x: 0, y: 0, width: svgDocument.width, height: svgDocument.height };
  const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;

  return (
    <>
      {/* Grid background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px)
          `,
          backgroundSize: `${gridSize}px ${gridSize}px`,
          transform: `translate(${pan.x % gridSize}px, ${pan.y % gridSize}px)`,
          opacity: snapToGrid ? 0.2 : 0.1,
          transition: 'opacity 0.2s',
        }}
      />

      {/* SVG canvas */}
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
        {/* ViewBox border */}
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

        {/* Paths */}
        {svgDocument.paths.map((storePath) => {
          const path =
            draggedPath && storePath.id === draggedPath.id && isDraggingPoint
              ? draggedPath
              : storePath;

          if (path.visible === false) return null;

          const isSelected = selectedPathIds.includes(path.id);

          // Heatmap color + opacity
          let heatmapColor: string | null = null;
          let heatmapOpacity = 0;
          let isDisaster = false;
          if (showHeatmap) {
            const density = analyzePath(path).pointDensity;
            if (density < 1.5) {
              heatmapColor = '#10b981'; heatmapOpacity = 0.2;
            } else if (density < 3) {
              heatmapColor = '#f59e0b'; heatmapOpacity = 0.4;
            } else if (density < 5) {
              heatmapColor = '#f97316'; heatmapOpacity = 0.6;
            } else {
              heatmapColor = '#ef4444'; heatmapOpacity = 0.8; isDisaster = true;
            }
          }

          // Path alignment highlights
          const sourcePathEl = document.querySelector('[data-source-path-id]');
          const targetPathEl = document.querySelector('[data-target-path-id]');
          const sourcePathId = sourcePathEl?.getAttribute('data-source-path-id');
          const targetPathId = targetPathEl?.getAttribute('data-target-path-id');
          const isSourcePath = sourcePathId === path.id && pathAlignmentSelectionMode !== 'none';
          const isTargetPath = targetPathId === path.id && pathAlignmentSelectionMode !== 'none';

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
                style={{ opacity: isSelected ? 0.8 : (path.opacity ?? 1) }}
                onClick={(e) => {
                  if (isDraggingPoint) { e.stopPropagation(); return; }
                  if (e.shiftKey && editingPathId) { e.stopPropagation(); return; }
                  handlePathClick(path.id, e);
                }}
                onMouseDown={(e) => {
                  if (activeTool === 'edit' && e.button === 0 && e.shiftKey && !e.altKey && editingPathId) {
                    e.stopPropagation();
                    if (containerRef.current) {
                      const rect = containerRef.current.getBoundingClientRect();
                      setMarqueeStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                      setMarqueeEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
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
                  strokeDasharray={isDisaster ? '8 4' : undefined}
                  transform={path.transform?.raw}
                  className={`pointer-events-none ${isDisaster ? 'animate-pulse-slow' : ''}`}
                  style={{ opacity: heatmapOpacity, mixBlendMode: 'multiply' }}
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
                  style={{ strokeDasharray: '5,5' }}
                />
              )}

              {/* Alignment: source path (green) */}
              {isSourcePath && (
                <path
                  d={path.d}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth={(path.strokeWidth || 0) + 4}
                  transform={path.transform?.raw}
                  className="pointer-events-none"
                  style={{ strokeDasharray: '8,4', opacity: 0.8 }}
                />
              )}

              {/* Alignment: target path (blue) */}
              {isTargetPath && (
                <path
                  d={path.d}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={(path.strokeWidth || 0) + 4}
                  transform={path.transform?.raw}
                  className="pointer-events-none"
                  style={{ strokeDasharray: '8,4', opacity: 0.8 }}
                />
              )}

              {/* Control points (edit mode, selected paths) */}
              {isSelected && activeTool === 'edit' && (
                <g transform={path.transform?.raw} key={`cp-${path.id}-${historyIndex}`}>
                  {/* Invisible wide path segments for Alt+click-to-add */}
                  {path.segments.map((segment, segIdx) => {
                    if (segment.type === 'M') return null;
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
                        key={`seg-hit-${segIdx}`}
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

                  {/* Control point dots + handle lines */}
                  {extractControlPoints(path).map((cp, idx) => {
                    const isAnchor = cp.type === 'anchor';
                    const isPrimaryPath = editingPathId === path.id;
                    const isSelectedPoint = isPrimaryPath && selectedPointIndices.includes(idx);
                    const controlPoints = extractControlPoints(path);
                    const isRelatedToSelectedAnchor =
                      isPrimaryPath &&
                      !isAnchor &&
                      selectedPointIndices.some((selIdx) => {
                        const selCP = controlPoints[selIdx];
                        if (!selCP || selCP.type !== 'anchor') return false;
                        return (
                          cp.segmentIndex === selCP.segmentIndex ||
                          (selCP.pointIndex === -1 && cp.segmentIndex === selCP.segmentIndex + 1) ||
                          (selCP.pointIndex === 0 && cp.segmentIndex === selCP.segmentIndex - 1)
                        );
                      });

                    const dotColor = isSelectedPoint
                      ? '#f59e0b'
                      : isRelatedToSelectedAnchor
                      ? '#06b6d4'
                      : isPrimaryPath
                      ? isAnchor ? '#6366f1' : '#10b981'
                      : isAnchor ? '#94a3b8' : '#cbd5e1';

                    const strokeColor = isSelectedPoint
                      ? '#fbbf24'
                      : isRelatedToSelectedAnchor
                      ? '#22d3ee'
                      : isPrimaryPath ? '#ffffff' : '#e2e8f0';

                    const radius = isSelectedPoint
                      ? (isAnchor ? 8 / zoom : 6 / zoom)
                      : (isAnchor ? 6 / zoom : 4 / zoom);

                    return (
                      <g key={`cp-${idx}`}>
                        {!isAnchor && cp.segmentIndex < path.segments.length && (
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
                        )}
                        <circle
                          cx={cp.point.x}
                          cy={cp.point.y}
                          r={radius}
                          fill={dotColor}
                          stroke={strokeColor}
                          strokeWidth={isSelectedPoint || isRelatedToSelectedAnchor ? 3 / zoom : 2 / zoom}
                          className="cursor-pointer transition-all"
                          style={{
                            filter: isSelectedPoint
                              ? 'drop-shadow(0 0 5px #f59e0b)'
                              : isRelatedToSelectedAnchor
                              ? 'drop-shadow(0 0 4px #06b6d4)'
                              : 'none',
                            opacity: isPrimaryPath ? 1 : 0.5,
                            cursor: isPrimaryPath ? 'pointer' : 'default',
                          }}
                          onMouseDown={(e) =>
                            isPrimaryPath &&
                            handleControlPointMouseDown(e, cp.segmentIndex, cp.pointIndex, idx)
                          }
                        />
                      </g>
                    );
                  })}
                </g>
              )}
            </g>
          );
        })}

        {/* Connection lines between consecutive selected anchors */}
        {editingPathId && selectedPointIndices.length >= 2 &&
          (() => {
            const editedPath = svgDocument.paths.find(p => p.id === editingPathId);
            if (!editedPath) return null;
            const controlPoints = extractControlPoints(editedPath);
            const selectedAnchors = selectedPointIndices
              .map(idx => controlPoints[idx])
              .filter(cp => cp?.type === 'anchor')
              .sort((a, b) =>
                a.segmentIndex !== b.segmentIndex
                  ? a.segmentIndex - b.segmentIndex
                  : a.pointIndex - b.pointIndex,
              );
            if (selectedAnchors.length < 2) return null;
            return (
              <g transform={editedPath.transform?.raw}>
                {selectedAnchors.slice(0, -1).map((anchor, i) => (
                  <line
                    key={`conn-${i}`}
                    x1={anchor.point.x}
                    y1={anchor.point.y}
                    x2={selectedAnchors[i + 1].point.x}
                    y2={selectedAnchors[i + 1].point.y}
                    stroke="#f59e0b"
                    strokeWidth={3 / zoom}
                    strokeDasharray="8,4"
                    className="pointer-events-none"
                    opacity={0.8}
                  />
                ))}
              </g>
            );
          })()}
      </svg>
    </>
  );
};
