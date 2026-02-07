import type { Path, BezierSegment, Point } from '../types/svg';
import { calculatePathLength } from './pathMath';
import { segmentsToPathData } from './parser';

/**
 * Smart Heal: Intelligently remove points while preserving curve shape
 * Uses pure mathematics - no AI required
 */

/**
 * Calculate the importance score of a point (0-1, where 1 is most important)
 * Considers: curvature, position, and local geometry
 */
function calculatePointImportance(
  prev: Point,
  current: Point,
  next: Point
): number {
  // Vector from prev to current
  const v1 = { x: current.x - prev.x, y: current.y - prev.y };
  const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  
  // Vector from current to next
  const v2 = { x: next.x - current.x, y: next.y - current.y };
  const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  if (len1 === 0 || len2 === 0) return 0; // Degenerate segment
  
  // Normalize vectors
  const n1 = { x: v1.x / len1, y: v1.y / len1 };
  const n2 = { x: v2.x / len2, y: v2.y / len2 };
  
  // Calculate angle change (dot product gives cos(angle))
  const dotProduct = n1.x * n2.x + n1.y * n2.y;
  const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
  
  // Higher angle = more important corner point
  // Normalize angle to 0-1 (π radians = 1.0)
  const curvatureScore = angle / Math.PI;
  
  // Length score: very short segments are less important
  const avgLength = (len1 + len2) / 2;
  const lengthScore = Math.min(1, avgLength / 10); // Segments < 10 units are less important
  
  // Combined importance (curvature is more important than length)
  return curvatureScore * 0.7 + lengthScore * 0.3;
}

/**
 * Find the least important point in a path segment
 */
function findLeastImportantPoint(segments: BezierSegment[]): number {
  let minImportance = Infinity;
  let minIndex = -1;
  
  // Extract anchor points only
  const anchorPoints: Point[] = [];
  const anchorIndices: number[] = [];
  
  segments.forEach((seg, idx) => {
    if (seg.type === 'M' || seg.type === 'L') {
      anchorPoints.push(seg.end);
      anchorIndices.push(idx);
    } else if (seg.type === 'C' && seg.points.length > 0) {
      // For Bezier curves, use the end point
      anchorPoints.push(seg.end);
      anchorIndices.push(idx);
    }
  });
  
  // Need at least 3 points to calculate importance
  if (anchorPoints.length < 3) return -1;
  
  // Calculate importance for each interior point (skip first and last)
  for (let i = 1; i < anchorPoints.length - 1; i++) {
    const importance = calculatePointImportance(
      anchorPoints[i - 1],
      anchorPoints[i],
      anchorPoints[i + 1]
    );
    
    if (importance < minImportance) {
      minImportance = importance;
      minIndex = anchorIndices[i];
    }
  }
  
  return minIndex;
}

/**
 * Create smooth Bezier curve connecting prev to next, bypassing removed point
 */
function createBridgeCurve(
  prev: Point,
  removed: Point,
  next: Point
): { cp1: Point; cp2: Point } {
  // Validate inputs
  if (!prev || !removed || !next || 
      typeof prev.x !== 'number' || typeof prev.y !== 'number' ||
      typeof removed.x !== 'number' || typeof removed.y !== 'number' ||
      typeof next.x !== 'number' || typeof next.y !== 'number' ||
      isNaN(prev.x) || isNaN(prev.y) || isNaN(removed.x) || isNaN(removed.y) || isNaN(next.x) || isNaN(next.y)) {
    console.error('[createBridgeCurve] Invalid input points:', { prev, removed, next });
    // Return fallback: straight line control points
    return {
      cp1: prev,
      cp2: next
    };
  }
  
  // Calculate tangent direction at prev (direction toward removed)
  const tangent1 = {
    x: removed.x - prev.x,
    y: removed.y - prev.y
  };
  const len1 = Math.sqrt(tangent1.x * tangent1.x + tangent1.y * tangent1.y);
  
  // Calculate tangent direction at next (direction from removed)
  const tangent2 = {
    x: next.x - removed.x,
    y: next.y - removed.y
  };
  const len2 = Math.sqrt(tangent2.x * tangent2.x + tangent2.y * tangent2.y);
  
  // Normalize tangents
  if (len1 > 0) {
    tangent1.x /= len1;
    tangent1.y /= len1;
  }
  if (len2 > 0) {
    tangent2.x /= len2;
    tangent2.y /= len2;
  }
  
  // Calculate bridge distance (distance from prev to next)
  const bridge = {
    x: next.x - prev.x,
    y: next.y - prev.y
  };
  const bridgeLen = Math.sqrt(bridge.x * bridge.x + bridge.y * bridge.y);
  
  // Place control points at 1/3 of bridge distance along tangent directions
  const controlDist = bridgeLen * 0.33;
  
  const cp1 = {
    x: prev.x + tangent1.x * controlDist,
    y: prev.y + tangent1.y * controlDist
  };
  
  const cp2 = {
    x: next.x - tangent2.x * controlDist,
    y: next.y - tangent2.y * controlDist
  };
  
  // Validate output
  if (isNaN(cp1.x) || isNaN(cp1.y) || isNaN(cp2.x) || isNaN(cp2.y)) {
    console.error('[createBridgeCurve] Generated invalid control points:', { cp1, cp2 });
    console.error('[createBridgeCurve] Input was:', { prev, removed, next });
    // Return fallback
    return {
      cp1: { x: (prev.x + removed.x) / 2, y: (prev.y + removed.y) / 2 },
      cp2: { x: (removed.x + next.x) / 2, y: (removed.y + next.y) / 2 }
    };
  }
  
  return { cp1, cp2 };
}

