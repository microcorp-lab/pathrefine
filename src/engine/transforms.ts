import type { Point, Transform } from '../types/svg';

/**
 * Centralized SVG transform utilities
 * 
 * This module provides a DRY approach to handling SVG transforms across the application.
 * All transform operations should use these utilities instead of duplicating logic.
 * 
 * Implementation note: Uses pure math instead of DOM APIs for better testability
 * and performance. Falls back to DOM parsing only for complex/unsupported cases.
 */

/**
 * Parse a transform matrix from transform string
 * Returns identity matrix if parsing fails
 */
function parseTransformToMatrix(transform: string): {
  a: number; b: number; c: number; d: number; e: number; f: number;
} {
  // Identity matrix
  const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  
  if (!transform) {
    return identity;
  }
  
  // Start with identity matrix
  let matrix = { ...identity };
  
  // Extract all transform functions
  const translateMatches = [...transform.matchAll(/translate\(([-\d.]+)(?:[\s,]+([-\d.]+))?\)/g)];
  const scaleMatches = [...transform.matchAll(/scale\(([-\d.]+)(?:[\s,]+([-\d.]+))?\)/g)];
  const rotateMatches = [...transform.matchAll(/rotate\(([-\d.]+)(?:[\s,]+([-\d.]+)[\s,]+([-\d.]+))?\)/g)];
  const matrixMatches = [...transform.matchAll(/matrix\(([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)\)/g)];
  
  // Get all transforms with their positions
  const allMatches: Array<{index: number, type: string, match: RegExpMatchArray}> = [];
  
  translateMatches.forEach(m => allMatches.push({ index: m.index!, type: 'translate', match: m }));
  scaleMatches.forEach(m => allMatches.push({ index: m.index!, type: 'scale', match: m }));
  rotateMatches.forEach(m => allMatches.push({ index: m.index!, type: 'rotate', match: m }));
  matrixMatches.forEach(m => allMatches.push({ index: m.index!, type: 'matrix', match: m }));
  
  // Sort by position in string
  allMatches.sort((a, b) => a.index - b.index);
  
  // Apply transforms in order by multiplying matrices
  for (const {type, match} of allMatches) {
    let newMatrix = { ...identity };
    
    if (type === 'translate') {
      newMatrix.e = parseFloat(match[1]);
      newMatrix.f = parseFloat(match[2] || '0');
    } else if (type === 'scale') {
      const sx = parseFloat(match[1]);
      const sy = parseFloat(match[2] || match[1]);
      newMatrix.a = sx;
      newMatrix.d = sy;
    } else if (type === 'rotate') {
      const angle = parseFloat(match[1]) * (Math.PI / 180);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      newMatrix.a = cos;
      newMatrix.b = sin;
      newMatrix.c = -sin;
      newMatrix.d = cos;
    } else if (type === 'matrix') {
      newMatrix = {
        a: parseFloat(match[1]),
        b: parseFloat(match[2]),
        c: parseFloat(match[3]),
        d: parseFloat(match[4]),
        e: parseFloat(match[5]),
        f: parseFloat(match[6])
      };
    }
    
    // Multiply current matrix by new matrix
    // result = matrix * newMatrix
    const temp = {
      a: matrix.a * newMatrix.a + matrix.c * newMatrix.b,
      b: matrix.b * newMatrix.a + matrix.d * newMatrix.b,
      c: matrix.a * newMatrix.c + matrix.c * newMatrix.d,
      d: matrix.b * newMatrix.c + matrix.d * newMatrix.d,
      e: matrix.a * newMatrix.e + matrix.c * newMatrix.f + matrix.e,
      f: matrix.b * newMatrix.e + matrix.d * newMatrix.f + matrix.f
    };
    matrix = temp;
  }
  
  return matrix;
}

/**
 * Apply transform matrix to a point
 */
function applyMatrix(point: Point, matrix: { a: number; b: number; c: number; d: number; e: number; f: number }): Point {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f
  };
}

/**
 * Apply transform to a point (local → world coordinates)
 * 
 * @param point - Point in local coordinate space
 * @param transform - SVG transform string (e.g., "translate(10,20) rotate(45)")
 * @returns Point in world coordinate space
 * 
 * @example
 * const worldPoint = applyTransform({ x: 5, y: 10 }, "translate(100,200)");
 * // Result: { x: 105, y: 210 }
 */
export function applyTransform(point: Point, transform: string | undefined): Point {
  if (!transform) {
    return point;
  }
  
  try {
    const matrix = parseTransformToMatrix(transform);
    return applyMatrix(point, matrix);
  } catch (e) {
    console.warn('Failed to parse transform:', transform, e);
    return point;
  }
}

/**
 * Apply inverse transform to a point (world → local coordinates)
 * 
 * Used when converting screen/canvas coordinates to path-local coordinates.
 * 
 * @param point - Point in world coordinate space
 * @param transform - SVG transform string
 * @returns Point in local coordinate space
 * 
 * @example
 * const localPoint = applyInverseTransform({ x: 105, y: 210 }, "translate(100,200)");
 * // Result: { x: 5, y: 10 }
 */
