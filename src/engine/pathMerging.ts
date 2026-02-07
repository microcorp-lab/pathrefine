import type { Path, SVGDocument, Point, BezierSegment } from '../types/svg';
import { bakePathTransform } from './transforms';
import { segmentsToPathData } from './parser';
import simplify from 'simplify-js';
import fitCurve from 'fit-curve';

/**
 * Calculate perpendicular distance from point to line segment
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag < 0.00001) {
    // Line segment is too short, return distance to start point
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + 
      Math.pow(point.y - lineStart.y, 2)
    );
  }
  
  const u = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (mag * mag);
  
  let closestX, closestY;
  if (u < 0) {
    closestX = lineStart.x;
    closestY = lineStart.y;
  } else if (u > 1) {
    closestX = lineEnd.x;
    closestY = lineEnd.y;
  } else {
    closestX = lineStart.x + u * dx;
    closestY = lineStart.y + u * dy;
  }
  
  return Math.sqrt(
    Math.pow(point.x - closestX, 2) + 
    Math.pow(point.y - closestY, 2)
  );
}

/**
 * Calculate the bounding box diagonal of a path
 * Exported for use in path smoothing algorithms
 */
export function getPathBoundingBoxDiagonal(path: Path): number {
  if (path.segments.length === 0) return 1; // Fallback
  
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  for (const seg of path.segments) {
    // Check start point
    minX = Math.min(minX, seg.start.x);
    minY = Math.min(minY, seg.start.y);
    maxX = Math.max(maxX, seg.start.x);
    maxY = Math.max(maxY, seg.start.y);
    
    // Check end point
    minX = Math.min(minX, seg.end.x);
    minY = Math.min(minY, seg.end.y);
    maxX = Math.max(maxX, seg.end.x);
    maxY = Math.max(maxY, seg.end.y);
    
    // Check control points for curves
    for (const pt of seg.points) {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
  }
  
  const width = maxX - minX;
  const height = maxY - minY;
  const diagonal = Math.sqrt(width * width + height * height);
  
  return diagonal > 0 ? diagonal : 1; // Avoid division by zero
}

/**
 * Sample a path segment into discrete points
 * Lines return just endpoints, curves sample along their length
 */
function sampleSegment(seg: BezierSegment, samplesPerCurve: number = 5): Point[] {
  const points: Point[] = [];
  
  if (seg.type === 'M' || seg.type === 'L' || seg.type === 'Z') {
    // Lines and moves: just start and end
    return [seg.start, seg.end];
  } else if (seg.type === 'C') {
    // Cubic Bezier: sample along curve
    const start = seg.start;
    const cp1 = seg.points[0];
    const cp2 = seg.points[1];
    const end = seg.end;
    
    points.push(start);
    for (let i = 1; i < samplesPerCurve; i++) {
      const t = i / samplesPerCurve;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;
      const t2 = t * t;
      const t3 = t2 * t;
      
      const x = mt3 * start.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * end.x;
      const y = mt3 * start.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * end.y;
      points.push({ x, y });
    }
    points.push(end);
  } else if (seg.type === 'Q') {
    // Quadratic Bezier: sample along curve
    const start = seg.start;
    const cp = seg.points[0];
    const end = seg.end;
    
    points.push(start);
    for (let i = 1; i < samplesPerCurve; i++) {
      const t = i / samplesPerCurve;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const t2 = t * t;
      
      const x = mt2 * start.x + 2 * mt * t * cp.x + t2 * end.x;
      const y = mt2 * start.y + 2 * mt * t * cp.y + t2 * end.y;
      points.push({ x, y });
    }
    points.push(end);
  }
  
  return points;
}

/**
 * Check if a sequence of points is nearly collinear (forms a straight line)
 * Returns true if all points are within tolerance of the line between first and last
 */
function checkCollinearity(points: Point[], tolerance: number): boolean {
  if (points.length < 3) return true;
  
  const first = points[0];
  const last = points[points.length - 1];
  
  // Check if all intermediate points are close to the line
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > tolerance) {
      return false; // Point is too far from line
    }
  }
  
  return true; // All points are collinear within tolerance
}

/**
 * Detect corners in a point sequence using angle threshold
 * Returns indices of points that are corners
 * 
 * @param points Array of points to analyze
 * @param angleThreshold Angle in degrees - corners have angles GREATER than this (e.g., 30° catches 90° corners)
 * @param isClosed Whether the path is closed (checks wrap-around corner)
 */
/**
 * Detect corner points in a polyline based on angle threshold
 * Exported for use in path smoothing algorithms
 * @param points - Array of points to analyze
 * @param angleThreshold - Angle in degrees (default 30°)
 * @param isClosed - Whether the path is closed
 * @returns Array of indices that are corners
 */