/**
 * Smart Heal: Remove one least-important point from the path
 * Returns new path with one point removed and curves adjusted
 */
export function healPath(path: Path): Path {
  if (path.segments.length < 4) {
    // Can't heal paths with too few segments
    return path;
  }
  
  // Find the least important point
  const targetIndex = findLeastImportantPoint(path.segments);
  
  if (targetIndex === -1) {
    return path; // No suitable point found
  }
  
  // Build new segments array
  const newSegments: BezierSegment[] = [];
  
  for (let i = 0; i < path.segments.length; i++) {
    if (i === targetIndex) {
      // This is the point we're removing - skip it
      continue;
    }
    
    if (i === targetIndex + 1) {
      // This segment comes after the removed point
      // Need to create a bridge curve from the previous segment
      const prevSeg = path.segments[i - 2];
      const removedSeg = path.segments[i - 1];
      const currentSeg = path.segments[i];
      
      if (prevSeg && removedSeg && currentSeg) {
        // Validate that all end points exist
        if (!prevSeg.end || !removedSeg.end || !currentSeg.end) {
          console.error('[healPath] Missing end point in segments!');
          // Skip this segment - keep original
          newSegments.push(path.segments[i]);
          continue;
        }
        
        // Create smooth bridge curve
        const { cp1, cp2 } = createBridgeCurve(
          prevSeg.end,
          removedSeg.end,
          currentSeg.end
        );
        
        // Create new Bezier curve segment
        newSegments.push({
          type: 'C',
          points: [cp1, cp2],
          start: prevSeg.end,
          end: currentSeg.end
        });
        continue;
      }
    }
    
    // Keep all other segments as-is
    newSegments.push(path.segments[i]);
  }
  
  // Rebuild path d attribute using proper utility
  const d = segmentsToPathData(newSegments);
  
  return {
    ...path,
    d: d.trim(),
    segments: newSegments
  };
}

/**
 * Heal multiple points from a path (batch operation)
 */
export function healPathMultiple(path: Path, count: number): Path {
  let healedPath = path;
  
  for (let i = 0; i < count; i++) {
    const nextHeal = healPath(healedPath);
    
    // Stop if no more healing possible
    if (nextHeal.segments.length === healedPath.segments.length) {
      break;
    }
    
    healedPath = nextHeal;
  }
  
  return healedPath;
}

/**
 * Calculate how many points can be safely removed
 * (without degrading quality too much)
 */
export function calculateOptimalHealCount(path: Path): number {
  const pathLength = calculatePathLength(path.segments);
  const currentPoints = path.segments.filter(
    seg => seg.type === 'M' || seg.type === 'L' || (seg.type === 'C' && seg.points.length > 0)
  ).length;
  
  // Target density: 1.5 points per 100 units (optimal range)
  const targetPoints = Math.ceil((pathLength / 100) * 1.5);
  
  // Calculate how many to remove
  const healCount = Math.max(0, currentPoints - targetPoints);
  
  // Safety limit: don't remove more than 70% of points
  const maxRemoval = Math.floor(currentPoints * 0.7);
  
  return Math.min(healCount, maxRemoval);
}
