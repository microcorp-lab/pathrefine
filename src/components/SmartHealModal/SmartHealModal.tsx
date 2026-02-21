import React, { useState, useMemo, useCallback, useEffect, useRef, useContext } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { ProFeaturesContext } from '../../context/ProFeaturesContext';
import { healPathMultiple } from '../../engine/smartHeal';
import { autoHealPath, INTENSITY_PRESETS, type IntensityLevel } from '../../engine/pathMerging';
import { countAnchorPoints } from '../../engine/pathAnalysis';
import { Flame } from 'lucide-react';
import { Modal } from '../Modal/Modal';
import type { Point, BezierSegment, Path, SVGDocument } from '../../types/svg';

interface SmartHealModalProps {
  onClose: () => void;
  onApply: (results: Array<{ path: Path; originalPathId: string }>) => void;
}

interface PointAnalysis {
  index: number;
  segmentIndex: number;
  point: Point;
  importance: number;
  reason: string;
}

/**
 * Calculate the importance score of a point (0-1, where 1 is most important)
 */
/** Build a flat SVG string for a multi-path document, highlighting selected paths */
function buildBatchPreviewSVG(doc: SVGDocument, selectedIds: string[]): string {
  const viewBox = doc.viewBox
    ? `${doc.viewBox.x} ${doc.viewBox.y} ${doc.viewBox.width} ${doc.viewBox.height}`
    : `0 0 ${doc.width || 24} ${doc.height || 24}`;
  const paths = doc.paths.map((p: Path) => {
    const opacity = selectedIds.includes(p.id) ? 1 : 0.25;
    const t = p.transform?.raw ? ` transform="${p.transform.raw}"` : '';
    return `<path d="${p.d}" fill="${p.fill || 'none'}" stroke="${p.stroke || 'none'}" stroke-width="${p.strokeWidth || 1}" opacity="${opacity}"${t}/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${paths.join('')}</svg>`;
}

function calculatePointImportance(
  prev: Point,
  current: Point,
  next: Point
): { score: number; reason: string } {
  const v1 = { x: current.x - prev.x, y: current.y - prev.y };
  const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  
  const v2 = { x: next.x - current.x, y: next.y - current.y };
  const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  if (len1 === 0 || len2 === 0) {
    return { score: 0, reason: 'Degenerate segment' };
  }
  
  const n1 = { x: v1.x / len1, y: v1.y / len1 };
  const n2 = { x: v2.x / len2, y: v2.y / len2 };
  
  const dotProduct = n1.x * n2.x + n1.y * n2.y;
  const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
  const angleDegrees = (angle * 180) / Math.PI;
  
  const curvatureScore = angle / Math.PI;
  const avgLength = (len1 + len2) / 2;
  const lengthScore = Math.min(1, avgLength / 10);
  
  const score = curvatureScore * 0.7 + lengthScore * 0.3;
  
  let reason = '';
  if (angleDegrees < 5) {
    reason = `Nearly straight (${angleDegrees.toFixed(1)}°)`;
  } else if (angleDegrees < 15) {
    reason = `Slight curve (${angleDegrees.toFixed(1)}°)`;
  } else if (angleDegrees < 45) {
    reason = `Moderate curve (${angleDegrees.toFixed(1)}°)`;
  } else if (angleDegrees < 90) {
    reason = `Sharp curve (${angleDegrees.toFixed(1)}°)`;
  } else {
    reason = `Critical corner (${angleDegrees.toFixed(1)}°)`;
  }
  
  if (avgLength < 5) {
    reason += ', very short segment';
  } else if (avgLength < 10) {
    reason += ', short segment';
  }
  
  return { score, reason };
}

/**
 * Check if a Bézier curve is smooth (control points aligned with tangent)
 */
function isSmoothBezierCurve(
  currentSegment: BezierSegment,
  nextSegment: BezierSegment | undefined
): boolean {
  // Both segments must be cubic Bézier curves
  if (currentSegment.type !== 'C' || !nextSegment || nextSegment.type !== 'C') {
    return false;
  }
  
  if (currentSegment.points.length < 2 || nextSegment.points.length < 2) {
    return false;
  }
  
  // For cubic Bézier: points[0] = cp1, points[1] = cp2, end = anchor
  // cp2 of current segment approaches the anchor point
  // cp1 of next segment leaves the anchor point
  const cp2 = currentSegment.points[1]; // Second control point of incoming curve
  const anchor = currentSegment.end; // The anchor point itself
  const cp1 = nextSegment.points[0]; // First control point of outgoing curve
  
  // Check if control points are aligned through the anchor point
  const v1 = { x: anchor.x - cp2.x, y: anchor.y - cp2.y };
  const v2 = { x: cp1.x - anchor.x, y: cp1.y - anchor.y };
  
  const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  if (len1 === 0 || len2 === 0) return false;
  
  const n1 = { x: v1.x / len1, y: v1.y / len1 };
  const n2 = { x: v2.x / len2, y: v2.y / len2 };
  
  // If control points are aligned (dot product close to -1), it's a smooth curve
  const dotProduct = n1.x * n2.x + n1.y * n2.y;
  return dotProduct < -0.9; // Aligned within ~26 degrees
}

/**
 * Analyze all points in a path and return importance scores
 */
function analyzePathPoints(segments: BezierSegment[]): PointAnalysis[] {
  const anchorPoints: { point: Point; segmentIndex: number }[] = [];
  
  segments.forEach((seg, idx) => {
    if (seg.type === 'M' || seg.type === 'L') {
      anchorPoints.push({ point: seg.end, segmentIndex: idx });
    } else if (seg.type === 'C' && seg.points.length > 0) {
      anchorPoints.push({ point: seg.end, segmentIndex: idx });
    }
  });
  
  if (anchorPoints.length < 3) return [];
  
  // Check if path is closed (last segment is Z or endpoints match)
  const isClosed = segments[segments.length - 1]?.type === 'Z' ||
    (anchorPoints[0] && anchorPoints[anchorPoints.length - 1] &&
     Math.abs(anchorPoints[0].point.x - anchorPoints[anchorPoints.length - 1].point.x) < 0.001 &&
     Math.abs(anchorPoints[0].point.y - anchorPoints[anchorPoints.length - 1].point.y) < 0.001);
  
  // Remove duplicate closing point for closed paths
  if (isClosed && anchorPoints.length > 1) {
    const first = anchorPoints[0].point;
    const last = anchorPoints[anchorPoints.length - 1].point;
    if (Math.abs(first.x - last.x) < 0.001 && Math.abs(first.y - last.y) < 0.001) {
      anchorPoints.pop(); // Remove duplicate
    }
  }
  
  const analyses: PointAnalysis[] = [];
  
  // For closed paths, analyze all points; for open paths, skip first and last
  const startIdx = isClosed ? 0 : 1;
  const endIdx = isClosed ? anchorPoints.length : anchorPoints.length - 1;
  
  for (let i = startIdx; i < endIdx; i++) {
    const prevIdx = (i - 1 + anchorPoints.length) % anchorPoints.length;
    const nextIdx = (i + 1) % anchorPoints.length;
    
    const currentSegment = segments[anchorPoints[i].segmentIndex];
    const nextSegment = segments[anchorPoints[nextIdx].segmentIndex];
    
    // Check if this is a smooth Bézier curve
    const isSmooth = isSmoothBezierCurve(currentSegment, nextSegment);
    
    const { score, reason } = calculatePointImportance(
      anchorPoints[prevIdx].point,
      anchorPoints[i].point,
      anchorPoints[nextIdx].point
    );
    
    // Boost importance for smooth Bézier curves (they're structural, not redundant)
    const adjustedScore = isSmooth ? Math.max(score, 0.7) : score;
    const adjustedReason = isSmooth ? `Smooth curve anchor, ${reason.toLowerCase()}` : reason;
    
    analyses.push({
      index: i,
      segmentIndex: anchorPoints[i].segmentIndex,
      point: anchorPoints[i].point,
      importance: adjustedScore,
      reason: adjustedReason
    });
  }
  
  return analyses.sort((a, b) => a.importance - b.importance);
}

export const SmartHealModal: React.FC<SmartHealModalProps> = ({ onClose, onApply }) => {
  const svgDocument = useEditorStore(state => state.svgDocument);
  const selectedPathIds = useEditorStore(state => state.selectedPathIds);
  const editingPathId = useEditorStore(state => state.editingPathId);
  const toggleUpgradeModal = useEditorStore(state => state.toggleUpgradeModal);

  // Runtime PRO subscription status — read from authStore via ProFeaturesContext
  const proFeatures = useContext(ProFeaturesContext);
  if (!proFeatures) throw new Error('ProFeaturesContext not found');
  const isPro = proFeatures.hooks.useAuthStore(state => state.isPro);

  // Mode: 'auto' | 'manual' | 'batch'
  // PRO users with >1 paths selected open directly in Batch mode.
  const [mode, setMode] = useState<'auto' | 'manual' | 'batch'>(
    selectedPathIds.length > 1 && isPro ? 'batch' : 'auto'
  );

  // Batch mode is active only when the Batch tab is explicitly selected (PRO only)
  const isBatchMode = mode === 'batch';

  // Auto-Heal state
  const [autoHealIntensity, setAutoHealIntensity] = useState<IntensityLevel>('medium');
  const [autoHealApplied, setAutoHealApplied] = useState(false);
  const [autoHealedPath, setAutoHealedPath] = useState<Path | null>(null);
  // pendingAutoRun=true triggers the auto-run effect; starts true so modal runs on mount
  const [pendingAutoRun, setPendingAutoRun] = useState(true);
  
  // Manual healing state
  const [pointsToRemove, setPointsToRemove] = useState(0);
  const [manuallySelectedPoints, setManuallySelectedPoints] = useState<Set<number>>(new Set());
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showControlPoints, setShowControlPoints] = useState(true);
  
  const originalPreviewRef = useRef<HTMLDivElement>(null);
  const healedPreviewRef = useRef<HTMLDivElement>(null);

  // Freeze original document on mount
  const [originalDocument] = useState(() => JSON.parse(JSON.stringify(svgDocument)));

  // Batch: synchronously heal all selected paths (useMemo, no state machine needed)
  const healedBatchDocument = useMemo(() => {
    if (!isBatchMode || !originalDocument) return null;
    const doc = JSON.parse(JSON.stringify(originalDocument)) as SVGDocument;
    doc.paths = doc.paths.map((p: Path) =>
      selectedPathIds.includes(p.id) ? autoHealPath(p, autoHealIntensity) : p
    );
    return doc;
  }, [isBatchMode, originalDocument, selectedPathIds, autoHealIntensity]);

  // Batch stats derived from the two documents
  const batchStats = useMemo(() => {
    if (!isBatchMode || !originalDocument || !healedBatchDocument) return null;
    let totalBefore = 0;
    let totalAfter = 0;
    selectedPathIds.forEach(id => {
      const orig   = (originalDocument as SVGDocument).paths.find((p: Path) => p.id === id);
      const healed = healedBatchDocument.paths.find((p: Path) => p.id === id);
      if (orig)   totalBefore += countAnchorPoints(orig);
      if (healed) totalAfter  += countAnchorPoints(healed);
    });
    const reduction = totalBefore - totalAfter;
    const percent   = totalBefore > 0 ? Math.round((reduction / totalBefore) * 100) : 0;
    return { totalBefore, totalAfter, reduction, percent, count: selectedPathIds.length };
  }, [isBatchMode, originalDocument, healedBatchDocument, selectedPathIds]);

  // Batch preview SVGs (shown in left/right panels for multi-path mode)
  const batchOriginalSVG = useMemo(() => {
    if (!isBatchMode || !originalDocument) return '';
    return buildBatchPreviewSVG(originalDocument as SVGDocument, selectedPathIds);
  }, [isBatchMode, originalDocument, selectedPathIds]);

  const batchHealedSVG = useMemo(() => {
    if (!isBatchMode || !healedBatchDocument) return '';
    return buildBatchPreviewSVG(healedBatchDocument, selectedPathIds);
  }, [isBatchMode, healedBatchDocument, selectedPathIds]);

  // Get the path being edited (original from store)
  const originalTargetPath = useMemo(() => {
    if (!svgDocument) return null;
    const pathId = editingPathId || (selectedPathIds.length === 1 ? selectedPathIds[0] : null);
    if (!pathId) return null;
    return svgDocument.paths.find(p => p.id === pathId);
  }, [svgDocument, editingPathId, selectedPathIds]);

  // If Auto-Heal was applied, use the healed version as the target
  const targetPath = useMemo(() => {
    if (autoHealApplied && autoHealedPath) {
      return autoHealedPath; // This is the auto-healed version
    }
    return originalTargetPath;
  }, [autoHealApplied, autoHealedPath, originalTargetPath]);

  // Analyze points for ORIGINAL path (always uses the true original for the original preview)
  const originalPointAnalyses = useMemo(() => {
    if (!originalTargetPath) return [];
    return analyzePathPoints(originalTargetPath.segments);
  }, [originalTargetPath]);

  // Analyze points for TARGET path (uses current working path - original or healed)
  const pointAnalyses = useMemo(() => {
    if (!targetPath) return [];
    return analyzePathPoints(targetPath.segments);
  }, [targetPath]);

  const maxRemovable = pointAnalyses.length;

  // Determine which points to remove (manual selection takes precedence)
  const pointsToRemoveIndices = useMemo(() => {
    if (manuallySelectedPoints.size > 0) {
      return manuallySelectedPoints;
    }
    // Use slider value to select least important points
    return new Set(pointAnalyses.slice(0, pointsToRemove).map(a => a.index));
  }, [manuallySelectedPoints, pointAnalyses, pointsToRemove]);

  // Calculate manually healed path when points are selected for removal
  const manualHealedPath = useMemo(() => {
    if (!targetPath || pointsToRemoveIndices.size === 0) return null;
    return healPathMultiple(targetPath, pointsToRemoveIndices.size);
  }, [targetPath, pointsToRemoveIndices]);

  // Toggle point selection and sync slider value directly (no useEffect)
  const togglePointSelection = useCallback((pointIndex: number) => {
    setManuallySelectedPoints(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pointIndex)) {
        newSet.delete(pointIndex);
      } else {
        newSet.add(pointIndex);
      }
      // Sync slider with new selection size
      setPointsToRemove(newSet.size);
      return newSet;
    });
  }, []);

  // Wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!originalPreviewRef.current?.contains(e.target as Node) && 
          !healedPreviewRef.current?.contains(e.target as Node)) return;
      
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.95 : 1.05;
      setPreviewZoom(prev => Math.min(Math.max(prev * delta, 0.1), 10));
    };

    const original = originalPreviewRef.current;
    const healed = healedPreviewRef.current;
    
    if (original) original.addEventListener('wheel', handleWheel, { passive: false });
    if (healed) healed.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      if (original) original.removeEventListener('wheel', handleWheel);
      if (healed) healed.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Generate original SVG with importance visualization
  const originalSVG = useMemo(() => {
    if (!originalDocument || !originalTargetPath) return '';

    const pathElements: string[] = [];
    const visualizationElements: string[] = [];
    
    // Calculate container scale: SVG is scaled to fit ~252px container height
    const viewBoxHeight = originalDocument.viewBox?.height || 24;
    const containerSize = 252; // Approximate container height (90% of 280px)
    const containerScale = containerSize / viewBoxHeight;

    originalDocument.paths.forEach((path: Path) => {
      const isTarget = path.id === originalTargetPath.id;
      const opacity = isTarget ? 1 : 0.3;
      const strokeWidth = isTarget ? (path.strokeWidth || 1) : (path.strokeWidth || 1) * 0.5;
      const transformAttr = path.transform?.raw ? ` transform="${path.transform.raw}"` : '';
      
      pathElements.push(
        `<path d="${path.d}" fill="${path.fill || 'none'}" stroke="${path.stroke || 'black'}" stroke-width="${strokeWidth}" opacity="${opacity}"${transformAttr}/>`
      );

      // Add importance visualization for target path
      if (isTarget) {
        // Wrap points in a group with the same transform
        const transformAttrForPoints = path.transform?.raw ? ` transform="${path.transform.raw}"` : '';
        const pointsGroup: string[] = [];
        
        // Use originalPointAnalyses to show points from the TRUE original path
        originalPointAnalyses.forEach((analysis) => {
          const importance = analysis.importance;
          const isHovered = hoveredPoint === analysis.index;
          const isSelected = pointsToRemoveIndices.has(analysis.index);
          
          // Color: Amber for selected/to-remove, otherwise based on importance
          let color: string;
          let strokeColor: string;
          if (isSelected) {
            color = '#f59e0b'; // amber-500 - selected (matches canvas)
            strokeColor = '#fbbf24'; // amber-400 - stroke (matches canvas)
          } else if (importance < 0.2) {
            color = '#10b981'; // green - safe
            strokeColor = 'white';
          } else if (importance < 0.4) {
            color = '#84cc16'; // lime
            strokeColor = 'white';
          } else if (importance < 0.6) {
            color = '#eab308'; // yellow
            strokeColor = 'white';
          } else if (importance < 0.8) {
            color = '#ec4899'; // pink - risky (changed from orange to avoid confusion)
            strokeColor = 'white';
          } else {
            color = '#ef4444'; // red - critical
            strokeColor = 'white';
          }
          
          // Point sizes matching Canvas exactly
          const baseSize = isHovered ? 8 : (isSelected ? 6 : 4); // Match Canvas sizes
          const size = baseSize / (previewZoom * containerScale);
          const opacity = isSelected ? 1 : 0.7;
          const baseStrokeWidth = isSelected ? 3 : 2; // Match Canvas stroke widths
          const strokeWidth = baseStrokeWidth / (previewZoom * containerScale);
          
          // Add data attribute for click handling and shadow for selected
          const shadow = isSelected ? `filter="url(#selected-glow)"` : '';
          pointsGroup.push(
            `<circle cx="${analysis.point.x}" cy="${analysis.point.y}" r="${size}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" opacity="${opacity}" data-point-index="${analysis.index}" style="cursor: pointer;" ${shadow}/>`
          );
        });
        
        // Wrap points in a group with transform
        if (pointsGroup.length > 0) {
          visualizationElements.push(`<g${transformAttrForPoints}>${pointsGroup.join('\n')}</g>`);
        }
      }
    });

    const viewBox = originalDocument.viewBox 
      ? `${originalDocument.viewBox.x} ${originalDocument.viewBox.y} ${originalDocument.viewBox.width} ${originalDocument.viewBox.height}`
      : '0 0 24 24';
    
    // Add glow filter for selected points
    const defs = `<defs>
  <filter id="selected-glow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
    <feMerge>
      <feMergeNode in="coloredBlur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
</defs>`;
    
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
${defs}
${pathElements.join('\n')}
${showControlPoints ? visualizationElements.join('\n') : ''}
</svg>`;
  }, [originalDocument, originalTargetPath, originalPointAnalyses, hoveredPoint, pointsToRemoveIndices, previewZoom, showControlPoints]);

  // Generate healed SVG
  const healedSVG = useMemo(() => {
    if (!svgDocument || !targetPath) return originalSVG;
    
    // Use the appropriate stored healed path
    const healedPath = mode === 'auto' ? autoHealedPath : manualHealedPath;
    if (!healedPath) return originalSVG;

    const pathElements: string[] = [];
    const visualizationElements: string[] = [];
    
    // Calculate container scale for point sizing
    const viewBoxHeight = svgDocument.viewBox?.height || 24;
    const containerSize = 252;
    const containerScale = containerSize / viewBoxHeight;

    // Analyze the healed path to get remaining points
    const healedPointAnalyses = analyzePathPoints(healedPath.segments);

    svgDocument.paths.forEach((path) => {
      if (path.id === targetPath.id) {
        const transformAttr = healedPath.transform?.raw ? ` transform="${healedPath.transform.raw}"` : '';
        pathElements.push(
          `<path d="${healedPath.d}" fill="${healedPath.fill || 'none'}" stroke="${healedPath.stroke || 'none'}" stroke-width="${healedPath.strokeWidth || 1}"${transformAttr}/>`
        );

        // Add point visualization for healed path
        const transformAttrForPoints = healedPath.transform?.raw ? ` transform="${healedPath.transform.raw}"` : '';
        const pointsGroup: string[] = [];
        
        healedPointAnalyses.forEach((analysis) => {
          const importance = analysis.importance;
          
          // Color based on importance (no selections in result view)
          let color: string;
          let strokeColor: string;
          if (importance < 0.2) {
            color = '#10b981'; // green - safe
            strokeColor = 'white';
          } else if (importance < 0.4) {
            color = '#84cc16'; // lime
            strokeColor = 'white';
          } else if (importance < 0.6) {
            color = '#eab308'; // yellow
            strokeColor = 'white';
          } else if (importance < 0.8) {
            color = '#ec4899'; // pink - risky
            strokeColor = 'white';
          } else {
            color = '#ef4444'; // red - critical
            strokeColor = 'white';
          }
          
          const baseSize = 4;
          const size = baseSize / (previewZoom * containerScale);
          const opacity = 0.7;
          const baseStrokeWidth = 2;
          const strokeWidth = baseStrokeWidth / (previewZoom * containerScale);
          
          pointsGroup.push(
            `<circle cx="${analysis.point.x}" cy="${analysis.point.y}" r="${size}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`
          );
        });
        
        if (pointsGroup.length > 0) {
          visualizationElements.push(`<g${transformAttrForPoints}>${pointsGroup.join('\n')}</g>`);
        }
      } else {
        const transformAttr = path.transform?.raw ? ` transform="${path.transform.raw}"` : '';
        pathElements.push(
          `<path d="${path.d}" fill="${path.fill || 'none'}" stroke="${path.stroke || 'none'}" stroke-width="${path.strokeWidth || 1}" opacity="0.3"${transformAttr}/>`
        );
      }
    });

    const viewBox = svgDocument.viewBox 
      ? `${svgDocument.viewBox.x} ${svgDocument.viewBox.y} ${svgDocument.viewBox.width} ${svgDocument.viewBox.height}`
      : '0 0 24 24';
    
    const defs = `<defs>
  <filter id="selected-glow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
    <feMerge>
      <feMergeNode in="coloredBlur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
</defs>`;
    
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
${defs}
${pathElements.join('\n')}
${showControlPoints ? visualizationElements.join('\n') : ''}
</svg>`;
  }, [svgDocument, targetPath, originalSVG, mode, autoHealedPath, manualHealedPath, previewZoom, showControlPoints]);

  const handleApply = () => {
    if (isBatchMode) {
      if (!healedBatchDocument) return;
      const results = selectedPathIds
        .map(id => {
          const healed = healedBatchDocument.paths.find((p: Path) => p.id === id);
          return healed ? { path: healed, originalPathId: id } : null;
        })
        .filter(Boolean) as Array<{ path: Path; originalPathId: string }>;
      onApply(results);
      onClose();
    } else {
      if (!originalTargetPath) return;
      const finalPath = mode === 'auto' ? autoHealedPath : manualHealedPath;
      if (!finalPath) return;
      onApply([{ path: finalPath, originalPathId: originalTargetPath.id }]);
      onClose();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Check if clicking on a point circle
    const target = e.target as HTMLElement;
    if (target.tagName === 'circle' && target.hasAttribute('data-point-index')) {
      const pointIndex = parseInt(target.getAttribute('data-point-index')!);
      togglePointSelection(pointIndex);
      e.stopPropagation();
      return;
    }

    // Otherwise start panning
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - previewPan.x, y: e.clientY - previewPan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPreviewPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const resetView = () => {
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
  };

  // Auto-run effect: single-path only — batch mode uses healedBatchDocument memo
  useEffect(() => {
    if (!pendingAutoRun || mode !== 'auto' || isBatchMode) return;
    setPendingAutoRun(false);
    if (!originalTargetPath) return;
    const healedPath = autoHealPath(originalTargetPath, autoHealIntensity);
    setAutoHealedPath(healedPath);
    setAutoHealApplied(true);
    setManuallySelectedPoints(new Set());
    setPointsToRemove(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoRun, isBatchMode, originalTargetPath, autoHealIntensity, mode]);

  // Calculate success metrics
  const autoHealMetrics = useMemo(() => {
    if (!autoHealApplied || !originalTargetPath || !autoHealedPath) {
      return null;
    }
    
    const originalCount = originalTargetPath.segments.length;
    const healedCount = autoHealedPath.segments.length;
    const reduction = originalCount - healedCount;
    const percentReduction = (reduction / originalCount) * 100;
    
    return {
      originalCount,
      healedCount,
      reduction,
      percentReduction
    };
  }, [autoHealApplied, originalTargetPath, autoHealedPath]);

  // Calculate total anchor points - MUST be before any conditional returns
  const originalPointCount = useMemo(() => {
    if (!originalTargetPath) return 0;
    return countAnchorPoints(originalTargetPath);
  }, [originalTargetPath]);

  const totalAnchorPoints = useMemo(() => {
    if (!targetPath) return 0;
    return countAnchorPoints(targetPath);
  }, [targetPath]);
  
  const currentPointCount = totalAnchorPoints;
  const resultPointCount = currentPointCount - pointsToRemoveIndices.size;

  if (!targetPath && !isBatchMode) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Smart Heal" size="sm">
        <p className="text-text-secondary mb-4">Please select a path to analyze.</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-bg-tertiary hover:bg-border rounded transition-colors"
        >
          Close
        </button>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Smart Heal"
      size="xl"
      footer={
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-bg-tertiary hover:bg-border rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={
              isBatchMode
                ? !healedBatchDocument
                : mode === 'auto'
                  ? !autoHealApplied || !autoHealedPath
                  : !manualHealedPath
            }
            className="px-4 py-2 bg-accent-primary hover:bg-indigo-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBatchMode
              ? `Apply to ${selectedPathIds.length} Paths`
              : `Apply ${mode === 'auto' ? 'Auto-Heal' : 'Manual Changes'}`}
          </button>
        </div>
      }
    >
            {/* Single-path preview panels */}
            {!isBatchMode && (
            <div className="mb-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Original with Analysis */}
                <div>
                  <h3 className="text-sm font-medium mb-2 text-gray-400">
                    Original ({originalPointCount} points)
                  </h3>
                  <div 
                    ref={originalPreviewRef}
                    className="bg-bg-primary rounded border border-border overflow-hidden cursor-move select-none relative"
                    style={{ height: '280px' }}
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

                {/* Healed Preview */}
                <div>
                  <h3 className="text-sm font-medium mb-2 text-gray-400">
                    After Healing ({resultPointCount} points)
                  </h3>
                  <div 
                    ref={healedPreviewRef}
                    className="bg-bg-primary rounded border border-border overflow-hidden cursor-move select-none relative"
                    style={{ height: '280px' }}
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
                      dangerouslySetInnerHTML={{ __html: healedSVG }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">💡 Scroll to zoom, drag to pan</p>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showControlPoints}
                      onChange={(e) => setShowControlPoints(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-gray-600 bg-bg-tertiary text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-gray-400">Show control points</span>
                  </label>
                  <span className="text-xs text-gray-500">Zoom: {(previewZoom * 100).toFixed(0)}%</span>
                  <button
                    onClick={resetView}
                    className="text-xs px-2 py-1 bg-bg-tertiary hover:bg-opacity-80 rounded"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
            )}

            {/* Batch preview (shown when multiple paths selected) */}
            {isBatchMode && (
            <div className="mb-4">
              <div className="grid grid-cols-2 gap-4 mb-3">
                {/* Original */}
                <div>
                  <h3 className="text-sm font-medium mb-2 text-gray-400">
                    Original
                    {batchStats && <span className="text-gray-500 ml-1">({batchStats.totalBefore} pts)</span>}
                  </h3>
                  <div
                    ref={originalPreviewRef}
                    className="bg-bg-primary rounded border border-border overflow-hidden cursor-move select-none"
                    style={{ height: '240px' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    <div
                      className="w-full h-full flex items-center justify-center [&>svg]:max-w-[90%] [&>svg]:max-h-[90%]"
                      style={{
                        transform: `scale(${previewZoom}) translate(${previewPan.x / previewZoom}px, ${previewPan.y / previewZoom}px)`,
                        transformOrigin: 'center',
                        transition: isPanning ? 'none' : 'transform 0.1s'
                      }}
                      dangerouslySetInnerHTML={{ __html: batchOriginalSVG }}
                    />
                  </div>
                </div>
                {/* Healed */}
                <div>
                  <h3 className="text-sm font-medium mb-2 text-gray-400">
                    After Heal
                    {batchStats && (
                      <span className={`ml-1 ${
                        batchStats.percent >= 20 ? 'text-green-400' :
                        batchStats.percent >= 5  ? 'text-amber-400' : 'text-gray-500'
                      }`}>
                        ({batchStats.totalAfter} pts
                        {batchStats.percent > 0 && ` · −${batchStats.percent}%`})
                      </span>
                    )}
                  </h3>
                  <div
                    ref={healedPreviewRef}
                    className="bg-bg-primary rounded border border-border overflow-hidden cursor-move select-none"
                    style={{ height: '240px' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    <div
                      className="w-full h-full flex items-center justify-center [&>svg]:max-w-[90%] [&>svg]:max-h-[90%]"
                      style={{
                        transform: `scale(${previewZoom}) translate(${previewPan.x / previewZoom}px, ${previewPan.y / previewZoom}px)`,
                        transformOrigin: 'center',
                        transition: isPanning ? 'none' : 'transform 0.1s'
                      }}
                      dangerouslySetInnerHTML={{ __html: batchHealedSVG }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {batchStats?.count} selected path{batchStats?.count !== 1 ? 's' : ''} highlighted · Scroll to zoom, drag to pan
              </p>
            </div>
            )}

            {/* Mode Selection — always shown */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Healing Mode</label>
              <div className={`grid gap-2 ${selectedPathIds.length > 1 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <button
                  onClick={() => setMode('auto')}
                  className={`px-4 py-2 rounded border transition-all ${
                    mode === 'auto'
                      ? 'bg-gradient-to-r from-accent-primary to-purple-500 border-accent-primary text-white shadow-lg shadow-accent-primary/50'
                      : 'bg-bg-primary border-border text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <div className="font-medium">✨ Auto-Heal</div>
                  <div className="text-xs opacity-80">One-click optimization</div>
                </button>
                <button
                  onClick={() => setMode('manual')}
                  className={`px-4 py-2 rounded border transition-all ${
                    mode === 'manual'
                      ? 'bg-gradient-to-r from-accent-primary to-purple-500 border-accent-primary text-white shadow-lg shadow-accent-primary/50'
                      : 'bg-bg-primary border-border text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <div className="font-medium">🔧 Manual</div>
                  <div className="text-xs opacity-80">Click to select points</div>
                </button>
                {selectedPathIds.length > 1 && (
                <button
                  onClick={() => isPro ? setMode('batch') : toggleUpgradeModal()}
                  className={`px-4 py-2 rounded border transition-all relative ${
                    mode === 'batch'
                      ? 'bg-gradient-to-r from-accent-primary to-purple-500 border-accent-primary text-white shadow-lg shadow-accent-primary/50'
                      : isPro
                        ? 'bg-bg-primary border-border text-gray-400 hover:border-gray-500'
                        : 'bg-bg-primary border-border text-gray-600 cursor-pointer hover:border-purple-500/50'
                  }`}
                >
                  {!isPro && (
                    <span className="absolute -top-1.5 -right-1.5 px-1 py-0.5 text-[8px] leading-none font-black tracking-wide bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-md shadow-md border border-white/20">PRO</span>
                  )}
                  <div className="font-medium">
                    ⚡ Batch
                  </div>
                  <div className="text-xs opacity-80">{selectedPathIds.length} paths</div>
                </button>
                )}
              </div>
            </div>

            {/* Auto-Heal / Batch Settings — intensity picker shared by both modes */}
            {(mode === 'auto' || mode === 'batch') && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold">
                    {isBatchMode ? 'Batch Heal Settings' : 'Auto-Heal Settings'}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {isBatchMode
                      ? `Applied to all ${selectedPathIds.length} selected paths · preview updates instantly`
                      : '3-step optimization algorithm'}
                  </p>
                </div>
                {isBatchMode ? (
                  batchStats && (
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${
                        batchStats.percent >= 50 ? 'text-green-400' :
                        batchStats.percent >= 20 ? 'text-amber-400' :
                        batchStats.percent >= 5  ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {batchStats.percent < 5 ? 'Paths Clean ✓' : `${batchStats.percent}% Optimized`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {batchStats.totalBefore} → {batchStats.totalAfter} pts · {batchStats.count} paths
                      </div>
                    </div>
                  )
                ) : (
                  autoHealApplied && autoHealMetrics && (
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${
                        autoHealMetrics.percentReduction >= 50 ? 'text-green-400' :
                        autoHealMetrics.percentReduction >= 20 ? 'text-amber-400' :
                        autoHealMetrics.percentReduction >= 5 ? 'text-gray-400' :
                        'text-gray-500'
                      }`}>
                        {autoHealMetrics.percentReduction < 5 ? 'Path Clean ✓' :
                         `${autoHealMetrics.percentReduction.toFixed(1)}% Optimized`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {autoHealMetrics.originalCount} → {autoHealMetrics.healedCount} segments
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="space-y-3">
                {/* Intensity Selection */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Intensity Level
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => { setAutoHealIntensity('light'); if (!isBatchMode) setPendingAutoRun(true); }}
                      title="Light: 0.05% tolerance, 20° corner angle. Best for preserving fine details and artistic curves."
                      className={`p-2 rounded text-xs font-medium transition-colors ${
                        autoHealIntensity === 'light'
                          ? 'bg-blue-500 text-white'
                          : 'bg-bg-tertiary text-gray-400 hover:bg-bg-primary'
                      }`}
                    >
                      <div className="text-sm mb-0.5">🌱 Light</div>
                      <div className="text-[10px] opacity-75">Preserve detail</div>
                      <div className="text-[9px] opacity-60 mt-0.5">
                        {INTENSITY_PRESETS.light.tolerance}%, {INTENSITY_PRESETS.light.cornerAngle}°
                      </div>
                    </button>
                    <button
                      onClick={() => { setAutoHealIntensity('medium'); if (!isBatchMode) setPendingAutoRun(true); }}
                      title="Medium: 0.15% tolerance, 30° corner angle. Recommended balance between optimization and quality."
                      className={`p-2 rounded text-xs font-medium transition-colors ${
                        autoHealIntensity === 'medium'
                          ? 'bg-blue-500 text-white'
                          : 'bg-bg-tertiary text-gray-400 hover:bg-bg-primary'
                      }`}
                    >
                      <div className="text-sm mb-0.5">⚖️ Medium</div>
                      <div className="text-[10px] opacity-75">Recommended</div>
                      <div className="text-[9px] opacity-60 mt-0.5">
                        {INTENSITY_PRESETS.medium.tolerance}%, {INTENSITY_PRESETS.medium.cornerAngle}°
                      </div>
                    </button>
                    <button
                      onClick={() => { setAutoHealIntensity('strong'); if (!isBatchMode) setPendingAutoRun(true); }}
                      title="Strong: 0.5% tolerance, 45° corner angle. Aggressive optimization for web graphics and icons."
                      className={`p-2 rounded text-xs font-medium transition-colors ${
                        autoHealIntensity === 'strong'
                          ? 'bg-blue-500 text-white'
                          : 'bg-bg-tertiary text-gray-400 hover:bg-bg-primary'
                      }`}
                    >
                      <div className="text-sm mb-0.5 flex items-center gap-1">
                        <Flame size={14} strokeWidth={1.5} /> Strong
                      </div>
                      <div className="text-[10px] opacity-75">Web optimize</div>
                      <div className="text-[9px] opacity-60 mt-0.5">
                        {INTENSITY_PRESETS.strong.tolerance}%, {INTENSITY_PRESETS.strong.cornerAngle}°
                      </div>
                    </button>
                    <button
                      onClick={() => { setAutoHealIntensity('extreme'); if (!isBatchMode) setPendingAutoRun(true); }}
                      title="Extreme: 1.5% tolerance, 60° corner angle. Maximum simplification for heavily traced SVGs."
                      className={`p-2 rounded text-xs font-medium transition-colors ${
                        autoHealIntensity === 'extreme'
                          ? 'bg-blue-500 text-white'
                          : 'bg-bg-tertiary text-gray-400 hover:bg-bg-primary'
                      }`}
                    >
                      <div className="text-sm mb-0.5 flex items-center gap-1">
                        <Flame size={14} strokeWidth={2} className="text-red-400" /> Extreme
                      </div>
                      <div className="text-[10px] opacity-75">Maximum</div>
                      <div className="text-[9px] opacity-60 mt-0.5">
                        {INTENSITY_PRESETS.extreme.tolerance}%, {INTENSITY_PRESETS.extreme.cornerAngle}°
                      </div>
                    </button>
                  </div>
                </div>

                {/* Info Text */}
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  <span className="font-semibold">Auto-Heal</span> applies 3-step simplification
                  (Visvalingam-Whyatt → Schneider curve fitting → G1 continuity).
                  Preview updates instantly when you change intensity.
                </p>
              </div>
            </div>
            )}

            {/* Manual Healing Section — single path only */}
            {mode === 'manual' && (
            <div>
              <div className="mb-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <p className="text-xs text-gray-400">
                  💡 <span className="font-semibold">Manual mode</span> lets you selectively remove points. 
                  Click points in the preview or use the slider. Set to 0 to keep all points.
                </p>
              </div>

            {/* Points to Remove Slider */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Points to Remove: {pointsToRemove} {manuallySelectedPoints.size > 0 && '(manually selected)'}
              </label>
              <input
                type="range"
                min="0"
                max={maxRemovable}
                step="1"
                value={pointsToRemove}
                onChange={(e) => {
                  setPointsToRemove(parseInt(e.target.value));
                  setManuallySelectedPoints(new Set()); // Clear manual selection when using slider
                }}
                className="w-full"
                disabled={maxRemovable === 0}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                <span>Keep all (0)</span>
                <span>Maximum ({maxRemovable})</span>
              </div>
              {manuallySelectedPoints.size === 0 && pointsToRemove === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  ℹ️ No points will be removed. Increase slider or click points to select.
                </p>
              )}
              {manuallySelectedPoints.size === 0 && pointsToRemove > 0 && (
                <p className="text-xs text-blue-400 mt-1">
                  💡 Click on points in the preview to manually select which to remove
                </p>
              )}
              {manuallySelectedPoints.size > 0 && (
                <button
                  onClick={() => setManuallySelectedPoints(new Set())}
                  className="text-xs text-amber-400 hover:text-amber-300 mt-1"
                >
                  Clear manual selection
                </button>
              )}
            </div>

            {/* Point Analysis List */}
            <div>
              <h3 className="text-sm font-medium mb-2">Point Analysis</h3>
              <div className="bg-bg-tertiary rounded border border-border p-3 max-h-[200px] overflow-y-auto">
                {pointAnalyses.length === 0 ? (
                  <p className="text-sm text-text-secondary">
                    No removable points found. Path is already optimized.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {pointAnalyses.slice(0, 10).map((analysis, idx) => {
                      const willBeRemoved = pointsToRemoveIndices.has(analysis.index);
                      let importanceColor = '';
                      let importanceLabel = '';
                      
                      if (analysis.importance < 0.2) {
                        importanceColor = 'text-green-400';
                        importanceLabel = 'Safe';
                      } else if (analysis.importance < 0.4) {
                        importanceColor = 'text-lime-400';
                        importanceLabel = 'Low risk';
                      } else if (analysis.importance < 0.6) {
                        importanceColor = 'text-yellow-400';
                        importanceLabel = 'Moderate';
                      } else if (analysis.importance < 0.8) {
                        importanceColor = 'text-pink-400';
                        importanceLabel = 'Risky';
                      } else {
                        importanceColor = 'text-red-400';
                        importanceLabel = 'Critical';
                      }
                      
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer ${
                            willBeRemoved ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-bg-primary hover:bg-bg-tertiary'
                          }`}
                          onClick={() => togglePointSelection(analysis.index)}
                          onMouseEnter={() => setHoveredPoint(analysis.index)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-text-secondary">#{idx + 1}</span>
                            <span className={importanceColor}>{importanceLabel}</span>
                            {willBeRemoved && <span className="text-amber-400">• Will remove</span>}
                          </div>
                          <span className="text-text-secondary">{analysis.reason}</span>
                        </div>
                      );
                    })}
                    {pointAnalyses.length > 10 && (
                      <p className="text-xs text-text-secondary text-center mt-2">
                        ...and {pointAnalyses.length - 10} more points
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              {/* Legend */}
              <div className="flex items-center gap-4 mt-2 text-xs text-text-secondary">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span>Selected</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  <span>Safe</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <span>Moderate</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-pink-400"></div>
                  <span>Risky</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <span>Critical</span>
                </div>
              </div>
            </div>
            </div>
            )}

        {/* Action Buttons moved to Modal footer */}
      </Modal>
  );
};