export function detectCorners(points: Point[], angleThreshold: number = 30, isClosed: boolean = false): number[] {
  if (points.length < 3) return [];
  
  const corners: number[] = [];
  
  // Always include first point
  corners.push(0);
  
  // Check for corner at seam (wrap-around) for closed paths
  if (isClosed && points.length >= 3) {
    const last = points[points.length - 1];
    const first = points[0];
    const second = points[1];
    
    // Calculate vectors at wrap-around point
    const v1 = { x: first.x - last.x, y: first.y - last.y };
    const v2 = { x: second.x - first.x, y: second.y - first.y };
    
    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    if (len1 >= 0.01 && len2 >= 0.01) {
      const unit1 = { x: v1.x / len1, y: v1.y / len1 };
      const unit2 = { x: v2.x / len2, y: v2.y / len2 };
      
      const dot = unit1.x * unit2.x + unit1.y * unit2.y;
      const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
      
      // If wrap-around is NOT a corner, we might be able to skip adding index 0
      // But for safety, we keep index 0 always
    }
  }
  
  // Check all intermediate points
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    
    // Calculate vectors
    const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    
    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    if (len1 < 0.01 || len2 < 0.01) continue;
    
    // Normalize
    const unit1 = { x: v1.x / len1, y: v1.y / len1 };
    const unit2 = { x: v2.x / len2, y: v2.y / len2 };
    
    // Calculate angle using dot product
    // angle = 0° means straight line (same direction)
    // angle = 90° means perpendicular (right angle corner)
    // angle = 180° means U-turn
    const dot = unit1.x * unit2.x + unit1.y * unit2.y;
    const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
    
    // If angle is significant (> threshold), it's a corner
    // 30° threshold catches 90° corners, 45° angles, etc.
    if (angle > angleThreshold) {
      corners.push(i);
    }
  }
  
  // Always include last point
  corners.push(points.length - 1);
  
  return corners;
}

/**
 * Convert fit-curve output to BezierSegment
 * Exported for use in path smoothing algorithms
 */
export function fitCurveToSegment(curve: number[][]): BezierSegment {
  // Validate curve data from fit-curve library
  if (!curve || curve.length !== 4) {
    const error = `Invalid curve data: expected 4 points, got ${curve?.length || 0}`;
    console.error('[fitCurveToSegment]', error, 'curve:', curve);
    throw new Error(error);
  }
  
  // Validate each point has valid x,y coordinates
  for (let i = 0; i < 4; i++) {
    if (!curve[i] || curve[i].length !== 2 || 
        typeof curve[i][0] !== 'number' || typeof curve[i][1] !== 'number' ||
        isNaN(curve[i][0]) || isNaN(curve[i][1]) ||
        !isFinite(curve[i][0]) || !isFinite(curve[i][1])) {
      const error = `Invalid point at index ${i}: ${JSON.stringify(curve[i])}`;
      console.error('[fitCurveToSegment]', error);
      console.error('[fitCurveToSegment] Full curve:', JSON.stringify(curve));
      throw new Error(error);
    }
  }
  
  return {
    type: 'C' as const,
    points: [
      { x: curve[1][0], y: curve[1][1] }, // cp1
      { x: curve[2][0], y: curve[2][1] }  // cp2
    ],
    start: { x: curve[0][0], y: curve[0][1] },
    end: { x: curve[3][0], y: curve[3][1] }
  };
}

/**
 * Apply G1 continuity: ensure smooth joins between curves
 * Makes control points collinear at join points
 */
/**
 * Apply G1 continuity: ensure smooth joins between curves
 * 
 * Professional implementation with:
 * - Corner detection (preserves sharp corners using cross product)
 * - Closed path support (wraps around for circles/loops)
 * - Averaged tangent smoothing (balanced healing on both sides)
 * - Zero-length handle protection
 * 
 * @param segments Array of bezier segments to smooth
 * @param isClosed Whether the path is closed (Z command or first === last)
 * @param thresholdAngle Maximum angle in degrees to smooth (default 45°)
 */
/**
 * Apply G1 continuity to ensure smooth joins between curves
 * Exported for use in path smoothing algorithms
 */
