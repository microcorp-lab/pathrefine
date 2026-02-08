import type { Path, BezierSegment, Point } from '../types/svg';
import { distance } from './pathMath';

/**
 * Converts a Path into a dense array of Points for Laplacian smoothing.
 * Uses adaptive sampling based on segment complexity for optimal performance.
 * 
 * @param path - The path to sample
 * @param mode - 'fixed' = constant samples per segment, 'adaptive' = based on arc length
 * @param samplesPerSegment - Base number of samples (for fixed mode or as baseline)
 * @param adaptiveStep - Pixel distance between samples for adaptive mode (default 5px, scales with path size)
 * @returns Array of densely sampled points
 */
export function samplePathToDenseCloud(
  path: Path, 
  mode: 'fixed' | 'adaptive' = 'adaptive',
  samplesPerSegment: number = 10,
  adaptiveStep: number = 5
): Point[] {
  const points: Point[] = [];
  let currentPos: Point = { x: 0, y: 0 };
  let pathStartPos: Point = { x: 0, y: 0 };

  path.segments.forEach((seg) => {
    switch (seg.type) {
      case 'M':
        currentPos = { x: seg.end.x, y: seg.end.y };
        pathStartPos = { ...currentPos };
        points.push({ ...currentPos });
        break;

      case 'L': {
        // Linear: For Laplacian smoothing, add mid-points to allow the line to "bend"
        const lineLength = distance(currentPos, seg.end);
        const samples = mode === 'adaptive' 
          ? Math.max(2, Math.ceil(lineLength / adaptiveStep)) // Scaled by path size
          : samplesPerSegment;
        
        for (let i = 1; i <= samples; i++) {
          const t = i / samples;
          points.push({
            x: currentPos.x + (seg.end.x - currentPos.x) * t,
            y: currentPos.y + (seg.end.y - currentPos.y) * t
          });
        }
        currentPos = { x: seg.end.x, y: seg.end.y };
        break;
      }

      case 'Q': {
        // Quadratic Bezier: P = (1-t)²P0 + 2(1-t)tP1 + t²P2
        const cp = seg.points.length === 3 ? seg.points[1] : seg.points[0];
        if (!cp) break;
        
        // Adaptive sampling based on curve complexity
        const curveLength = estimateQuadraticLength(currentPos, cp, seg.end);
        const samples = mode === 'adaptive'
          ? Math.max(5, Math.ceil(curveLength / adaptiveStep)) // Scaled by path size
          : samplesPerSegment;
        
        for (let i = 1; i <= samples; i++) {
          const t = i / samples;
          const invT = 1 - t;
          points.push({
            x: invT * invT * currentPos.x + 2 * invT * t * cp.x + t * t * seg.end.x,
            y: invT * invT * currentPos.y + 2 * invT * t * cp.y + t * t * seg.end.y
          });
        }
        currentPos = { x: seg.end.x, y: seg.end.y };
        break;
      }

      case 'C': {
        // Cubic Bezier: P = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
        // Handle both [cp1, cp2, end] and [start, cp1, cp2, end] formats
        const cp1 = seg.points.length === 4 ? seg.points[1] : seg.points[0];
        const cp2 = seg.points.length === 4 ? seg.points[2] : seg.points[1];
        
        if (!cp1 || !cp2) break;
        
        // Adaptive sampling based on curve complexity
        const complexity = calculateCubicComplexity(currentPos, cp1, cp2, seg.end);
        const samples = mode === 'adaptive'
          ? Math.max(5, Math.min(15, Math.ceil(complexity * samplesPerSegment)))
          : samplesPerSegment;
        
        for (let i = 1; i <= samples; i++) {
          const t = i / samples;
          const invT = 1 - t;
          const b0 = invT * invT * invT;
          const b1 = 3 * invT * invT * t;
          const b2 = 3 * invT * t * t;
          const b3 = t * t * t;
          points.push({
            x: b0 * currentPos.x + b1 * cp1.x + b2 * cp2.x + b3 * seg.end.x,
            y: b0 * currentPos.y + b1 * cp1.y + b2 * cp2.y + b3 * seg.end.y
          });
        }
        currentPos = { x: seg.end.x, y: seg.end.y };
        break;
      }

      case 'Z':
        // Close Path: Treat as a line back to the path start
        if (currentPos.x !== pathStartPos.x || currentPos.y !== pathStartPos.y) {
          const closeLength = distance(currentPos, pathStartPos);
          const samples = mode === 'adaptive'
            ? Math.max(2, Math.ceil(closeLength / adaptiveStep))
            : samplesPerSegment;
          
          for (let i = 1; i <= samples; i++) {
            const t = i / samples;
            points.push({
              x: currentPos.x + (pathStartPos.x - currentPos.x) * t,
              y: currentPos.y + (pathStartPos.y - currentPos.y) * t
            });
          }
        }
        currentPos = { ...pathStartPos };
        break;
    }
  });

  // Deduplication: Remove consecutive identical points
  return deduplicatePoints(points);
}

