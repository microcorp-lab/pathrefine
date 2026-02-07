import type { Point, BezierSegment } from '../types/svg';

/**
 * Calculate the length of a path
 */
export function calculatePathLength(segments: BezierSegment[]): number {
  let totalLength = 0;

  for (const segment of segments) {
    switch (segment.type) {
      case 'M':
        break;
      case 'L':
        totalLength += distance(segment.start, segment.end);
        break;
      case 'C':
        totalLength += cubicBezierLength(
          segment.start,
          segment.points[0],
          segment.points[1],
          segment.end
        );
        break;
      case 'Q':
        totalLength += quadraticBezierLength(
          segment.start,
          segment.points[0],
          segment.end
        );
        break;
      case 'Z':
        totalLength += distance(segment.start, segment.end);
        break;
    }
  }

  return totalLength;
}

/**
 * Get a point at a specific distance along a path
 * @param t - normalized position (0-1) along the path
 */
export function getPointAtLength(segments: BezierSegment[], t: number): Point {
  if (segments.length === 0) {
    return { x: 0, y: 0 };
  }

  const totalLength = calculatePathLength(segments);
  const targetLength = totalLength * t;
  
  let currentLength = 0;

  for (const segment of segments) {
    const segmentLength = getSegmentLength(segment);
    
    if (segmentLength > 0 && currentLength + segmentLength >= targetLength) {
      const localT = (targetLength - currentLength) / segmentLength;
      return getPointOnSegment(segment, localT);
    } else if (segmentLength === 0 && currentLength >= targetLength && segment.type !== 'M') {
      return segment.start;
    }
    
    currentLength += segmentLength;
  }

  // Return last point if we somehow overshoot
  const lastSegment = segments[segments.length - 1];
  return lastSegment?.end || { x: 0, y: 0 };
}

/**
 * Get the tangent vector at a specific point along the path
 */
export function getTangentAtLength(segments: BezierSegment[], t: number): Point {
  const totalLength = calculatePathLength(segments);
  const targetLength = totalLength * t;
  
  let currentLength = 0;

  for (const segment of segments) {
    const segmentLength = getSegmentLength(segment);
    
    if (currentLength + segmentLength >= targetLength) {
      const localT = (targetLength - currentLength) / segmentLength;
      return getTangentOnSegment(segment, localT);
    }
    
    currentLength += segmentLength;
  }

  const lastSegment = segments[segments.length - 1];
  return getTangentOnSegment(lastSegment, 1);
}

/**
 * Get normal vector (perpendicular to tangent)
 */
export function getNormalAtLength(segments: BezierSegment[], t: number): Point {
  const tangent = getTangentAtLength(segments, t);
  return { x: -tangent.y, y: tangent.x };
}

/**
 * Sample path at regular intervals
 */
export function samplePath(segments: BezierSegment[], numSamples: number): Point[] {
  const samples: Point[] = [];
  
  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    samples.push(getPointAtLength(segments, t));
  }
  
  return samples;
}

// Helper functions

function getSegmentLength(segment: BezierSegment): number {
  switch (segment.type) {
    case 'M':
      return 0;
    case 'L':
    case 'Z':
      return distance(segment.start, segment.end);
    case 'C':
      return cubicBezierLength(
        segment.start,
        segment.points[0],
        segment.points[1],
        segment.end
      );
    case 'Q':
      return quadraticBezierLength(
        segment.start,
        segment.points[0],
        segment.end
      );
    default:
      return 0;
  }
}

function getPointOnSegment(segment: BezierSegment, t: number): Point {
  switch (segment.type) {
    case 'M':
      return segment.start;
    case 'L':
    case 'Z':
      return linearInterpolation(segment.start, segment.end, t);
    case 'C':
      return cubicBezierPoint(
        segment.start,
        segment.points[0],
        segment.points[1],
        segment.end,
        t
      );
    case 'Q':
      return quadraticBezierPoint(
        segment.start,
        segment.points[0],
        segment.end,
        t
      );
    default:
      return segment.start;
  }
}

function getTangentOnSegment(segment: BezierSegment, t: number): Point {
  let tangent: Point;

  switch (segment.type) {
    case 'L':
    case 'Z': {
      const dx = segment.end.x - segment.start.x;
      const dy = segment.end.y - segment.start.y;
      tangent = { x: dx, y: dy };
      break;
    }
    case 'C': {
      tangent = cubicBezierTangent(
        segment.start,
        segment.points[0],
        segment.points[1],
        segment.end,
        t
      );
      break;
    }
    case 'Q': {
      tangent = quadraticBezierTangent(
        segment.start,
        segment.points[0],
        segment.end,
        t
      );
      break;
    }
    default:
      tangent = { x: 1, y: 0 };
  }

  // Normalize
  const length = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
  return length > 0 
    ? { x: tangent.x / length, y: tangent.y / length }
    : { x: 1, y: 0 };
}

// Math utilities

export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function linearInterpolation(p1: Point, p2: Point, t: number): Point {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
}

function cubicBezierPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  // Safety check for undefined control points (can happen with malformed SVGs)
  if (!p0 || !p1 || !p2 || !p3) {
    return p0 || p1 || p2 || p3 || { x: 0, y: 0 };
  }
  
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

function cubicBezierTangent(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  // Safety check for undefined control points
  if (!p0 || !p1 || !p2 || !p3) {
    return { x: 1, y: 0 }; // Default tangent
  }
  
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return {
    x: 3 * mt2 * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x),
    y: 3 * mt2 * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y),
  };
}

function cubicBezierLength(p0: Point, p1: Point, p2: Point, p3: Point): number {
  // Approximate using simpson's rule
  const steps = 10;
  let length = 0;

  for (let i = 0; i < steps; i++) {
    const t1 = i / steps;
    const t2 = (i + 1) / steps;
    const pt1 = cubicBezierPoint(p0, p1, p2, p3, t1);
    const pt2 = cubicBezierPoint(p0, p1, p2, p3, t2);
    length += distance(pt1, pt2);
  }

  return length;
}

function quadraticBezierPoint(p0: Point, p1: Point, p2: Point, t: number): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return {
    x: mt2 * p0.x + 2 * mt * t * p1.x + t2 * p2.x,
    y: mt2 * p0.y + 2 * mt * t * p1.y + t2 * p2.y,
  };
}

function quadraticBezierTangent(p0: Point, p1: Point, p2: Point, t: number): Point {
  const mt = 1 - t;

  return {
    x: 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  };
}

function quadraticBezierLength(p0: Point, p1: Point, p2: Point): number {
  const steps = 10;
  let length = 0;

  for (let i = 0; i < steps; i++) {
    const t1 = i / steps;
    const t2 = (i + 1) / steps;
    const pt1 = quadraticBezierPoint(p0, p1, p2, t1);
    const pt2 = quadraticBezierPoint(p0, p1, p2, t2);
    length += distance(pt1, pt2);
  }

  return length;
}

/**
 * Rotate a point around an origin
 */
export function rotatePoint(point: Point, origin: Point, angle: number): Point {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/**
 * Translate a point
 */
export function translatePoint(point: Point, offset: Point): Point {
  return {
    x: point.x + offset.x,
    y: point.y + offset.y,
  };
}