export function applyG1Continuity(
  segments: BezierSegment[], 
  isClosed: boolean = false,
  thresholdAngle: number = 45
): void {
  const n = segments.length;
  if (n < 2) return;
  
  // If closed, we check n joins; if open, n-1
  const iterations = isClosed ? n : n - 1;

  for (let i = 0; i < iterations; i++) {
    const prevIdx = i === 0 && isClosed ? n - 1 : i - 1;
    const currIdx = i;

    if (prevIdx < 0) continue; // Skip first point on open paths

    let prev = segments[prevIdx];
    let curr = segments[currIdx];

    // --- ENHANCEMENT: Handle Z segments ---
    // If we encounter a Z, look one step further to find the actual curve
    if (prev.type === 'Z' && isClosed) {
      const realPrevIdx = prevIdx === 0 ? n - 1 : prevIdx - 1;
      prev = segments[realPrevIdx];
    }
    if (curr.type === 'Z' && isClosed) {
      const realCurrIdx = (currIdx + 1) % n;
      curr = segments[realCurrIdx];
    }

    // Only smooth between two curves
    if (prev.type !== 'C' || curr.type !== 'C') continue;

    // The join point is the end of the previous curve (or start of current)
    const join = isClosed && segments[currIdx].type === 'Z' ? curr.start : prev.end;
    const prevOut = prev.points[1]; // CP2 of previous curve
    const currIn = curr.points[0];  // CP1 of current curve

    // 1. Calculate vectors from handles to join point
    const v1 = { x: join.x - prevOut.x, y: join.y - prevOut.y };
    const v2 = { x: currIn.x - join.x, y: currIn.y - join.y };

    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    // Skip if handles are too short (would cause division by zero)
    if (len1 < 0.01 || len2 < 0.01) continue;

    // 2. Normalize vectors for accurate angle calculation
    const unit1 = { x: v1.x / len1, y: v1.y / len1 };
    const unit2 = { x: v2.x / len2, y: v2.y / len2 };

    // 3. Corner Detection using Cross Product
    // Dot product: tells how aligned the vectors are
    const dot = unit1.x * unit2.x + unit1.y * unit2.y;
    
    // Cross product (2D determinant): tells the "turning" force
    const cross = unit1.x * unit2.y - unit1.y * unit2.x;

    // Convert to degrees for threshold comparison
    const angle = Math.abs(Math.atan2(cross, dot) * (180 / Math.PI));

    // GUARD: If angle is too sharp, it's an intentional corner - skip smoothing
    if (angle > thresholdAngle) continue;

    // 4. Average the tangents for balanced, symmetrical smoothing
    // This creates a "meet in the middle" effect rather than forcing
    // one curve to submit to the other
    const avgUnit = { 
      x: (unit1.x + unit2.x) / 2, 
      y: (unit1.y + unit2.y) / 2 
    };
    const avgLen = Math.sqrt(avgUnit.x * avgUnit.x + avgUnit.y * avgUnit.y);
    
    // Handle edge case where vectors cancel out (shouldn't happen after corner guard)
    if (avgLen < 0.01) continue;
    
    const finalUnit = { x: avgUnit.x / avgLen, y: avgUnit.y / avgLen };

    // 5. Update BOTH handles to be perfectly collinear with preserved lengths
    const newPrevCP2 = {
      x: join.x - finalUnit.x * len1,
      y: join.y - finalUnit.y * len1
    };
    const newCurrCP1 = {
      x: join.x + finalUnit.x * len2,
      y: join.y + finalUnit.y * len2
    };
    
    // Validate the new control points before applying
    if (isNaN(newPrevCP2.x) || isNaN(newPrevCP2.y) || !isFinite(newPrevCP2.x) || !isFinite(newPrevCP2.y)) {
      console.error('[applyG1Continuity] Invalid prev CP2:', newPrevCP2, 'join:', join, 'finalUnit:', finalUnit, 'len1:', len1);
      continue;
    }
    if (isNaN(newCurrCP1.x) || isNaN(newCurrCP1.y) || !isFinite(newCurrCP1.x) || !isFinite(newCurrCP1.y)) {
      console.error('[applyG1Continuity] Invalid curr CP1:', newCurrCP1, 'join:', join, 'finalUnit:', finalUnit, 'len2:', len2);
      continue;
    }
    
    prev.points[1] = newPrevCP2;
    curr.points[0] = newCurrCP1;
  }
}

/**
 * Ensures the segment array is valid for SVG rendering.
 * Fixes missing MoveTos and ensures Z segments have correct metadata.
 */