/**
 * Estimate arc length of a quadratic Bezier curve
 * Uses chord length as approximation (fast but slightly underestimates)
 */
function estimateQuadraticLength(p0: Point, p1: Point, p2: Point): number {
  // Chord length + control polygon length / 2
  const chordLength = distance(p0, p2);
  const polyLength = distance(p0, p1) + distance(p1, p2);
  return (chordLength + polyLength) / 2;
}

/**
 * Calculate cubic Bezier complexity (1 = simple, 3+ = very complex)
 * Based on how far control points deviate from the chord
 */
function calculateCubicComplexity(p0: Point, cp1: Point, cp2: Point, p3: Point): number {
  const chordLength = distance(p0, p3);
  if (chordLength < 0.01) return 1; // Degenerate curve
  
  // Calculate perpendicular distance of control points from chord
  const dist1 = pointToLineDistance(cp1, p0, p3);
  const dist2 = pointToLineDistance(cp2, p0, p3);
  
  // Complexity is the ratio of control point deviation to chord length
  const maxDeviation = Math.max(dist1, dist2);
  const complexity = 1 + (maxDeviation / chordLength) * 2;
  
  return Math.min(3, complexity); // Cap at 3x
}

/**
 * Calculate perpendicular distance from a point to a line segment
 */
function pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;
  
  if (lengthSquared < 0.01) {
    return distance(point, lineStart);
  }
  
  // Project point onto line (parameter t)
  const t = Math.max(0, Math.min(1, 
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared
  ));
  
  // Calculate closest point on line
  const closestX = lineStart.x + t * dx;
  const closestY = lineStart.y + t * dy;
  
  return Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);
}

/**
 * Remove consecutive duplicate points (within 0.01px tolerance)
 */
function deduplicatePoints(points: Point[]): Point[] {
  if (points.length === 0) return points;
  
  const deduplicated: Point[] = [points[0]];
  const tolerance = 0.01;
  
  for (let i = 1; i < points.length; i++) {
    const prev = deduplicated[deduplicated.length - 1];
    const curr = points[i];
    
    const dist = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
    if (dist > tolerance) {
      deduplicated.push(curr);
    }
  }
  
  return deduplicated;
}

/**
 * Check if a path is closed (first and last points match)
 */
export function isPathClosed(path: Path): boolean {
  if (path.segments.length === 0) return false;
  
  // Check if last segment is Z
  const lastSeg = path.segments[path.segments.length - 1];
  if (lastSeg.type === 'Z') return true;
  
  // Check if first and last points match
  const firstSeg = path.segments[0];
  if (firstSeg.type === 'M') {
    const start = firstSeg.end;
    const end = lastSeg.end;
    const dist = distance(start, end);
    return dist < 0.1; // Within 0.1px tolerance
  }
  
  return false;
}