export function applyInverseTransform(point: Point, transform: string | undefined): Point {
  if (!transform) {
    return point;
  }
  
  try {
    const matrix = parseTransformToMatrix(transform);
    
    // Calculate determinant
    const det = matrix.a * matrix.d - matrix.b * matrix.c;
    
    if (Math.abs(det) < 1e-10) {
      console.warn('Singular matrix, cannot invert transform:', transform);
      return point;
    }
    
    // Calculate inverse matrix
    const invMatrix = {
      a: matrix.d / det,
      b: -matrix.b / det,
      c: -matrix.c / det,
      d: matrix.a / det,
      e: (matrix.c * matrix.f - matrix.d * matrix.e) / det,
      f: (matrix.b * matrix.e - matrix.a * matrix.f) / det
    };
    
    return applyMatrix(point, invMatrix);
  } catch (e) {
    console.warn('Failed to parse inverse transform:', transform, e);
    return point;
  }
}

/**
 * Get transform matrix from SVG transform string
 * 
 * @param transform - SVG transform string
 * @returns DOMMatrix-like object or null if parsing fails
 */
export function getTransformMatrix(transform: string): { a: number; b: number; c: number; d: number; e: number; f: number } | null {
  if (!transform) {
    return null;
  }
  
  try {
    return parseTransformToMatrix(transform);
  } catch (e) {
    console.warn('Failed to get transform matrix:', transform, e);
    return null;
  }
}

/**
 * Parse transform string into structured data
 * 
 * Extracts translate, scale, rotate values from transform string.
 * Note: For complex transforms, use getTransformMatrix() instead.
 * 
 * @param transform - SVG transform string
 * @returns Parsed transform components
 * 
 * @example
 * parseTransform("translate(10,20) rotate(45) scale(2)")
 * // Result: { translate: {x:10, y:20}, rotate: 45, scale: {x:2, y:2} }
 */
export function parseTransform(transform: string): {
  translate?: { x: number; y: number };
  rotate?: number;
  scale?: { x: number; y: number };
  matrix?: number[];
} {
  const result: {
    translate?: { x: number; y: number };
    rotate?: number;
    scale?: { x: number; y: number };
    matrix?: number[];
  } = {};
  
  if (!transform) {
    return result;
  }
  
  // Parse translate
  const translateMatch = transform.match(/translate\(([-\d.]+)(?:[\s,]+([-\d.]+))?\)/);
  if (translateMatch) {
    result.translate = {
      x: parseFloat(translateMatch[1]),
      y: parseFloat(translateMatch[2] || '0')
    };
  }
  
  // Parse rotate
  const rotateMatch = transform.match(/rotate\(([-\d.]+)/);
  if (rotateMatch) {
    result.rotate = parseFloat(rotateMatch[1]);
  }
  
  // Parse scale
  const scaleMatch = transform.match(/scale\(([-\d.]+)(?:[\s,]+([-\d.]+))?\)/);
  if (scaleMatch) {
    const sx = parseFloat(scaleMatch[1]);
    result.scale = {
      x: sx,
      y: parseFloat(scaleMatch[2] || String(sx))
    };
  }
  
  // Parse matrix
  const matrixMatch = transform.match(/matrix\(([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)\)/);
  if (matrixMatch) {
    result.matrix = matrixMatch.slice(1, 7).map(parseFloat);
  }
  
  return result;
}

/**
 * Convert structured transform back to SVG transform string
 * 
 * @param transform - Transform object
 * @returns SVG transform string
 * 
 * @example
 * serializeTransform({ translate: {x:10, y:20}, rotate: 45 })
 * // Result: "translate(10,20) rotate(45)"
 */
export function serializeTransform(transform: Transform): string {
  const parts: string[] = [];
  
  if (transform.translate) {
    parts.push(`translate(${transform.translate.x},${transform.translate.y})`);
  }
  
  if (transform.rotate !== undefined) {
    parts.push(`rotate(${transform.rotate})`);
  }
  
  if (transform.scale) {
    if (transform.scale.x === transform.scale.y) {
      parts.push(`scale(${transform.scale.x})`);
    } else {
      parts.push(`scale(${transform.scale.x},${transform.scale.y})`);
    }
  }
  
  return parts.join(' ');
}

/**
 * Compose multiple transforms into a single transform string
 * 
 * @param transforms - Array of transform strings to compose
 * @returns Combined transform string
 * 
 * @example
 * composeTransforms(["translate(10,20)", "rotate(45)", "scale(2)"])
 * // Result: "translate(10,20) rotate(45) scale(2)"
 */
export function composeTransforms(transforms: string[]): string {
  return transforms.filter(t => t).join(' ');
}

/**
 * Bake transform into a path by applying it to all points
 * Returns a new path with transformed points and no transform attribute
 * 
 * @param path - Path with transform to bake
 * @returns New path with transformed points and no transform
 * 
 * @example
 * const transformed = bakePathTransform(path);
 * // All points are now in world coordinates
 */
export function bakePathTransform(path: { segments: any[], transform?: { raw?: string } }): typeof path {
  if (!path.transform?.raw) {
    // No transform, return as-is
    return path;
  }
  
  const transformStr = path.transform.raw;
  
  // Transform all points in all segments
  const bakedSegments = path.segments.map(segment => {
    return {
      ...segment,
      start: applyTransform(segment.start, transformStr),
      end: applyTransform(segment.end, transformStr),
      points: segment.points.map((p: Point) => applyTransform(p, transformStr))
    };
  });
  
  // Return new path without transform
  return {
    ...path,
    segments: bakedSegments,
    transform: undefined
  };
}