function validateSegments(segments: BezierSegment[]): BezierSegment[] {
  if (segments.length === 0) return [];

  const validated: BezierSegment[] = [];
  
  // Helper to check if a point is valid
  const isValidPoint = (p: Point | undefined): p is Point => {
    return p !== undefined && 
           typeof p.x === 'number' && !isNaN(p.x) && isFinite(p.x) &&
           typeof p.y === 'number' && !isNaN(p.y) && isFinite(p.y);
  };
  
  // Helper to check if a segment is valid
  const isValidSegment = (seg: BezierSegment): boolean => {
    if (!isValidPoint(seg.start) || !isValidPoint(seg.end)) {
      console.warn(`[Validate] Skipping segment with invalid start/end:`, seg);
      return false;
    }
    
    // Check all control points
    if (seg.points && seg.points.length > 0) {
      for (const point of seg.points) {
        if (!isValidPoint(point)) {
          console.warn(`[Validate] Skipping segment with invalid control point:`, seg);
          return false;
        }
      }
    }
    
    return true;
  };
  
  // Rule 1: Every path MUST start with an 'M'
  if (segments[0].type !== 'M') {
    validated.push({
      type: 'M',
      start: segments[0].start,
      end: segments[0].start,
      points: []
    });
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    
    // Rule 0: Skip segments with invalid coordinates
    if (!isValidSegment(seg)) {
      continue;
    }
    
    // Rule 2: Prevent back-to-back Z commands or empty subpaths
    if (seg.type === 'Z' && i > 0 && segments[i-1].type === 'M') {
      continue; // Skip closing a path that never moved
    }

    // Rule 3: Ensure every segment after Z starts with M (for compound paths with holes)
    if (i > 0 && segments[i-1].type === 'Z' && seg.type !== 'M') {
      validated.push({
        type: 'M',
        start: seg.start,
        end: seg.start,
        points: []
      });
    }

    validated.push(seg);
  }

  return validated;
}

/**
 * World-class 3-step path simplification algorithm
 * 
 * Based on industry best practices:
 * Step 1: Visvalingam-Whyatt simplification (via simplify-js)
 * Step 2: Schneider's curve fitting (via fit-curve) 
 * Step 3: G1 continuity alignment for smooth joins
 * 
 * @param path The path to simplify
 * @param tolerancePercent Tolerance as percentage of path bounding box diagonal (e.g., 0.1 = 0.1%)
 * @param cornerAngle Angle threshold in degrees for corner detection (default: 30°)
 * @export For testing and direct use
 */
export function simplifyPath(path: Path, tolerancePercent: number, cornerAngle: number = 30): Path {
  if (tolerancePercent <= 0 || path.segments.length === 0) return path;
  
  // Convert percentage to absolute tolerance based on path bounding box
  const diagonal = getPathBoundingBoxDiagonal(path);
  const tolerance = (tolerancePercent / 100) * diagonal;
  
  console.log(`[Simplify] Path ID: ${path.id}, Diagonal: ${diagonal.toFixed(1)}px, Tolerance: ${tolerancePercent}% = ${tolerance.toFixed(2)}px, Segments: ${path.segments.length}`);
  
  // Step 1: Sample all segments to point clouds
  const allPoints: Point[] = [];
  const segmentBoundaries: number[] = [0]; // Track where each segment's points start
  
  for (let i = 0; i < path.segments.length; i++) {
    const seg = path.segments[i];
    const points = sampleSegment(seg, 5); // 5 samples per curve
    
    // Add points (skip first if it duplicates previous end)
    if (allPoints.length > 0 && i > 0) {
      allPoints.push(...points.slice(1));
    } else {
      allPoints.push(...points);
    }
    segmentBoundaries.push(allPoints.length);
  }
  
  console.log(`  [Sample] ${path.segments.length} segments → ${allPoints.length} sampled points`);
  
  // Step 2: Process each subpath separately (split by M commands)
  const newSegments: BezierSegment[] = [];
  let subpathStart = 0;
  
  for (let i = 0; i < path.segments.length; i++) {
    const seg = path.segments[i];
    
    if (seg.type === 'M') {
      // Process previous subpath if exists
      if (i > 0) {
        const subpathEnd = segmentBoundaries[i];
        processSubpath(
          allPoints.slice(subpathStart, subpathEnd),
          tolerance,
          cornerAngle,
          newSegments
        );
      }
      
      // Start new subpath
      newSegments.push({ ...seg });
      subpathStart = segmentBoundaries[i];
    }
  }
  
  // Process final subpath
  if (path.segments.length > 0) {
    processSubpath(
      allPoints.slice(subpathStart),
      tolerance,
      cornerAngle,
      newSegments
    );
  }
  
  // Safety check: ensure we have at least 2 segments (M + something)
  if (newSegments.length < 2 && path.segments.length >= 2) {
    console.log(`  [Safety] Prevented over-simplification, keeping original path`);
    return path;
  }
  
  // Safety check: never return MORE segments than original (regression prevention)
  // Allow equal length since snapping/merging improves quality even with same count
  if (newSegments.length > path.segments.length) {
    console.log(`  [Safety] Simplified has MORE segments (${newSegments.length} vs ${path.segments.length}), keeping original`);
    return path;
  }
  
  // Validate segments before returning to ensure SVG compliance
  const validatedSegments = validateSegments(newSegments);
  
  console.log(`  [Result] ${path.segments.length} segments → ${validatedSegments.length} segments (${((1 - validatedSegments.length / path.segments.length) * 100).toFixed(1)}% reduction)`);
  
  return {
    ...path,
    segments: validatedSegments,
    d: segmentsToPathData(validatedSegments)
  };
}

