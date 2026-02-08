import type { Path, BezierSegment, Point, ControlPoint } from '../types/svg';
import { segmentsToPathData } from './parser';
import { distance } from './pathMath';

/**
 * Extract all control points from a path for editing
 */
export function extractControlPoints(path: Path): ControlPoint[] {
  const points: ControlPoint[] = [];

  path.segments.forEach((segment, segmentIndex) => {
    // Add start point for first segment only
    if (segmentIndex === 0) {
      points.push({
        pathId: path.id,
        segmentIndex,
        pointIndex: 0,
        point: segment.start,
        type: 'anchor'
      });
    }

    // Add control points for bezier curves
    if (segment.type === 'C' && segment.points.length >= 3) {
      points.push({
        pathId: path.id,
        segmentIndex,
        pointIndex: 1,
        point: segment.points[0],
        type: 'control'
      });
      points.push({
        pathId: path.id,
        segmentIndex,
        pointIndex: 2,
        point: segment.points[1],
        type: 'control'
      });
    } else if (segment.type === 'Q' && segment.points.length >= 2) {
      points.push({
        pathId: path.id,
        segmentIndex,
        pointIndex: 1,
        point: segment.points[0],
        type: 'control'
      });
    }

    // Add end point (anchor)
    if (segment.type !== 'Z') {
      points.push({
        pathId: path.id,
        segmentIndex,
        pointIndex: -1,
        point: segment.end,
        type: 'anchor'
      });
    }
  });

  return points;
}

/**
 * Extract only anchor points from a path (excludes control points)
 * Useful for visualization and point counting
 */
export function extractAnchorPoints(path: Path): Point[] {
  const points: Point[] = [];

  path.segments.forEach((segment, segmentIndex) => {
    // Add start point for first segment only
    if (segmentIndex === 0) {
      points.push(segment.start);
    }

    // Add end point (anchor) for all segments except Z
    if (segment.type !== 'Z') {
      points.push(segment.end);
    }
  });

  return points;
}

/**
 * Find nearest control point to a given position
 */
export function findNearestPoint(
  controlPoints: ControlPoint[],
  position: Point,
  threshold: number = 10
): ControlPoint | null {
  let nearest: ControlPoint | null = null;
  let minDist = threshold;

  controlPoints.forEach(cp => {
    const dist = distance(cp.point, position);
    if (dist < minDist) {
      minDist = dist;
      nearest = cp;
    }
  });

  return nearest;
}

/**
 * Update a control point position and regenerate path
 */
export function updateControlPoint(
  path: Path,
  segmentIndex: number,
  pointIndex: number,
  newPosition: Point
): Path {
  const newSegments = path.segments.map((seg, idx) => {
    // Deep clone segments that will be modified
    if (idx === segmentIndex || 
        (pointIndex === 0 && idx === segmentIndex - 1) ||
        (pointIndex === -1 && idx === segmentIndex + 1)) {
      return {
        ...seg,
        start: { ...seg.start },
        end: { ...seg.end },
        points: seg.points.map(p => ({ ...p }))
      };
    }
    return seg;
  });
  
  const segment = newSegments[segmentIndex];

  if (pointIndex === 0) {
    // Update start point
    segment.start = newPosition;
    // Also update previous segment's end if exists
    if (segmentIndex > 0) {
      newSegments[segmentIndex - 1].end = newPosition;
    }
  } else if (pointIndex === -1) {
    // Update end point
    segment.end = newPosition;
    // Also update next segment's start if exists
    if (segmentIndex < newSegments.length - 1) {
      newSegments[segmentIndex + 1].start = newPosition;
    }
  } else {
    // Update control point
    segment.points[pointIndex - 1] = newPosition;
  }

  const newPathData = segmentsToPathData(newSegments);

  return {
    ...path,
    d: newPathData,
    segments: newSegments
  };
}

/**
 * Add a new point to a path segment
 */
export function addPointToSegment(
  path: Path,
  segmentIndex: number,
  t: number = 0.5
): Path {
  const segment = path.segments[segmentIndex];
  
  if (segment.type === 'L' || segment.type === 'Z') {
    // Split line segment or close path segment
    const newPoint = {
      x: segment.start.x + t * (segment.end.x - segment.start.x),
      y: segment.start.y + t * (segment.end.y - segment.start.y)
    };

    const newSegments = [...path.segments];
    
    if (segment.type === 'Z') {
      // For Z segments, convert to L segments
      newSegments.splice(segmentIndex, 1,
        {
          type: 'L',
          points: [newPoint],
          start: segment.start,
          end: newPoint
        },
        {
          type: 'L',
          points: [segment.end],
          start: newPoint,
          end: segment.end
        }
      );
    } else {
      // For L segments
      newSegments.splice(segmentIndex, 1,
        {
          type: 'L',
          points: [newPoint],
          start: segment.start,
          end: newPoint
        },
        {
          type: 'L',
          points: [segment.end],
          start: newPoint,
          end: segment.end
        }
      );
    }

    return {
      ...path,
      d: segmentsToPathData(newSegments),
      segments: newSegments
    };
  } else if (segment.type === 'C') {
    // Split cubic bezier curve at t
    const p0 = segment.start;
    const p1 = segment.points[0];
    const p2 = segment.points[1];
    const p3 = segment.end;

    const q0 = lerp(p0, p1, t);
    const q1 = lerp(p1, p2, t);
    const q2 = lerp(p2, p3, t);
    const r0 = lerp(q0, q1, t);
    const r1 = lerp(q1, q2, t);
    const newPoint = lerp(r0, r1, t);

    const newSegments = [...path.segments];
    newSegments.splice(segmentIndex, 1,
      {
        type: 'C',
        points: [q0, r0, newPoint],
        start: p0,
        end: newPoint
      },
      {
        type: 'C',
        points: [r1, q2, p3],
        start: newPoint,
        end: p3
      }
    );

    return {
      ...path,
      d: segmentsToPathData(newSegments),
      segments: newSegments
    };
  }

  return path;
}