export function smoothPath(
  path: Path, 
  smoothness: number = 0.3,
  convertLinesToCurves: boolean = false,
  selectedPointIndices?: number[],
  preserveSmooth: boolean = true
): Path {
  if (path.segments.length < 2) return path;

  const smoothedSegments: BezierSegment[] = [];
  
  // If we have selected points, figure out which segments they belong to
  let segmentsToSmooth: Set<number> | null = null;
  if (selectedPointIndices && selectedPointIndices.length > 0) {
    segmentsToSmooth = new Set();
    let pointIndex = 0;
    
    // Build a map of point indices to segment indices
    for (let i = 0; i < path.segments.length; i++) {
      const segment = path.segments[i];
      
      // Each segment contributes different numbers of points
      if (segment.type === 'M') {
        // Move has 1 point (the end point)
        if (selectedPointIndices.includes(pointIndex)) {
          segmentsToSmooth.add(i);
        }
        pointIndex += 1;
      } else if (segment.type === 'L') {
        // Line has 1 point (the end point)
        if (selectedPointIndices.includes(pointIndex)) {
          segmentsToSmooth.add(i);
        }
        pointIndex += 1;
      } else if (segment.type === 'C') {
        // Cubic bezier has 3 points (cp1, cp2, end)
        if (selectedPointIndices.includes(pointIndex) || 
            selectedPointIndices.includes(pointIndex + 1) || 
            selectedPointIndices.includes(pointIndex + 2)) {
          segmentsToSmooth.add(i);
        }
        pointIndex += 3;
      } else if (segment.type === 'Q') {
        // Quadratic bezier has 2 points (cp, end)
        if (selectedPointIndices.includes(pointIndex) || 
            selectedPointIndices.includes(pointIndex + 1)) {
          segmentsToSmooth.add(i);
        }
        pointIndex += 2;
      } else if (segment.type === 'Z') {
        // Close has 0 points
        // Don't increment pointIndex
      }
    }
  }
  
  for (let i = 0; i < path.segments.length; i++) {
    const segment = path.segments[i];
    
    // Skip if we're only smoothing selected segments and this isn't one
    const shouldSmoothThisSegment = !segmentsToSmooth || segmentsToSmooth.has(i);
    
    if (segment.type === 'M' || segment.type === 'Z') {
      // Always keep move and close commands as-is
      smoothedSegments.push(segment);
    } else if (segment.type === 'L') {
      if (convertLinesToCurves && shouldSmoothThisSegment) {
        // Convert line to smooth curve
        const prev = i > 0 ? path.segments[i - 1] : null;
        const next = i < path.segments.length - 1 ? path.segments[i + 1] : null;
        const curveSegment = lineToCubic(segment, prev, next, smoothness);
        smoothedSegments.push(curveSegment);
      } else {
        // Keep line as-is
        smoothedSegments.push(segment);
      }
    } else if (segment.type === 'C') {
      if (shouldSmoothThisSegment) {
        // Smooth cubic bezier curves
        const prev = i > 0 ? path.segments[i - 1] : null;
        const next = i < path.segments.length - 1 ? path.segments[i + 1] : null;
        
        const smoothedSegment = smoothCubicBezier(segment, prev, next, smoothness, preserveSmooth);
        smoothedSegments.push(smoothedSegment);
      } else {
        smoothedSegments.push(segment);
      }
    } else if (segment.type === 'Q') {
      if (shouldSmoothThisSegment) {
        // Convert quadratic to cubic and smooth
        const cubicSegment = quadraticToCubic(segment);
        const smoothedSegment = smoothCubicBezier(cubicSegment, null, null, smoothness, preserveSmooth);
        smoothedSegments.push(smoothedSegment);
      } else {
        smoothedSegments.push(segment);
      }
    } else {
      smoothedSegments.push(segment);
    }
  }

  // Convert segments back to path data
  const d = segmentsToPathData(smoothedSegments);

  return {
    ...path,
    d,
    segments: smoothedSegments
  };
}

/**
 * Smooth a cubic bezier segment by adjusting control points
 * @param preserveSmooth - If true, detect already-smooth curves and reduce effect
 */