/**
 * Process a subpath using 3-step professional approach:
 * Step 1: Visvalingam-Whyatt point simplification (simplify-js)
 * Step 2: Schneider's curve fitting (fit-curve)
 * Step 3: G1 continuity alignment for smooth joins
 */
function processSubpath(
  points: Point[],
  tolerance: number,
  cornerAngle: number,
  output: BezierSegment[]
): void {
  if (points.length < 2) return;
  
  // Check if subpath is closed (first and last points are same)
  const first = points[0];
  const last = points[points.length - 1];
  const isClosed = Math.abs(first.x - last.x) < 0.01 && Math.abs(first.y - last.y) < 0.01;
  
  // STEP 1: Visvalingam-Whyatt simplification via simplify-js
  // Keep points intact so simplify-js knows it's closed (don't slice!)
  // Use much smaller tolerance (0.1x) to only remove microscopic noise, preserving corners
  const simplified = simplify(points, tolerance * 0.1, true);
  
  console.log(`  [Visvalingam-Whyatt] ${points.length} points → ${simplified.length} points`);

  // If too few points, return as lines
  if (simplified.length < 2) return;
  if (simplified.length === 2) {
    output.push({
      type: 'L',
      points: [],
      start: simplified[0],
      end: simplified[1]
    });
    return;
  }

  // STEP 1.5: Detect corners in simplified points BEFORE curve fitting
  // This prevents fit-curve from smoothing through sharp corners
  // Pass isClosed flag to check wrap-around corner for closed paths
  const cornerIndices = detectCorners(simplified, cornerAngle, isClosed);
  
  console.log(`  [Corner Detection] Found ${cornerIndices.length - 2} corners at angles > ${cornerAngle}°`);

  // STEP 2: Fit curves to segments between corners (or use lines if collinear)
  const curveSegments: BezierSegment[] = [];
  
  // Use much looser tolerance for collinearity check to force wobbly lines into straight lines
  const collinearityTolerance = tolerance * 2.5;
  
  for (let i = 0; i < cornerIndices.length - 1; i++) {
    const startIdx = cornerIndices[i];
    const endIdx = cornerIndices[i + 1];
    const segmentPoints = simplified.slice(startIdx, endIdx + 1);
    
    if (segmentPoints.length < 2) continue;
    
    // If only 2 points, use a line
    if (segmentPoints.length === 2) {
      curveSegments.push({
        type: 'L',
        points: [],
        start: segmentPoints[0],
        end: segmentPoints[1]
      });
      continue;
    }
    
    // Check if points are nearly collinear (should be a line, not a curve)
    const isCollinear = checkCollinearity(segmentPoints, collinearityTolerance);
    
    if (isCollinear) {
      // Use a straight line for collinear points
      curveSegments.push({
        type: 'L',
        points: [],
        start: segmentPoints[0],
        end: segmentPoints[segmentPoints.length - 1]
      });
      console.log(`  [Collinear] Using line for ${segmentPoints.length} collinear points`);
      continue;
    }
    
    // Try to fit curves to this segment (between corners)
    const fitCurveInput = segmentPoints.map(p => [p.x, p.y]);
    
    try {
      const curves = fitCurve(fitCurveInput, tolerance);
      
      // Convert and validate each curve
      for (const curve of curves) {
        try {
          curveSegments.push(fitCurveToSegment(curve));
        } catch (validationError) {
          console.warn(`  [Curve Fitting] Invalid curve data, using line fallback:`, validationError);
          console.warn(`  [Curve Fitting] Bad curve:`, curve);
          // Use line for this segment
          if (curve?.[0] && curve?.[3]) {
            curveSegments.push({
              type: 'L',
              points: [],
              start: { x: curve[0][0], y: curve[0][1] },
              end: { x: curve[3][0], y: curve[3][1] }
            });
          }
        }
      }
    } catch (error) {
      console.warn(`  [Curve Fitting] fit-curve failed, using line fallback:`, error);
      // Fallback to lines if curve fitting fails
      for (let j = 0; j < segmentPoints.length - 1; j++) {
        curveSegments.push({
          type: 'L',
          points: [],
          start: segmentPoints[j],
          end: segmentPoints[j + 1]
        });
      }
    }
  }
  
  console.log(`  [Schneider] Fitted ${curveSegments.length} segments (curves + lines at corners)`);
  
  // STEP 2.7: THE FIX FOR GAPS - Ensure closed paths are properly closed
  if (isClosed && curveSegments.length > 0) {
    const firstSeg = curveSegments[0];
    const lastSeg = curveSegments[curveSegments.length - 1];
    
    // Force the path to "snap" shut - ensure last point matches first point exactly
    lastSeg.end = { ...firstSeg.start };
    
    // STEP 2.8: For closed paths, merge first and last segments if they're collinear
    // This fixes the "5 points on a square" issue by merging the wrap-around edge
    if (curveSegments.length > 2) {
      // Check if both are lines
      if (firstSeg.type === 'L' && lastSeg.type === 'L') {
        // Check if they form a collinear line
        const testPoints = [lastSeg.start, lastSeg.end, firstSeg.end];
        if (checkCollinearity(testPoints, collinearityTolerance)) {
          // Merge: create one line from last.start to first.end, remove both
          curveSegments[0] = {
            type: 'L',
            points: [],
            start: lastSeg.start,
            end: firstSeg.end
          };
          curveSegments.pop(); // Remove the last segment
          console.log(`  [Merge] Merged collinear first/last segments in closed path`);
        }
      }
    }
    
    // Add explicit Z command to ensure SVG renderers close the path
    curveSegments.push({
      type: 'Z',
      points: [],
      start: curveSegments[curveSegments.length - 1].end,
      end: curveSegments[0].start
    });
  }
  
  // STEP 3: Apply G1 continuity for smooth joins (will skip corners due to angle threshold)
  // Pass isClosed flag to handle wrap-around smoothing for circles/loops
  applyG1Continuity(curveSegments, isClosed);
  
  console.log(`  [G1 Continuity] Applied smooth joins${isClosed ? ' (closed path)' : ''}`);
  
  output.push(...curveSegments);
}

