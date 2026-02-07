import type { SVGDocument, Path, Point } from '../types/svg';
import { segmentsToPathData } from './parser';
import { applyTransform } from './transforms';

/**
 * Perfect Square tool: Center artwork and normalize to standard viewBox
 * This is essential for icon consistency in design systems
 */
export function perfectSquare(
  document: SVGDocument, 
  targetSize: number = 24, 
  padding: number = 2,
  offsetX: number = 0,
  offsetY: number = 0
): SVGDocument {
  if (document.paths.length === 0) {
    return document;
  }
  
  // Calculate bounding box of all paths
  const bounds = calculateBounds(document.paths);
  
  if (!bounds) {
    return document;
  }
  
  const { minX, minY, maxX, maxY } = bounds;
  const width = maxX - minX;
  const height = maxY - minY;
  
  // Target viewBox with configurable size and padding
  const contentSize = targetSize - (padding * 2);
  
  // Calculate scale to fit content within padded area
  let scale = 1;
  if (width > 0 && height > 0) {
    scale = Math.min(contentSize / width, contentSize / height);
  } else if (width > 0) {
    scale = contentSize / width;
  } else if (height > 0) {
    scale = contentSize / height;
  }
  
  // Calculate offset to center the scaled content (with optional manual offset)
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  
  // Simple approach: Move minX/minY to origin, scale, then add padding and centering
  const baseOffsetX = padding + (contentSize - scaledWidth) / 2 - (minX * scale);
  const baseOffsetY = padding + (contentSize - scaledHeight) / 2 - (minY * scale);
  
  // Apply manual offset adjustments
  const finalOffsetX = baseOffsetX + offsetX;
  const finalOffsetY = baseOffsetY + offsetY;
  
  // Transform all paths
  const transformedPaths = document.paths.map(path => transformPath(path, scale, finalOffsetX, finalOffsetY));
  
  return {
    ...document,
    viewBox: {
      x: 0,
      y: 0,
      width: targetSize,
      height: targetSize
    },
    width: targetSize,
    height: targetSize,
    paths: transformedPaths
  };
}

function calculateBounds(paths: Path[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  paths.forEach(path => {
    path.segments.forEach(segment => {
      // Check start point (with transform applied)
      const transformedStart = applyTransform(segment.start, path.transform?.raw);
      updateBounds(transformedStart);
      
      // Check end point (with transform applied)
      const transformedEnd = applyTransform(segment.end, path.transform?.raw);
      updateBounds(transformedEnd);
      
      // Check all control points (with transform applied)
      segment.points.forEach(point => {
        const transformedPoint = applyTransform(point, path.transform?.raw);
        updateBounds(transformedPoint);
      });
    });
  });
  
  function updateBounds(point: Point) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  
  if (minX === Infinity) {
    return null;
  }
  
  return { minX, minY, maxX, maxY };
}

function transformPath(path: Path, scale: number, offsetX: number, offsetY: number): Path {
  const transformedSegments = path.segments.map(segment => ({
    ...segment,
    start: transformPoint(segment.start, scale, offsetX, offsetY, path.transform?.raw),
    end: transformPoint(segment.end, scale, offsetX, offsetY, path.transform?.raw),
    points: segment.points.map(p => transformPoint(p, scale, offsetX, offsetY, path.transform?.raw))
  }));
  
  // Regenerate d attribute from transformed segments
  const newD = segmentsToPathData(transformedSegments);
  
  return {
    ...path,
    segments: transformedSegments,
    d: newD,
    // Remove transform since it's now baked into the coordinates
    transform: undefined
  };
}

function transformPoint(
  point: Point, 
  scale: number, 
  offsetX: number, 
  offsetY: number,
  transform?: string
): Point {
  // First apply the existing transform to get absolute position
  const absolutePoint = applyTransform(point, transform);
  
  // Then scale and offset
  return {
    x: absolutePoint.x * scale + offsetX,
    y: absolutePoint.y * scale + offsetY
  };
}