function smoothCubicBezier(
  segment: BezierSegment,
  prev: BezierSegment | null,
  next: BezierSegment | null,
  smoothness: number,
  preserveSmooth: boolean = true
): BezierSegment {
  const { start, end, points } = segment;
  
  // Handle both formats: [start, cp1, cp2, end] or [cp1, cp2, end]
  const c1 = points.length === 4 ? points[1] : points[0];
  const c2 = points.length === 4 ? points[2] : points[1];
  
  if (!c1 || !c2) return segment;
  
  // Check if curve is already smooth
  if (preserveSmooth) {
    const isSmoothAlready = isSegmentSmooth(segment, prev, next);
    if (isSmoothAlready) {
      // Reduce smoothing effect for already-smooth curves
      smoothness = smoothness * 0.2; // Apply only 20% of the effect
    }
  }
  
  // CRITICAL FIX: Cap smoothness to prevent flattening
  // At smoothness = 1, control points align perfectly with tangents,
  // which can collapse curves into lines. Cap at 0.85 for safety.
  smoothness = Math.min(0.85, smoothness);
  
  // Calculate ideal control point positions for smooth curve
  const startTangent = prev ? calculateTangent(prev.start, start, end) : { x: end.x - start.x, y: end.y - start.y };
  const endTangent = next ? calculateTangent(start, end, next.end) : { x: end.x - start.x, y: end.y - start.y };
  
  // Normalize tangents
  const startLength = Math.sqrt(startTangent.x ** 2 + startTangent.y ** 2);
  const endLength = Math.sqrt(endTangent.x ** 2 + endTangent.y ** 2);
  
  if (startLength > 0) {
    startTangent.x /= startLength;
    startTangent.y /= startLength;
  }
  
  if (endLength > 0) {
    endTangent.x /= endLength;
    endTangent.y /= endLength;
  }
  
  // Calculate segment length
  const segmentLength = distance(start, end);
  const controlDistance = segmentLength * 0.3; // Control points at 30% of segment length
  
  // Calculate ideal control points
  const idealC1 = {
    x: start.x + startTangent.x * controlDistance,
    y: start.y + startTangent.y * controlDistance
  };
  
  const idealC2 = {
    x: end.x - endTangent.x * controlDistance,
    y: end.y - endTangent.y * controlDistance
  };
  
  // Blend between current and ideal control points based on smoothness
  const newC1 = {
    x: c1.x * (1 - smoothness) + idealC1.x * smoothness,
    y: c1.y * (1 - smoothness) + idealC1.y * smoothness
  };
  
  const newC2 = {
    x: c2.x * (1 - smoothness) + idealC2.x * smoothness,
    y: c2.y * (1 - smoothness) + idealC2.y * smoothness
  };
  
  return {
    ...segment,
    points: [newC1, newC2, end] // Use 3-point format to match existing segments
  };
}

/**
 * Calculate tangent direction at a point given neighbors
 */
function calculateTangent(prev: Point, _current: Point, next: Point): Point {
  const dx = (next.x - prev.x) / 2;
  const dy = (next.y - prev.y) / 2;
  return { x: dx, y: dy };
}

/**
 * Check if a curve segment is already smooth
 * Returns true if control points are well-positioned for a smooth curve
 */