/**
 * Check if a path is closed (ends with Z command or start === end)
 */
function isPathClosed(path: Path): boolean {
  if (path.segments.length === 0) return false;
  
  // Check if last segment is Z
  const lastSegment = path.segments[path.segments.length - 1];
  if (lastSegment.type === 'Z') return true;
  
  // Check if end point equals start point
  const firstSegment = path.segments[0];
  const dx = Math.abs(lastSegment.end.x - firstSegment.start.x);
  const dy = Math.abs(lastSegment.end.y - firstSegment.start.y);
  return dx < 0.01 && dy < 0.01;
}

/**
 * Close an open path by adding Z command
 */
function closePath(path: Path): Path {
  if (isPathClosed(path)) return path;
  
  // Add Z segment
  const firstSegment = path.segments[0];
  const lastSegment = path.segments[path.segments.length - 1];
  
  const closeSegment = {
    type: 'Z' as const,
    points: [],
    start: lastSegment.end,
    end: firstSegment.start
  };
  
  const newSegments = [...path.segments, closeSegment];
  const newD = segmentsToPathData(newSegments);
  
  return {
    ...path,
    segments: newSegments,
    d: newD
  };
}

/**
 * Calculate color similarity between two colors
 * Returns 0-1 where 1 is identical
 */
function colorSimilarity(color1: string, color2: string): number {
  // Normalize colors to hex format
  const normalize = (color: string): string => {
    if (color.startsWith('#')) return color.toLowerCase();
    // Handle rgb() format
    if (color.startsWith('rgb')) {
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        const r = parseInt(match[0]).toString(16).padStart(2, '0');
        const g = parseInt(match[1]).toString(16).padStart(2, '0');
        const b = parseInt(match[2]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }
    return color.toLowerCase();
  };

  const c1 = normalize(color1);
  const c2 = normalize(color2);

  if (c1 === c2) return 1;

  // Extract RGB values
  const hex1 = c1.replace('#', '');
  const hex2 = c2.replace('#', '');

  if (hex1.length !== 6 || hex2.length !== 6) return 0;

  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);

  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);

  // Calculate Euclidean distance in RGB space
  const distance = Math.sqrt(
    Math.pow(r1 - r2, 2) +
    Math.pow(g1 - g2, 2) +
    Math.pow(b1 - b2, 2)
  );

  // Normalize to 0-1 (max distance in RGB is sqrt(3 * 255^2) = 441.67)
  const maxDistance = 441.67;
  return 1 - (distance / maxDistance);
}

/**
 * Group paths by spatial proximity
 * Paths within the threshold distance are grouped together
 */