/**
 * Remove a point from the path
 */
export function removePoint(
  path: Path,
  segmentIndex: number
): Path {
  if (path.segments.length <= 2) {
    // Don't allow removing if it would leave less than 2 segments
    return path;
  }

  const newSegments = [...path.segments];
  
  if (segmentIndex > 0 && segmentIndex < newSegments.length - 1) {
    const prevSegment = newSegments[segmentIndex - 1];
    const nextSegment = newSegments[segmentIndex + 1];
    
    // Merge segments by connecting previous to next
    prevSegment.end = nextSegment.end;
    newSegments.splice(segmentIndex, 1);
  } else if (segmentIndex === 0 && newSegments.length > 1) {
    // Remove first segment, update start of next
    newSegments.splice(0, 1);
  } else if (segmentIndex === newSegments.length - 1 && newSegments.length > 1) {
    // Remove last segment
    newSegments.splice(segmentIndex, 1);
  }

  return {
    ...path,
    d: segmentsToPathData(newSegments),
    segments: newSegments
  };
}

/**
 * Join selected points by removing all intermediate segments
 * Connects the first and last selected anchor points directly
 */
export function joinPoints(
  path: Path,
  selectedIndices: number[]
): Path {
  if (selectedIndices.length < 2) {
    return path; // Need at least 2 points to join
  }

  const controlPoints = extractControlPoints(path);
  
  // Filter to only anchor points and sort by index
  const anchorIndices = selectedIndices
    .filter(idx => controlPoints[idx]?.type === 'anchor')
    .sort((a, b) => a - b);
    
  if (anchorIndices.length < 2) {
    return path; // Need at least 2 anchor points
  }

  const firstAnchorIdx = anchorIndices[0];
  const lastAnchorIdx = anchorIndices[anchorIndices.length - 1];
  
  const firstCP = controlPoints[firstAnchorIdx];
  const lastCP = controlPoints[lastAnchorIdx];
  
  // Build new segments array
  const newSegments: BezierSegment[] = [];
  
  // Keep segments before the first anchor
  for (let i = 0; i <= firstCP.segmentIndex; i++) {
    newSegments.push({...path.segments[i]});
  }
  
  // Add the joining segment
  newSegments[newSegments.length - 1] = {
    ...newSegments[newSegments.length - 1],
    end: lastCP.point
  };
  
  // If lastCP is not the end of a segment, we need to add a segment to its end point
  if (lastCP.segmentIndex < path.segments.length - 1) {
    const nextSegmentAfterLast = path.segments[lastCP.segmentIndex + 1];
    newSegments.push({
      type: 'L',
      points: [nextSegmentAfterLast.end],
      start: lastCP.point,
      end: nextSegmentAfterLast.end
    });
    
    // Keep remaining segments after the last anchor
    for (let i = lastCP.segmentIndex + 2; i < path.segments.length; i++) {
      newSegments.push({...path.segments[i]});
    }
  }

  return {
    ...path,
    d: segmentsToPathData(newSegments),
    segments: newSegments
  };
}

/**
 * Linear interpolation between two points
 */
function lerp(p0: Point, p1: Point, t: number): Point {
  return {
    x: p0.x + (p1.x - p0.x) * t,
    y: p0.y + (p1.y - p0.y) * t
  };
}

/**
 * Find the closest point on a path segment
 */
export function findClosestPointOnSegment(
  segment: BezierSegment,
  position: Point
): { point: Point; t: number } {
  let minDist = Infinity;
  let bestT = 0;
  let bestPoint = segment.start;

  // Sample the segment
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    let point: Point;

    if (segment.type === 'L') {
      point = lerp(segment.start, segment.end, t);
    } else if (segment.type === 'C') {
      point = cubicBezierPoint(
        segment.start,
        segment.points[0],
        segment.points[1],
        segment.end,
        t
      );
    } else {
      continue;
    }

    const dist = distance(point, position);
    if (dist < minDist) {
      minDist = dist;
      bestT = t;
      bestPoint = point;
    }
  }

  return { point: bestPoint, t: bestT };
}

function cubicBezierPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
  };
}

/**
 * Auto-colorize: Replace all color values with currentColor for design system integration
 * Preserves 'none' and transparent values
 */
export function autoColorize(path: Path): Path {
  const shouldReplace = (value: string | undefined): boolean => {
    if (!value) return false;
    const normalized = value.toLowerCase().trim();
    // Don't replace none, transparent, or currentColor
    if (normalized === 'none' || normalized === 'transparent' || normalized === 'currentcolor') {
      return false;
    }
    // Replace any color value (hex, rgb, rgba, hsl, hsla, named colors)
    return true;
  };

  return {
    ...path,
    fill: shouldReplace(path.fill) ? 'currentColor' : path.fill,
    stroke: shouldReplace(path.stroke) ? 'currentColor' : path.stroke,
  };
}