function isSegmentSmooth(
  segment: BezierSegment,
  prev: BezierSegment | null,
  next: BezierSegment | null
): boolean {
  if (segment.type !== 'C') return false;

  const { start, end, points } = segment;
  
  // Handle both formats: [start, cp1, cp2, end] or [cp1, cp2, end]
  const c1 = points.length === 4 ? points[1] : points[0];
  const c2 = points.length === 4 ? points[2] : points[1];
  
  if (!c1 || !c2) return false;

  // Calculate current control point distances and angles
  const c1Dist = distance(start, c1);
  const c2Dist = distance(end, c2);
  const segmentDist = distance(start, end);

  // Check for degenerate segments
  if (segmentDist < 0.1) return true; // Tiny segments are fine

  // IMPROVED: Check if control points are reasonable (not collapsed or extreme)
  // Control points can be anywhere from 10% to 80% of segment length for smooth curves
  // Ellipses use ~55% (0.5522847498 for perfect circular arcs)
  const minDist = segmentDist * 0.1;
  const maxDist = segmentDist * 0.8;
  const isReasonableDistance = 
    c1Dist >= minDist && c1Dist <= maxDist &&
    c2Dist >= minDist && c2Dist <= maxDist;

  if (!isReasonableDistance) return false;

  // CRITICAL FIX: Check control point symmetry for ellipse/circle detection
  // In perfect ellipses, both control points are at similar distances
  const distanceRatio = Math.min(c1Dist, c2Dist) / Math.max(c1Dist, c2Dist);
  const isSymmetric = distanceRatio > 0.7; // Within 30% of each other
  
  // For symmetric curves (ellipses, circles), skip alignment check
  if (isSymmetric && c1Dist > segmentDist * 0.4 && c1Dist < segmentDist * 0.65) {
    return true; // This is likely an ellipse/circle segment
  }

  // Check if control points align well with tangent directions
  const startTangent = prev 
    ? calculateTangent(prev.start, start, end) 
    : { x: end.x - start.x, y: end.y - start.y };
  const endTangent = next 
    ? calculateTangent(start, end, next.end) 
    : { x: end.x - start.x, y: end.y - start.y };

  // Normalize
  const startTangentLen = Math.sqrt(startTangent.x ** 2 + startTangent.y ** 2);
  const endTangentLen = Math.sqrt(endTangent.x ** 2 + endTangent.y ** 2);

  if (startTangentLen > 0) {
    startTangent.x /= startTangentLen;
    startTangent.y /= startTangentLen;
  }

  if (endTangentLen > 0) {
    endTangent.x /= endTangentLen;
    endTangent.y /= endTangentLen;
  }

  // Calculate current control point directions
  const c1Dir = { x: c1.x - start.x, y: c1.y - start.y };
  const c1DirLen = Math.sqrt(c1Dir.x ** 2 + c1Dir.y ** 2);
  if (c1DirLen > 0) {
    c1Dir.x /= c1DirLen;
    c1Dir.y /= c1DirLen;
  }

  const c2Dir = { x: end.x - c2.x, y: end.y - c2.y };
  const c2DirLen = Math.sqrt(c2Dir.x ** 2 + c2Dir.y ** 2);
  if (c2DirLen > 0) {
    c2Dir.x /= c2DirLen;
    c2Dir.y /= c2DirLen;
  }

  // Dot product to check alignment (close to 1 = well aligned)
  // Very lenient - alignment > 0.5 is acceptable
  const c1Alignment = c1Dir.x * startTangent.x + c1Dir.y * startTangent.y;
  const c2Alignment = c2Dir.x * endTangent.x + c2Dir.y * endTangent.y;

  const isGoodAlignment = c1Alignment > 0.5 && c2Alignment > 0.5;

  return isGoodAlignment;
}

/**
 * Convert a line segment to a smooth cubic bezier curve
 */
function lineToCubic(
  segment: BezierSegment,
  prev: BezierSegment | null,
  next: BezierSegment | null,
  smoothness: number
): BezierSegment {
  const { start, end } = segment;

  // Calculate tangent directions
  const startTangent = prev 
    ? calculateTangent(prev.start, start, end) 
    : { x: end.x - start.x, y: end.y - start.y };
  const endTangent = next 
    ? calculateTangent(start, end, next.end) 
    : { x: end.x - start.x, y: end.y - start.y };

  // Normalize tangents
  const startLength = Math.sqrt(startTangent.x ** 2 + startTangent.y ** 2);
  const endLength = Math.sqrt(endTangent.x ** 2 + endTangent.y ** 2);

  if (startLength > 0) {
    startTangent.x /= startLength;
    startTangent.y /= startLength;
  }

  if (endLength > 0) {
    endTangent.x /= endLength;
    endTangent.y /= endLength;
  }

  // Calculate segment length and control point distance
  const segmentLength = distance(start, end);
  const controlDistance = segmentLength * 0.3 * smoothness; // Scale by smoothness

  // Create control points
  const c1 = {
    x: start.x + startTangent.x * controlDistance,
    y: start.y + startTangent.y * controlDistance
  };

  const c2 = {
    x: end.x - endTangent.x * controlDistance,
    y: end.y - endTangent.y * controlDistance
  };

  return {
    type: 'C',
    start,
    end,
    points: [start, c1, c2, end]
  };
}

