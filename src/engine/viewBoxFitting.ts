import { SVGDocument } from '../types/svg';
import { segmentsToPathData } from './parser';
import { applyTransform } from './transforms';

/**
 * Calculate the bounding box of all paths in the document
 */
export function calculateBoundingBox(document: SVGDocument): { x: number; y: number; width: number; height: number } | null {
  const paths = document.paths;
  if (paths.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const path of paths) {
    for (const segment of path.segments) {
      // Apply transform to all points before calculating bounds
      const transformedStart = applyTransform(segment.start, path.transform?.raw);
      const transformedEnd = applyTransform(segment.end, path.transform?.raw);
      
      // Check start point
      minX = Math.min(minX, transformedStart.x);
      minY = Math.min(minY, transformedStart.y);
      maxX = Math.max(maxX, transformedStart.x);
      maxY = Math.max(maxY, transformedStart.y);
      
      // Check end point
      minX = Math.min(minX, transformedEnd.x);
      minY = Math.min(minY, transformedEnd.y);
      maxX = Math.max(maxX, transformedEnd.x);
      maxY = Math.max(maxY, transformedEnd.y);
      
      // Check all control/intermediate points
      for (const point of segment.points) {
        const transformedPoint = applyTransform(point, path.transform?.raw);
        minX = Math.min(minX, transformedPoint.x);
        minY = Math.min(minY, transformedPoint.y);
        maxX = Math.max(maxX, transformedPoint.x);
        maxY = Math.max(maxY, transformedPoint.y);
      }
    }
  }

  // Handle edge case where no points were found
  if (minX === Infinity) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Fit the viewBox to the actual content bounds with optional padding
 * This removes unnecessary whitespace around the artwork
 */
export function fitToContent(
  document: SVGDocument,
  padding: number = 0
): SVGDocument {
  const bbox = calculateBoundingBox(document);
  
  if (!bbox || bbox.width === 0 || bbox.height === 0) {
    // No content or invalid bounds, return as-is
    return document;
  }

  // Calculate new viewBox with padding
  const newViewBox = {
    x: bbox.x - padding,
    y: bbox.y - padding,
    width: bbox.width + (padding * 2),
    height: bbox.height + (padding * 2)
  };

  // Calculate the offset to adjust coordinates
  const currentViewBox = document.viewBox || { x: 0, y: 0, width: document.width, height: document.height };
  const offsetX = currentViewBox.x - newViewBox.x;
  const offsetY = currentViewBox.y - newViewBox.y;

  // Transform all paths - bake transforms into coordinates
  const transformedPaths = document.paths.map(path => {
    const transformedSegments = path.segments.map(segment => {
      // First apply existing transform, then adjust for viewBox offset
      const transformedStart = applyTransform(segment.start, path.transform?.raw);
      const transformedEnd = applyTransform(segment.end, path.transform?.raw);
      const transformedPoints = segment.points.map(p => applyTransform(p, path.transform?.raw));
      
      return {
        ...segment,
        start: {
          x: transformedStart.x + offsetX,
          y: transformedStart.y + offsetY
        },
        end: {
          x: transformedEnd.x + offsetX,
          y: transformedEnd.y + offsetY
        },
        points: transformedPoints.map(point => ({
          x: point.x + offsetX,
          y: point.y + offsetY
        }))
      };
    });

    // Regenerate d attribute from transformed segments
    const newD = segmentsToPathData(transformedSegments);

    return {
      ...path,
      segments: transformedSegments,
      d: newD,
      // Remove transform as we're baking it into coordinates
      transform: undefined
    };
  });

  return {
    ...document,
    viewBox: newViewBox,
    width: newViewBox.width,
    height: newViewBox.height,
    paths: transformedPaths
  };
}

/**
 * Bake all transforms into path coordinates
 * Useful for preparing SVGs for export or further processing
 */
export function bakeTransforms(document: SVGDocument): SVGDocument {
  const transformedPaths = document.paths.map(path => {
    // If no transform, return as-is
    if (!path.transform?.raw) {
      return path;
    }
    
    const transformedSegments = path.segments.map(segment => ({
      ...segment,
      start: applyTransform(segment.start, path.transform?.raw),
      end: applyTransform(segment.end, path.transform?.raw),
      points: segment.points.map(p => applyTransform(p, path.transform?.raw))
    }));

    // Regenerate d attribute from transformed segments
    const newD = segmentsToPathData(transformedSegments);

    return {
      ...path,
      segments: transformedSegments,
      d: newD,
      transform: undefined
    };
  });

  return {
    ...document,
    paths: transformedPaths
  };
}