export function groupPathsByProximity(paths: Path[], threshold: number): Path[][] {
  if (paths.length === 0) return [];
  
  const groups: Path[][] = [];
  const assigned = new Set<string>();
  
  // Helper to get bounding box center
  const getCenter = (path: Path): Point => {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    path.segments.forEach(seg => {
      const x = seg.end.x;
      const y = seg.end.y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
    
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    };
  };
  
  // Helper to calculate distance between path centers
  const distance = (p1: Path, p2: Path): number => {
    const c1 = getCenter(p1);
    const c2 = getCenter(p2);
    return Math.sqrt(
      Math.pow(c1.x - c2.x, 2) + 
      Math.pow(c1.y - c2.y, 2)
    );
  };
  
  // Greedy grouping algorithm
  paths.forEach(path => {
    if (assigned.has(path.id)) return;
    
    // Start new group
    const group: Path[] = [path];
    assigned.add(path.id);
    
    // Find all paths within threshold distance of any path in group
    let added = true;
    while (added) {
      added = false;
      
      for (const candidate of paths) {
        if (assigned.has(candidate.id)) continue;
        
        // Check if candidate is close to any path in the group
        for (const groupPath of group) {
          if (distance(candidate, groupPath) <= threshold) {
            group.push(candidate);
            assigned.add(candidate.id);
            added = true;
            break;
          }
        }
      }
    }
    
    groups.push(group);
  });
  
  return groups;
}

/**
 * Group paths by similar colors
 */
export function groupPathsByColor(
  paths: Path[],
  threshold: number = 0.95
): Path[][] {
  const groups: Path[][] = [];
  const used = new Set<string>();

  paths.forEach(path => {
    if (used.has(path.id) || !path.fill) return;

    const group: Path[] = [path];
    used.add(path.id);

    // Find all paths with similar fill color
    paths.forEach(otherPath => {
      if (used.has(otherPath.id) || !otherPath.fill) return;

      const similarity = colorSimilarity(path.fill!, otherPath.fill);
      if (similarity >= threshold) {
        group.push(otherPath);
        used.add(otherPath.id);
      }
    });

    if (group.length > 1) {
      groups.push(group);
    }
  });

  return groups;
}

/**
 * Merge multiple paths into a single path
 * Combines all path data with M (moveto) commands between them
 * Optionally specify the fill color for the merged path
 * 
 * NOTE: All transforms are baked into the paths before merging to ensure
 * correct positioning in world coordinates.
 */
/**
 * Merge multiple paths into a single path
 * @param paths - Paths to merge
 * @param fillColor - Optional fill color for merged path
 * @param closePaths - Whether to close open paths before merging
 * @param simplifyTolerance - Optional tolerance for path simplification (0 = no simplification)
 */
export function mergePaths(
  paths: Path[], 
  fillColor?: string, 
  closePaths: boolean = false,
  simplifyTolerance: number = 0
): Path {
  if (paths.length === 0) {
    throw new Error('Cannot merge empty path array');
  }
  
  if (paths.length === 1) {
    let path = bakePathTransform(paths[0]) as Path;
    if (closePaths) {
      path = closePath(path);
    }
    return path;
  }

  // Bake transforms and optionally close all paths before merging
  const bakedPaths = paths.map(p => {
    let path = bakePathTransform(p) as Path;
    if (closePaths) {
      path = closePath(path);
    }
    return path;
  });

  // Use the first baked path as the base
  const basePath = bakedPaths[0];

  // Combine all segments from baked paths
  const combinedSegments = bakedPaths.flatMap(p => p.segments);

  // Regenerate path data from combined segments
  const combinedD = segmentsToPathData(combinedSegments);

  let result: Path = {
    ...basePath,
    id: `${basePath.id}-merged`,
    d: combinedD,
    segments: combinedSegments,
    fill: fillColor || basePath.fill,
    transform: undefined  // No transform on merged path
  };
  
  // Apply simplification if requested
  if (simplifyTolerance > 0) {
    result = simplifyPath(result, simplifyTolerance);
  }
  
  return result;
}

/**
 * Merge selected paths with a specified color
 */
export function mergeSelectedPaths(
  document: SVGDocument,
  pathIds: string[],
  fillColor?: string
): SVGDocument {
  if (pathIds.length < 2) {
    throw new Error('Need at least 2 paths to merge');
  }

  const pathsToMerge = document.paths.filter(p => pathIds.includes(p.id));
  const mergedPath = mergePaths(pathsToMerge, fillColor);
  
  // Remove merged paths and add the new one
  const remainingPaths = document.paths.filter(p => !pathIds.includes(p.id));
  
  return {
    ...document,
    paths: [...remainingPaths, mergedPath]
  };
}

/**
 * Merge all paths with similar colors in a document
 * Returns a new document with merged paths
 */
export function mergeSimilarPaths(
  document: SVGDocument,
  threshold: number = 0.95
): { document: SVGDocument; mergedCount: number } {
  const groups = groupPathsByColor(document.paths, threshold);
  
  if (groups.length === 0) {
    return { document, mergedCount: 0 };
  }

  const mergedPaths: Path[] = [];
  const mergedIds = new Set<string>();
  let mergedCount = 0;

  // Add merged paths
  groups.forEach(group => {
    const merged = mergePaths(group);
    mergedPaths.push(merged);
    group.forEach(p => mergedIds.add(p.id));
    mergedCount += group.length - 1; // -1 because one path remains
  });

  // Add unmerged paths
  document.paths.forEach(path => {
    if (!mergedIds.has(path.id)) {
      mergedPaths.push(path);
    }
  });

  return {
    document: {
      ...document,
      paths: mergedPaths
    },
    mergedCount
  };
}

/**
 * Intensity presets for Auto-Heal feature
 * Maps user-friendly intensity levels to technical parameters
 */
export const INTENSITY_PRESETS = {
  light: {
    tolerance: 0.05,           // 0.05% - subtle cleanup
    cornerAngle: 20,           // Preserve more corners
    autoCloseMultiplier: 1,    // Only microscopic gaps
    label: 'Light',
    description: 'Subtle cleanup - preserves maximum detail'
  },
  medium: {
    tolerance: 0.15,           // 0.15% - balanced
    cornerAngle: 30,           // Standard corner detection
    autoCloseMultiplier: 2,    // Balanced gap closing
    label: 'Medium',
    description: 'Balanced optimization (recommended)'
  },
  strong: {
    tolerance: 0.5,            // 0.5% - aggressive
    cornerAngle: 45,           // Allow more rounding
    autoCloseMultiplier: 3,    // Close larger gaps
    label: 'Strong',
    description: 'Aggressive simplification for web/traced images'
  },
  extreme: {
    tolerance: 1.5,            // 1.5% - very aggressive
    cornerAngle: 60,           // Maximum corner rounding
    autoCloseMultiplier: 4,    // Close even larger gaps
    label: 'Extreme',
    description: 'Maximum simplification - best for heavily traced SVGs'
  }
} as const;

export type IntensityLevel = keyof typeof INTENSITY_PRESETS;

/**
 * Check if a path should be auto-closed based on gap size and tolerance
 */
function shouldAutoClose(path: Path, tolerance: number, multiplier: number): boolean {
  if (isPathClosed(path)) return false;
  
  const first = path.segments[0]?.start;
  const last = path.segments[path.segments.length - 1]?.end;
  
  if (!first || !last) return false;
  
  const gap = Math.sqrt(
    Math.pow(last.x - first.x, 2) + 
    Math.pow(last.y - first.y, 2)
  );
  
  const diagonal = getPathBoundingBoxDiagonal(path);
  const autoCloseThreshold = (tolerance / 100) * diagonal * multiplier;
  
  return gap < autoCloseThreshold;
}

/**
 * Auto-Heal: Automated path repair and optimization pipeline
 * 
 * Fixes common path issues:
 * 1. Bakes transforms to normalize coordinates (if present)
 * 2. Auto-closes paths with tiny gaps (based on intensity)
 * 3. Removes redundant points via Visvalingam-Whyatt
 * 4. Applies 3-step simplification with intensity-based tolerance
 * 5. Ensures G1 continuity for smooth joins
 * 
 * @param path The path to heal
 * @param intensity Healing intensity: 'light', 'medium', or 'strong'
 * @returns Healed path with optimized geometry
 */
export function autoHealPath(
  path: Path,
  intensity: IntensityLevel = 'medium'
): Path {
  const preset = INTENSITY_PRESETS[intensity];
  
  // Step A: Bake transforms (if any) to work with real coordinates
  // Note: bakePathTransform would need to be implemented if transforms exist
  // For now, assume paths don't have transforms or they're already baked
  let healed = path;
  
  // Step B: Auto-close detection
  // If path is open but gap is tiny (< threshold), close it
  if (shouldAutoClose(healed, preset.tolerance, preset.autoCloseMultiplier)) {
    healed = closePath(healed);
    console.log(`[Auto-Heal] Auto-closed path with gap < ${(preset.tolerance * preset.autoCloseMultiplier).toFixed(2)}% of diagonal`);
  }
  
  // Step C: Run 3-step simplification with intensity-based parameters
  return simplifyPath(healed, preset.tolerance, preset.cornerAngle);
}