/**
 * Convert quadratic bezier to cubic bezier
 */
function quadraticToCubic(segment: BezierSegment): BezierSegment {
  const { start, end, points } = segment;
  
  // Handle both formats: [start, cp, end] or [cp, end]
  const qc = points.length === 3 ? points[1] : points[0];
  
  if (!qc) return segment;
  
  // Convert Q to C using standard formula
  const c1 = {
    x: start.x + (2/3) * (qc.x - start.x),
    y: start.y + (2/3) * (qc.y - start.y)
  };
  
  const c2 = {
    x: end.x + (2/3) * (qc.x - end.x),
    y: end.y + (2/3) * (qc.y - end.y)
  };
  
  return {
    type: 'C',
    start,
    end,
    points: [c1, c2, end] // Use 3-point format to match existing segments
  };
}

/**
 * Convert segments back to SVG path data string
 */
function segmentsToPathData(segments: BezierSegment[]): string {
  return segments.map(seg => {
    switch (seg.type) {
      case 'M':
        return `M ${seg.end.x} ${seg.end.y}`;
      case 'L':
        return `L ${seg.end.x} ${seg.end.y}`;
      case 'C':
        if (seg.points && seg.points.length >= 2) {
          // Handle both formats: [start, cp1, cp2, end] or [cp1, cp2, end]
          const c1 = seg.points.length === 4 ? seg.points[1] : seg.points[0];
          const c2 = seg.points.length === 4 ? seg.points[2] : seg.points[1];
          if (c1 && c2) {
            return `C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${seg.end.x} ${seg.end.y}`;
          }
        }
        console.error('Invalid C segment - missing control points:', seg);
        return `L ${seg.end.x} ${seg.end.y}`;
      case 'Q':
        if (seg.points && seg.points.length >= 3) {
          const c = seg.points[1];
          if (c) {
            return `Q ${c.x} ${c.y} ${seg.end.x} ${seg.end.y}`;
          }
        }
        return `L ${seg.end.x} ${seg.end.y}`;
      case 'Z':
        return 'Z';
      default:
        return '';
    }
  }).join(' ');
}

/**
 * Auto-smooth all paths in the SVG
 */
export function autoSmoothPaths(paths: Path[], smoothness: number = 0.3): Path[] {
  return paths.map(path => smoothPath(path, smoothness));
}

/**
 * ========================================================================
 * PRO FEATURES (Available in PathRefine PRO)
 * ========================================================================
 * 
 * The following advanced smoothing features are available in the PRO version:
 * 
 * - organicSmoothPath() - Laplacian smoothing algorithm for tablet/hand drawings
 *   Fixes "shaky hand" artifacts with adaptive sampling and corner preservation
 * 
 * - autoRefinePath() - One-click path optimization pipeline
 *   Combines Smart Heal + Simplify + Organic Smooth in optimal sequence
 *   The "Magic Button" that saves hours of manual cleanup work
 * 
 * Learn more: https://pathrefine.dev/
 * ========================================================================
 */

// Stub function - PRO feature not available in open source version
export function organicSmoothPath(path: any): any {
  console.warn('organicSmoothPath is a PRO feature. Visit https://pathrefine.dev/ to upgrade.');
  return path;
}

// Stub function - PRO feature not available in open source version
export function autoRefinePath(path: any, _intensity?: any): any {
  console.warn('autoRefinePath is a PRO feature. Visit https://pathrefine.dev/ to upgrade.');
  return path;
}
